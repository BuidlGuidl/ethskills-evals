// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ISubscriptionBilling} from "./interfaces/ISubscriptionBilling.sol";

/**
 * @title SubscriptionBilling
 * @notice Prepaid, self-serve subscription billing in USDC for an API service.
 *
 * @dev How it works
 *
 * A customer deposits USDC into their account inside this contract, then picks a plan. Plan prices
 * are quoted per 30-day period ($5 hobby, $20 pro), but the charge *accrues by the second* out of
 * the deposited balance rather than being taken in one lump on a monthly boundary. The subscription
 * stays live for exactly as long as the balance can pay for it.
 *
 * That single decision is what makes the rest of the requirements fall out for free:
 *
 *  - "charged monthly for as long as they keep the subscription" — a full 30 days of service costs
 *    exactly the plan price, and it keeps going, period after period, until they stop it or run dry.
 *  - "cancel whenever and get back what they haven't used" — cancelling settles the seconds actually
 *    consumed and leaves the rest as a withdrawable balance. No refund queue, no operator action.
 *  - "check per request whether an address is subscribed" — `isSubscribed` is a pure view over
 *    timestamps and a balance. No keeper has to have run for the answer to be correct, which matters:
 *    a cron-driven "charge on the 1st" design silently stops billing the day the cron breaks.
 *
 * The operator sweeps accrued revenue with `settle`/`settleMany` whenever convenient. Settling late
 * costs nothing — accrued funds cannot be withdrawn by the customer, because every path that touches
 * a balance settles first.
 *
 * Trust model: the owner can add plans, deactivate plans, pause *new* spending, and withdraw revenue
 * that has actually accrued. The owner can never touch an unspent customer balance, and cannot pause
 * `cancel` or `withdraw` — customers can always exit.
 */
