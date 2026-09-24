// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, continuously-metered subscriptions denominated in an ERC-20 (USDC).
///
/// @dev Design note — why there is no "monthly charge" transaction.
///
/// A contract cannot call itself. There is no cron, no scheduler, nothing that wakes up on the
/// 1st of the month to debit a customer. Any design with a literal monthly charge needs someone
/// to send a transaction per customer per month, and needs an answer for what happens when that
/// someone is offline, out of gas, or gone.
///
/// So the subscription price accrues by the second instead:
///
///     owed(user) = planPrice * (now - lastTick) / 30 days   (capped at their balance)
///
/// Nobody has to poke anything for that number to be correct. `isSubscribed` is a pure read of
/// current time, so a customer who runs out of funds lapses on their own, with no transaction
/// from anyone. The only transaction the merchant ever *needs* to send is `settle`, which moves
/// already-earned revenue out of the contract — and the incentive there is obvious, it is their
/// money. Delaying it costs them nothing but time; the claim is recorded either way.
///
/// This also gives exact prorated refunds for free: cancelling stops the accrual clock, and
/// whatever has not accrued was never the merchant's to begin with.
///
/// Trust model: the owner sets where *earned* revenue is sent and which plans accept new
/// signups. The owner can NOT touch unearned customer balances, cannot change the price of a
/// plan anyone is already on, and cannot stop a customer from cancelling or withdrawing.
/// There is no pause and no upgrade path. If the owner's key is lost, every customer can still
/// get their unused funds out.
contract SubscriptionBilling is Ownable2Step {
    using SafeERC20 for IERC20;

    /// @notice The billing period a plan price is quoted in. "$5/month" means $5 per 30 days.
    uint256 public constant PERIOD = 30 days;

    /// @notice A new subscription must be funded for at least this long, so it cannot be created
    /// already-lapsed (which would be a confusing state for a customer to land in).
    uint256 public constant MIN_RUNWAY = 1 days;

    struct Plan {
        /// @dev Price per PERIOD, in token units. Immutable once the plan exists.
        uint128 price;
        /// @dev Whether the plan accepts *new* subscribers. Never affects existing ones.
        bool open;
    }

    struct Account {
        /// @dev Prepaid balance not yet earned by the merchant, as of `lastTick`.
        uint128 balance;
        /// @dev 0 means "not subscribed". Otherwise an index into `plans`.
        uint64 planId;
        /// @dev Timestamp accrual was last swept out of `balance`.
        uint64 lastTick;
    }

    IERC20 public immutable token;

    /// @notice Where settled revenue is sent. Only ever receives funds the merchant has earned.
    address public treasury;

    /// @notice Revenue that has been settled out of customer balances but not yet swept.
    uint256 public collected;

    /// @dev Index 0 is a reserved sentinel meaning "no plan".
    Plan[] internal _plans;

    mapping(address => Account) internal _accounts;

    event PlanAdded(uint256 indexed planId, uint128 price);
    event PlanOpenSet(uint256 indexed planId, bool open);
    event TreasurySet(address indexed treasury);
    event Deposited(address indexed user, address indexed payer, uint256 amount, uint128 balance);
    event Withdrawn(address indexed user, uint256 amount, uint128 balance);
    event Subscribed(address indexed user, uint256 indexed planId, uint256 subscribedUntil);
    event Cancelled(address indexed user, uint256 indexed planId, uint128 refundable);
    event Settled(address indexed user, uint256 amount, uint64 tick);
    event Swept(address indexed treasury, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error NoSuchPlan();
    error PlanClosed();
    error AlreadyOnPlan();
    error NotSubscribed();
    error InsufficientRunway();
    error InsufficientBalance();
    error AmountTooLarge();

    constructor(IERC20 token_, address treasury_, address owner_, uint128[] memory prices)
        Ownable(owner_)
    {
        if (address(token_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        token = token_;
        treasury = treasury_;
        emit TreasurySet(treasury_);

        _plans.push(Plan({price: 0, open: false})); // sentinel
        for (uint256 i = 0; i < prices.length; i++) {
            _addPlan(prices[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Reads — these are what the API backend calls. No transaction, no gas.
    // ---------------------------------------------------------------------

    /// @notice The single question the backend asks per request: may this address use the API?
    function isSubscribed(address user) public view returns (bool) {
        return block.timestamp < subscribedUntil(user);
    }

    /// @notice Timestamp the account's prepaid balance runs out at, 0 if not subscribed.
    /// @dev The backend should cache on this: nothing can move this timestamp *earlier* except
    /// the customer themselves (by withdrawing or cancelling), so caching until it passes is
    /// safe against everyone but a customer racing their own refund.
    function subscribedUntil(address user) public view returns (uint256) {
        Account memory a = _accounts[user];
        if (a.planId == 0) return 0;
        uint256 price = _plans[a.planId].price;
        if (price == 0) return type(uint256).max;
        return a.lastTick + (uint256(a.balance) * PERIOD) / price;
    }

    /// @notice Revenue this account has accrued but not yet settled to the merchant.
    function pending(address user) public view returns (uint256) {
        return _pending(_accounts[user]);
    }

    /// @notice What the customer would get back if they cancelled and withdrew right now.
    function refundable(address user) public view returns (uint256) {
        Account memory a = _accounts[user];
        return a.balance - _pending(a);
    }

    function accountOf(address user) external view returns (Account memory) {
        return _accounts[user];
    }

    function planOf(uint256 planId) external view returns (Plan memory) {
        if (planId == 0 || planId >= _plans.length) revert NoSuchPlan();
        return _plans[planId];
    }

    function planCount() external view returns (uint256) {
        return _plans.length - 1;
    }

    // ---------------------------------------------------------------------
    // Customer actions
    // ---------------------------------------------------------------------

    /// @notice Top up your own account. Requires an ERC-20 approval for `amount` first.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's account (useful for onboarding or support credits).
    function depositFor(address user, uint256 amount) external {
        if (user == address(0)) revert ZeroAddress();
        _deposit(user, amount);
    }

    /// @notice Start a subscription, or switch plans. Accrual on the old plan is settled first,
    /// so a switch is charged exactly at the old price up to this second and the new price after.
    function subscribe(uint256 planId) external {
        if (planId == 0 || planId >= _plans.length) revert NoSuchPlan();
        Plan memory p = _plans[planId];
        if (!p.open) revert PlanClosed();

        Account storage a = _accounts[msg.sender];
        if (a.planId == planId) revert AlreadyOnPlan();
        _settle(msg.sender);

        // casts are safe: planId is bounded by _plans.length, and a uint64 timestamp does not
        // overflow until the year 2554.
        // forge-lint: disable-next-line(unsafe-typecast)
        a.planId = uint64(planId);
        // forge-lint: disable-next-line(unsafe-typecast)
        a.lastTick = uint64(block.timestamp);

        uint256 until_ = subscribedUntil(msg.sender);
        if (until_ < block.timestamp + MIN_RUNWAY) revert InsufficientRunway();
        emit Subscribed(msg.sender, planId, until_);
    }

    /// @notice Cancel. Stops the accrual clock immediately; everything unused stays yours and is
    /// withdrawable. No notice period, no approval from anyone, no way for the merchant to block it.
    function cancel() public {
        Account storage a = _accounts[msg.sender];
        uint256 planId = a.planId;
        if (planId == 0) revert NotSubscribed();
        _settle(msg.sender);
        a.planId = 0;
        emit Cancelled(msg.sender, planId, a.balance);
    }

    /// @notice Withdraw unused funds. Allowed while still subscribed — but draining the balance
    /// ends the subscription the moment it no longer covers accrual.
    function withdraw(uint256 amount) public {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (amount > a.balance) revert InsufficientBalance();
        // casting to 'uint128' is safe because amount <= a.balance, itself a uint128.
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance -= uint128(amount);
        emit Withdrawn(msg.sender, amount, a.balance);
        token.safeTransfer(msg.sender, amount);
    }

    /// @notice Cancel and take the prorated refund in one transaction.
    function cancelAndWithdrawAll() external {
        cancel();
        uint256 bal = _accounts[msg.sender].balance;
        if (bal > 0) withdraw(bal);
    }

    // ---------------------------------------------------------------------
    // Revenue — permissionless on purpose. Funds can only move toward the treasury,
    // so letting anyone call these removes the merchant as a point of failure.
    // ---------------------------------------------------------------------

    /// @notice Move `user`'s accrued revenue out of their balance and into `collected`.
    function settle(address user) external {
        _settle(user);
    }

    function settleMany(address[] calldata users) external {
        for (uint256 i = 0; i < users.length; i++) {
            _settle(users[i]);
        }
    }

    /// @notice Send all settled revenue to the treasury. Callable by anyone; only the treasury
    /// can ever receive it.
    function sweep() external returns (uint256 amount) {
        amount = collected;
        if (amount == 0) revert ZeroAmount();
        collected = 0;
        emit Swept(treasury, amount);
        token.safeTransfer(treasury, amount);
    }

    // ---------------------------------------------------------------------
    // Owner — deliberately narrow. See the trust model note at the top.
    // ---------------------------------------------------------------------

    /// @notice Add a plan. Prices are immutable once added; repricing means adding a new plan,
    /// which existing subscribers opt into or ignore. Nobody gets repriced under their feet.
    function addPlan(uint128 price) external onlyOwner returns (uint256) {
        return _addPlan(price);
    }

    /// @notice Open or close a plan to *new* signups. Existing subscribers are untouched and
    /// keep accruing at their price until they choose to leave.
    function setPlanOpen(uint256 planId, bool open) external onlyOwner {
        if (planId == 0 || planId >= _plans.length) revert NoSuchPlan();
        _plans[planId].open = open;
        emit PlanOpenSet(planId, open);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _pending(Account memory a) internal view returns (uint256 owed) {
        if (a.planId == 0) return 0;
        uint256 price = _plans[a.planId].price;
        owed = (price * (block.timestamp - a.lastTick)) / PERIOD;
        if (owed > a.balance) owed = a.balance; // a customer can never owe more than they prepaid
    }

    /// @dev Every balance-changing path calls this first. That keeps `lastTick` honest: an
    /// account that lapsed and is later topped up resumes from now, and is not retroactively
    /// billed for the stretch it spent unfunded (accrual was capped at the balance it had).
    function _settle(address user) internal {
        Account storage a = _accounts[user];
        if (a.planId == 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            a.lastTick = uint64(block.timestamp);
            return;
        }
        uint256 owed = _pending(a);
        // casting to 'uint128' is safe because _pending caps owed at a.balance.
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance -= uint128(owed);
        // forge-lint: disable-next-line(unsafe-typecast)
        a.lastTick = uint64(block.timestamp);
        if (owed > 0) {
            collected += owed;
            // forge-lint: disable-next-line(unsafe-typecast)
            emit Settled(user, owed, uint64(block.timestamp));
        }
    }

    function _deposit(address user, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint128).max) revert AmountTooLarge();
        _settle(user);
        Account storage a = _accounts[user];
        // casting to 'uint128' is safe because of the bound checked directly above; the `+=`
        // itself is checked arithmetic and reverts on overflow.
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance += uint128(amount);
        emit Deposited(user, msg.sender, amount, a.balance);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function _addPlan(uint128 price) internal returns (uint256 planId) {
        if (price == 0) revert ZeroAmount();
        _plans.push(Plan({price: price, open: true}));
        planId = _plans.length - 1;
        emit PlanAdded(planId, price);
        emit PlanOpenSet(planId, true);
    }
}
