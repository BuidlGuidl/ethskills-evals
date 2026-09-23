// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title SubscriptionBilling
/// @notice Prepaid USDC subscriptions with continuous (per-second) accrual at a monthly rate.
///
/// How it works:
///  - Customers deposit USDC into escrow and subscribe to a plan ($X / 30 days).
///  - Instead of a monthly charge transaction, the operator's revenue accrues
///    continuously at the plan rate: charge = price * elapsed / BILLING_PERIOD.
///    Deposits stay in escrow until earned, so "cancel and refund what I haven't
///    used" is exact down to the second and needs no operator cooperation.
///  - `settle` moves accrued value from a customer's balance to the operator's
///    `earned` balance. Anyone may call it for anyone (keeper-friendly); the
///    `isActive` view already accounts for un-settled time, so access checks
///    are exact even between settles.
///  - When a balance is fully consumed the subscription lapses automatically.
///
/// Trust properties:
///  - The operator can only ever withdraw funds that have accrued via `earned`;
///    customer escrow is untouchable by the owner.
///  - Plan price changes apply only to NEW subscriptions/plan changes; each
///    account snapshots its price at subscribe time.
contract SubscriptionBilling is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Length of one billing period. Plan prices are per period.
    uint256 public constant BILLING_PERIOD = 30 days;

    /// @notice Plan ids created by the constructor.
    uint256 public constant HOBBY = 0;
    uint256 public constant PRO = 1;

    /// @notice The stablecoin used for all deposits and payments (e.g. USDC, 6 decimals).
    IERC20 public immutable usdc;

    struct Plan {
        uint256 price; // token base units charged per BILLING_PERIOD
        bool active; // whether the plan accepts new subscriptions / plan changes
    }

    struct Account {
        uint256 balance; // escrowed USDC not yet earned by the operator
        uint256 planId; // current plan (meaningful only while subscribed)
        uint256 price; // price snapshotted at subscribe / last plan change
        uint256 lastAccrual; // timestamp accrual was last settled
        bool subscribed;
    }

    Plan[] public plans;

    mapping(address user => Account) internal _accounts;

    /// @notice Revenue accrued to the operator and available for withdrawal.
    uint256 public earned;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Subscribed(address indexed user, uint256 indexed planId, uint256 price);
    event PlanChanged(address indexed user, uint256 indexed planId, uint256 price);
    event Cancelled(address indexed user, uint256 refund);
    event Lapsed(address indexed user);
    event Settled(address indexed user, uint256 charged, uint256 remainingBalance);
    event EarnedWithdrawn(address indexed to, uint256 amount);
    event PlanUpdated(uint256 indexed planId, uint256 price, bool active);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error ZeroAddress();
    error ZeroAmount();
    error ZeroPrice();
    error UnknownPlan(uint256 planId);
    error PlanNotActive(uint256 planId);
    error AlreadySubscribed();
    error NotSubscribed();
    error InsufficientBalance(uint256 balance, uint256 required);
    error ExceedsEarned(uint256 earned, uint256 requested);

    // ------------------------------------------------------------------

    /// @param usdc_ Address of the USDC token contract for the target chain.
    /// @param owner_ Operator address (receives revenue, manages plans).
    /// @param hobbyPrice Price of the hobby plan per 30 days, in USDC base units (e.g. 5e6 = $5).
    /// @param proPrice Price of the pro plan per 30 days, in USDC base units (e.g. 20e6 = $20).
    constructor(address usdc_, address owner_, uint256 hobbyPrice, uint256 proPrice)
        Ownable(owner_)
    {
        if (usdc_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (hobbyPrice == 0 || proPrice == 0) revert ZeroPrice();
        usdc = IERC20(usdc_);
        plans.push(Plan({price: hobbyPrice, active: true}));
        plans.push(Plan({price: proPrice, active: true}));
    }

    // ------------------------------------------------------------------
    // Customer actions
    // ------------------------------------------------------------------

    /// @notice Top up escrowed balance with USDC. Requires prior `approve`.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        _accounts[msg.sender].balance += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw un-used escrow. Allowed at any time, even while subscribed;
    /// withdrawing to zero ends the subscription.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (a.balance < amount) revert InsufficientBalance(a.balance, amount);
        a.balance -= amount;
        if (a.subscribed && a.balance == 0) {
            a.subscribed = false;
            emit Lapsed(msg.sender);
        }
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Subscribe to a plan. The account must hold at least one full
    /// period of funding (plan price) in escrow.
    function subscribe(uint256 planId) external nonReentrant {
        Plan memory plan = _activePlan(planId);
        _settle(msg.sender); // no-op unless previously subscribed; lapses a depleted account
        Account storage a = _accounts[msg.sender];
        if (a.subscribed) revert AlreadySubscribed();
        if (a.balance < plan.price) revert InsufficientBalance(a.balance, plan.price);
        a.subscribed = true;
        a.planId = planId;
        a.price = plan.price;
        a.lastAccrual = block.timestamp;
        emit Subscribed(msg.sender, planId, plan.price);
    }

    /// @notice Switch plans mid-subscription. Accrual up to now is settled at the
    /// old rate; the new (snapshotted) rate applies from this block. Requires at
    /// least one period of the new plan funded.
    function changePlan(uint256 planId) external nonReentrant {
        Plan memory plan = _activePlan(planId);
        Account storage a = _accounts[msg.sender];
        if (!a.subscribed) revert NotSubscribed();
        _settle(msg.sender);
        if (a.balance < plan.price) revert InsufficientBalance(a.balance, plan.price);
        a.planId = planId;
        a.price = plan.price;
        emit PlanChanged(msg.sender, planId, plan.price);
    }

    /// @notice Cancel the subscription and refund everything not yet used:
    /// accrual is settled up to this second and the entire remaining escrow
    /// is returned to the customer in the same transaction.
    function cancel() external nonReentrant returns (uint256 refund) {
        Account storage a = _accounts[msg.sender];
        if (!a.subscribed) revert NotSubscribed();
        _settle(msg.sender);
        a.subscribed = false;
        refund = a.balance;
        a.balance = 0;
        if (refund > 0) {
            usdc.safeTransfer(msg.sender, refund);
        }
        emit Cancelled(msg.sender, refund);
    }

    // ------------------------------------------------------------------
    // Settlement (permissionless — call for any account, e.g. from a keeper)
    // ------------------------------------------------------------------

    /// @notice Realize accrued charges for one account. Optional for access
    /// checks (`isActive` accounts for elapsed time on its own); needed to
    /// move accrued funds into the operator's withdrawable `earned` balance
    /// and to finalize lapsed subscriptions in storage.
    function settle(address user) external {
        _settle(user);
    }

    /// @notice Batch version of `settle`, for keeper loops.
    function settleMany(address[] calldata users) external {
        uint256 n = users.length;
        for (uint256 i = 0; i < n; ++i) {
            _settle(users[i]);
        }
    }

    // ------------------------------------------------------------------
    // Views (the backend access check)
    // ------------------------------------------------------------------

    /// @notice Whether `user` is currently subscribed. This is the per-request
    /// check the API backend should call. True while subscribed with a
    /// positive remaining balance after accounting for accrual up to now.
    function isActive(address user) external view returns (bool) {
        return _accounts[user].subscribed && currentBalance(user) > 0;
    }

    /// @notice Charge accrued since the last settlement, capped at the balance.
    function pendingCharge(address user) public view returns (uint256) {
        Account storage a = _accounts[user];
        if (!a.subscribed) return 0;
        uint256 charge = (a.price * (block.timestamp - a.lastAccrual)) / BILLING_PERIOD;
        return charge > a.balance ? a.balance : charge;
    }

    /// @notice Balance remaining after accrual up to now (what a cancel would refund).
    function currentBalance(address user) public view returns (uint256) {
        return _accounts[user].balance - pendingCharge(user);
    }

    /// @notice Raw stored account state (not settled to the current block).
    function getAccount(address user) external view returns (Account memory) {
        return _accounts[user];
    }

    function planCount() external view returns (uint256) {
        return plans.length;
    }

    // ------------------------------------------------------------------
    // Operator actions
    // ------------------------------------------------------------------

    /// @notice Withdraw accrued revenue. Can never touch customer escrow.
    function withdrawEarned(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > earned) revert ExceedsEarned(earned, amount);
        earned -= amount;
        usdc.safeTransfer(to, amount);
        emit EarnedWithdrawn(to, amount);
    }

    /// @notice Update a plan's price and/or availability. Applies only to new
    /// subscriptions and plan changes — existing subscribers keep their
    /// snapshotted price.
    function setPlan(uint256 planId, uint256 price, bool active) external onlyOwner {
        if (planId >= plans.length) revert UnknownPlan(planId);
        if (price == 0) revert ZeroPrice();
        plans[planId] = Plan({price: price, active: active});
        emit PlanUpdated(planId, price, active);
    }

    /// @notice Add a new plan. Returns its id.
    function addPlan(uint256 price) external onlyOwner returns (uint256 planId) {
        if (price == 0) revert ZeroPrice();
        planId = plans.length;
        plans.push(Plan({price: price, active: true}));
        emit PlanUpdated(planId, price, true);
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _activePlan(uint256 planId) internal view returns (Plan memory plan) {
        if (planId >= plans.length) revert UnknownPlan(planId);
        plan = plans[planId];
        if (!plan.active) revert PlanNotActive(planId);
    }

    /// @dev Moves accrual up to now from the account's escrow into `earned`.
    /// Depleted accounts lapse. Division rounds down, i.e. in the customer's favor.
    function _settle(address user) internal {
        Account storage a = _accounts[user];
        if (!a.subscribed) return;
        uint256 elapsed = block.timestamp - a.lastAccrual;
        if (elapsed == 0) return;
        uint256 charge = (a.price * elapsed) / BILLING_PERIOD;
        if (charge >= a.balance) {
            earned += a.balance;
            emit Settled(user, a.balance, 0);
            a.balance = 0;
            a.subscribed = false;
            emit Lapsed(user);
        } else {
            a.balance -= charge;
            earned += charge;
            emit Settled(user, charge, a.balance);
        }
        a.lastAccrual = block.timestamp;
    }
}