contract SubscriptionBilling is ISubscriptionBilling, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice "A month" for pricing purposes. A fixed 30 days, not a calendar month, so that the
    ///         per-second rate is constant and the contract never needs a calendar.
    uint256 public constant BILLING_PERIOD = 30 days;

    /// @dev Fixed-point scale for the per-second rate. $5 / 30 days is ~1.929 base units per second,
    ///      which truncates to 1 in integer math — a 48% underbill. Rates are therefore stored
    ///      scaled by 1e18 and divided back out only after multiplying by elapsed seconds.
    uint256 internal constant RATE_SCALE = 1e18;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @param price  Cost of one BILLING_PERIOD, in token base units (6 decimals for USDC).
    /// @param active Whether new subscriptions may be opened on this plan.
    struct Plan {
        uint128 price;
        bool active;
    }

    /// @dev Packed into one slot; `ratePerSecond` occupies the next.
    struct Account {
        uint32 planId;
        uint64 lastSettled;
        bool subscribed;
        uint128 balance;
        uint256 ratePerSecond; // RATE_SCALE-scaled, snapshotted when the subscription opened
    }

    /// @notice The USDC (or other 6-decimal ERC-20) contract used for all payments.
    IERC20 public immutable token;

    /// @notice Plans by id. Prices are immutable once created; repricing means adding a new plan.
    Plan[] internal _plans;

    mapping(address => Account) internal _accounts;

    /// @notice Sum of all customer balances. Everything above this (minus `earned`) is a stray
    ///         transfer and can be swept; see `sweepSurplus`.
    uint256 public totalCustomerBalance;

    /// @notice Revenue that has accrued and been settled, awaiting withdrawal by the operator.
    uint256 public earned;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PlanAdded(uint32 indexed planId, uint128 price);
    event PlanActiveSet(uint32 indexed planId, bool active);
    event Deposited(address indexed user, address indexed payer, uint256 amount, uint256 balance);
    event Withdrawn(address indexed user, address indexed to, uint256 amount, uint256 balance);
    event Subscribed(address indexed user, uint32 indexed planId, uint256 ratePerSecond, uint64 expiresAt);
    event Cancelled(address indexed user, uint32 indexed planId, uint256 refundableBalance);
    event Settled(address indexed user, uint256 amount, uint256 balance);
    /// @notice The balance ran out mid-subscription; service has lapsed. Emitted at settle time,
    ///         which may be well after the lapse actually happened.
    event Lapsed(address indexed user, uint32 indexed planId);
    event EarningsWithdrawn(address indexed to, uint256 amount);
    event SurplusSwept(address indexed to, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error ZeroAmount();
    error UnknownPlan(uint32 planId);
    error PlanNotAvailable(uint32 planId);
    error InsufficientBalance(uint256 available, uint256 required);
    error NotSubscribed();
    error AlreadyOnPlan(uint32 planId);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param usdc         Payment token. USDC on the target chain.
    /// @param owner_       Operator address. Should be a multisig on mainnet deployments.
    /// @param initialPrices Plan prices in base units, in id order. Pass [5e6, 20e6] for $5 / $20.
    constructor(IERC20 usdc, address owner_, uint128[] memory initialPrices) Ownable(owner_) {
        if (address(usdc) == address(0)) revert ZeroAddress();
        token = usdc;
        for (uint256 i; i < initialPrices.length; ++i) {
            _addPlan(initialPrices[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          CUSTOMER: FUNDING
    //////////////////////////////////////////////////////////////*/

    /// @notice Top up your own account.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's account — useful for sponsoring a user or for a fiat on-ramp
    ///         that settles on their behalf.
    function depositFor(address user, uint256 amount) external {
        if (user == address(0)) revert ZeroAddress();
        _deposit(user, amount);
    }

    /// @notice Top up in a single transaction using an EIP-2612 signature instead of a prior
    ///         `approve`. USDC supports permit on mainnet and Base.
    /// @dev The permit is executed in a try/catch so a front-run permit (which would revert on
    ///      nonce reuse) cannot grief the deposit; the transfer below still enforces the allowance.
    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        try IERC20Permit(address(token)).permit(msg.sender, address(this), amount, deadline, v, r, s) {}
            catch {}
        _deposit(msg.sender, amount);
    }

    /// @notice Withdraw unused credit. Always available, even while paused or subscribed.
    /// @dev Settles first, so only genuinely unused funds can leave. Withdrawing while subscribed
    ///      shortens `expiresAt`; withdrawing everything ends service immediately.
    function withdraw(uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (a.balance < amount) revert InsufficientBalance(a.balance, amount);

        unchecked {
            a.balance -= uint128(amount);
        }
        totalCustomerBalance -= amount;

        emit Withdrawn(msg.sender, to, amount, a.balance);
        token.safeTransfer(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        CUSTOMER: SUBSCRIPTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Start a subscription, or switch plans. Switching settles the old plan pro-rata and
    ///         starts charging the new rate from this second on — no double charge, no lost credit.
    /// @dev Requires a full period of credit up front, which is what "pay monthly in advance" means
    ///      here, and stops accounts being opened with a balance that expires in an hour.
    function subscribe(uint32 planId) external whenNotPaused {
        _subscribe(msg.sender, planId);
    }

    /// @notice Deposit and subscribe in one transaction. The common first-time path.
    function depositAndSubscribe(uint256 amount, uint32 planId) external whenNotPaused {
        _deposit(msg.sender, amount);
        _subscribe(msg.sender, planId);
    }

    /// @notice Cancel. Stops the meter at this second; everything unused stays yours to withdraw.
    function cancel() external {
        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (!a.subscribed) revert NotSubscribed();

        uint32 planId = a.planId;
        a.subscribed = false;
        a.ratePerSecond = 0;

        emit Cancelled(msg.sender, planId, a.balance);
    }

    /// @notice Cancel and take the unused balance back in one transaction.
    function cancelAndWithdraw() external nonReentrant {
        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (!a.subscribed) revert NotSubscribed();

        uint32 planId = a.planId;
        a.subscribed = false;
        a.ratePerSecond = 0;
        uint256 refund = a.balance;
        emit Cancelled(msg.sender, planId, refund);

        if (refund != 0) {
            a.balance = 0;
            totalCustomerBalance -= refund;
            emit Withdrawn(msg.sender, msg.sender, refund, 0);
            token.safeTransfer(msg.sender, refund);
        }
    }

    /*//////////////////////////////////////////////////////////////
                              SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Move everything a customer has used so far from their balance into operator revenue.
    /// @dev Permissionless and idempotent. Purely an accounting move — it cannot end a subscription
    ///      early or charge for time not yet elapsed, so it is safe for anyone to call.
    function settle(address user) external {
        _settle(user);
    }

    /// @notice Batch version, for the operator's periodic sweep.
    function settleMany(address[] calldata users) external {
        for (uint256 i; i < users.length; ++i) {
            _settle(users[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                           BACKEND READ PATH
    //////////////////////////////////////////////////////////////*/

    /// @notice The per-request gate. True iff `user` is subscribed and has credit left right now.
    function isSubscribed(address user) public view returns (bool) {
        Account storage a = _accounts[user];
        return a.subscribed && block.timestamp < _expiresAt(a);
    }

    /// @notice Gate that also pins the tier, for endpoints or rate limits that are pro-only.
    function isSubscribedTo(address user, uint32 planId) external view returns (bool) {
        return _accounts[user].planId == planId && isSubscribed(user);
    }

    /// @notice Everything the backend or a dashboard needs in one call.
    function statusOf(address user) external view returns (Status memory) {
        Account storage a = _accounts[user];
        uint256 accrued = _accrued(a);
        return Status({
            subscribed: isSubscribed(user),
            planId: a.planId,
            expiresAt: _expiresAt(a),
            balance: a.balance - accrued,
            accrued: accrued
        });
    }

    /// @notice Batch gate: one RPC call for many addresses.
    function areSubscribed(address[] calldata users) external view returns (bool[] memory out) {
        out = new bool[](users.length);
        for (uint256 i; i < users.length; ++i) {
            out[i] = isSubscribed(users[i]);
        }
    }

    /// @notice When the current balance runs out at the current rate. 0 if not subscribed.
    function expiresAt(address user) external view returns (uint64) {
        return _expiresAt(_accounts[user]);
    }

    /// @notice Credit remaining, net of time already used but not yet settled.
    function balanceOf(address user) external view returns (uint256) {
        Account storage a = _accounts[user];
        return a.balance - _accrued(a);
    }

    /// @notice Used-but-unsettled revenue for one customer.
    function accruedOf(address user) external view returns (uint256) {
        return _accrued(_accounts[user]);
    }

    function plans() external view returns (Plan[] memory) {
        return _plans;
    }

    function planCount() external view returns (uint256) {
        return _plans.length;
    }

    function planPrice(uint32 planId) external view returns (uint128) {
        return _getPlan(planId).price;
    }

    /*//////////////////////////////////////////////////////////////
                               OPERATOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Add a plan. Prices are immutable by design: an existing subscriber's rate is
    ///         snapshotted at subscribe time, so repricing means adding a new plan and steering new
    ///         signups to it, not silently changing what a live customer pays.
    function addPlan(uint128 price) external onlyOwner returns (uint32 planId) {
        return _addPlan(price);
    }

    /// @notice Open or close a plan to new subscriptions. Existing subscribers are unaffected and
    ///         keep running until they cancel or run out.
    function setPlanActive(uint32 planId, bool active) external onlyOwner {
        _getPlan(planId); // bounds check
        _plans[planId].active = active;
        emit PlanActiveSet(planId, active);
    }

    /// @notice Withdraw settled revenue.
    /// @param to Explicit destination, so revenue is still recoverable if the owner address itself
    ///           ends up on the USDC blocklist.
    function withdrawEarnings(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > earned) revert InsufficientBalance(earned, amount);
        earned -= amount;
        emit EarningsWithdrawn(to, amount);
        token.safeTransfer(to, amount);
    }

    /// @notice Stop new deposits and new subscriptions. Withdrawals, cancellation and settlement
    ///         stay open — a pause must never trap customer funds. Live subscriptions keep running.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Tokens sitting in the contract that belong to neither a customer nor accrued revenue
    ///         — i.e. someone transferred USDC straight in instead of calling `deposit`.
    function surplus() external view returns (uint256) {
        return token.balanceOf(address(this)) - totalCustomerBalance - earned;
    }

    /// @notice Recover a stray transfer. Cannot touch customer balances or unsettled accruals.
    function sweepSurplus(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = token.balanceOf(address(this)) - totalCustomerBalance - earned;
        if (amount == 0) revert ZeroAmount();
        emit SurplusSwept(to, amount);
        token.safeTransfer(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                               INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _addPlan(uint128 price) internal returns (uint32 planId) {
        if (price == 0) revert ZeroAmount();
        planId = uint32(_plans.length);
        _plans.push(Plan({price: price, active: true}));
        emit PlanAdded(planId, price);
        emit PlanActiveSet(planId, true);
    }

    function _getPlan(uint32 planId) internal view returns (Plan memory) {
        if (planId >= _plans.length) revert UnknownPlan(planId);
        return _plans[planId];
    }

    function _deposit(address user, uint256 amount) internal whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Settle before crediting. Without this, an account that lapsed some time ago would have a
        // stale `lastSettled`, and the fresh top-up would immediately be eaten paying for the gap
        // during which no service was provided.
        _settle(user);

        Account storage a = _accounts[user];
        a.balance += uint128(amount);
        totalCustomerBalance += amount;

        emit Deposited(user, msg.sender, amount, a.balance);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function _subscribe(address user, uint32 planId) internal {
        Plan memory plan = _getPlan(planId);
        if (!plan.active) revert PlanNotAvailable(planId);

        _settle(user);
        Account storage a = _accounts[user];
        if (a.subscribed && a.planId == planId) revert AlreadyOnPlan(planId);
        if (a.balance < plan.price) revert InsufficientBalance(a.balance, plan.price);

        uint256 rate = (uint256(plan.price) * RATE_SCALE) / BILLING_PERIOD;
        a.planId = planId;
        a.subscribed = true;
        a.ratePerSecond = rate;
        a.lastSettled = uint64(block.timestamp);

        emit Subscribed(user, planId, rate, _expiresAt(a));
    }

    /// @dev Accrual is capped at the balance, so a customer can never go into debt and the contract
    ///      can never promise revenue it does not hold.
    function _accrued(Account storage a) internal view returns (uint256) {
        if (!a.subscribed) return 0;
        uint256 owed = ((block.timestamp - a.lastSettled) * a.ratePerSecond) / RATE_SCALE;
        return owed > a.balance ? a.balance : owed;
    }

    function _settle(address user) internal {
        Account storage a = _accounts[user];
        if (!a.subscribed) {
            // Keep the clock fresh so a later `subscribe` starts from now.
            a.lastSettled = uint64(block.timestamp);
            return;
        }

        uint256 owed = ((block.timestamp - a.lastSettled) * a.ratePerSecond) / RATE_SCALE;
        uint256 amount = owed > a.balance ? a.balance : owed;

        a.lastSettled = uint64(block.timestamp);
        if (amount != 0) {
            unchecked {
                a.balance -= uint128(amount);
            }
            totalCustomerBalance -= amount;
            earned += amount;
            emit Settled(user, amount, a.balance);
        }
        if (owed > amount) emit Lapsed(user, a.planId);
    }

    function _expiresAt(Account storage a) internal view returns (uint64) {
        if (!a.subscribed) return 0;
        // Rounds down, so the reported expiry is never later than the balance can actually fund.
        uint256 fundedSeconds = (uint256(a.balance) * RATE_SCALE) / a.ratePerSecond;
        uint256 t = uint256(a.lastSettled) + fundedSeconds;
        return t > type(uint64).max ? type(uint64).max : uint64(t);
    }
}
