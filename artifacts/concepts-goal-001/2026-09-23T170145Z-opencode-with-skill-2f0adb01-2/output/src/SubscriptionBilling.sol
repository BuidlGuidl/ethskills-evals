// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface. USDC's transfer/transferFrom return bool,
///         so this is sufficient for real USDC on every major chain.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SubscriptionBilling
/// @notice Prepaid USDC subscription billing with continuous (per-second) accrual.
///
/// DESIGN NOTES — why there is no monthly charge function:
/// Smart contracts cannot execute themselves. There is no cron on Ethereum, so a
/// "charge everyone monthly" function would need someone to call it and pay gas
/// for every subscriber. Instead, balances burn down per second and settlement
/// is computed lazily: every touch (subscribe, topUp, changePlan, cancel, or an
/// explicit settle) brings the account up to date, and the view functions
/// (isSubscribed, remainingBalance) project the balance as of right now. The
/// state your backend reads is always correct without anyone poking anything.
/// The owner collects revenue via accruedFees whenever they feel like it.
contract SubscriptionBilling {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Subscription {
        Plan plan;
        uint256 balance; // unspent USDC remaining (6 decimals)
        uint256 lastSettled; // timestamp the balance was last charged through
    }

    // Prices in USDC (6 decimals) per BILLING_PERIOD. Fixed at deploy time:
    // changing prices later would rewrite the deal for existing subscribers.
    uint256 public constant HOBBY_PRICE = 5e6; // $5
    uint256 public constant PRO_PRICE = 20e6; // $20
    uint256 public constant BILLING_PERIOD = 30 days;

    IERC20 public immutable usdc;
    address public immutable owner;

    mapping(address => Subscription) public subscriptions;

    // Fees settled so far and not yet withdrawn by the owner. User principal
    // (Subscription.balance) is never mixed into this and the owner cannot
    // touch it — users can always cancel and withdraw their unspent balance.
    uint256 public accruedFees;

    event Subscribed(address indexed user, Plan plan, uint256 amount);
    event ToppedUp(address indexed user, uint256 amount);
    event PlanChanged(address indexed user, Plan plan);
    event Cancelled(address indexed user, uint256 refund);
    event Settled(address indexed user, uint256 charged);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error InvalidPlan();
    error ZeroAmount();
    error AlreadySubscribed();
    error NotSubscribed();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_) {
        require(usdc_ != address(0), "usdc required");
        usdc = IERC20(usdc_);
        owner = msg.sender;
    }

    /// @notice Start a subscription with an initial USDC top-up.
    ///         Caller must have approved this contract to spend `amount` USDC.
    function subscribe(Plan plan, uint256 amount) external {
        if (plan == Plan.None) revert InvalidPlan();
        if (amount == 0) revert ZeroAmount();
        Subscription storage sub = subscriptions[msg.sender];
        // Allow re-subscribing after a lapse or cancellation, not while active.
        if (sub.plan != Plan.None && _projectedBalance(sub) > 0) {
            revert AlreadySubscribed();
        }

        sub.plan = plan;
        sub.balance = amount;
        sub.lastSettled = block.timestamp;

        // Event before the external call: if the transfer reverts, the whole
        // transaction (and the event) reverts with it.
        emit Subscribed(msg.sender, plan, amount);
        _pull(msg.sender, amount);
    }

    /// @notice Add USDC to an existing (active or lapsed) subscription.
    ///         If the subscription had lapsed, the clock restarts at now —
    ///         back-debt is never charged.
    function topUp(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Subscription storage sub = subscriptions[msg.sender];
        if (sub.plan == Plan.None) revert NotSubscribed();

        _settle(sub, msg.sender);
        if (sub.balance == 0) {
            // Lapsed: restart the clock from now rather than charging
            // for the inactive gap.
            sub.lastSettled = block.timestamp;
        }
        sub.balance += amount;

        emit ToppedUp(msg.sender, amount);
        _pull(msg.sender, amount);
    }

    /// @notice Switch between Hobby and Pro. Settles at the old rate first.
    function changePlan(Plan newPlan) external {
        if (newPlan == Plan.None) revert InvalidPlan();
        Subscription storage sub = subscriptions[msg.sender];
        if (sub.plan == Plan.None) revert NotSubscribed();

        _settle(sub, msg.sender);
        if (sub.balance == 0) {
            sub.lastSettled = block.timestamp;
        }
        sub.plan = newPlan;
        emit PlanChanged(msg.sender, newPlan);
    }

    /// @notice Cancel the subscription and refund everything unspent.
    function cancel() external {
        Subscription storage sub = subscriptions[msg.sender];
        if (sub.plan == Plan.None) revert NotSubscribed();

        _settle(sub, msg.sender);
        uint256 refund = sub.balance;
        sub.plan = Plan.None;
        sub.balance = 0;
        sub.lastSettled = block.timestamp;

        emit Cancelled(msg.sender, refund);
        if (refund > 0) {
            if (!usdc.transfer(msg.sender, refund)) revert TransferFailed();
        }
    }

    /// @notice Permissionless settle. Anyone can poke an account to bring it
    ///         up to date. In practice the owner calls this (it's their
    ///         revenue), but nothing breaks if nobody ever does — the view
    ///         functions project the same numbers on read.
    function settle(address user) external {
        Subscription storage sub = subscriptions[user];
        if (sub.plan == Plan.None) revert NotSubscribed();
        _settle(sub, user);
    }

    /// @notice Withdraw fees accrued so far. Owner only; user principal is
    ///         unreachable by this function.
    function withdrawFees(address to) external onlyOwner {
        uint256 amount = accruedFees;
        if (amount == 0) return;
        accruedFees = 0;
        emit FeesWithdrawn(to, amount);
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }

    /// @notice What your backend checks per request. True while the account
    ///         has an active plan and its projected balance hasn't run out.
    ///         This is a view function — calling it costs no gas (eth_call).
    function isSubscribed(address user) external view returns (bool) {
        Subscription storage sub = subscriptions[user];
        return sub.plan != Plan.None && _projectedBalance(sub) > 0;
    }

    /// @notice Projected unspent balance right now, after burn-down.
    function remainingBalance(address user) external view returns (uint256) {
        return _projectedBalance(subscriptions[user]);
    }

    /// @notice Seconds until the balance runs out at the current plan's rate.
    ///         Returns 0 if not subscribed or already out of funds.
    function secondsUntilLapse(address user) external view returns (uint256) {
        Subscription storage sub = subscriptions[user];
        uint256 projected = _projectedBalance(sub);
        if (sub.plan == Plan.None || projected == 0) return 0;
        return (projected * BILLING_PERIOD) / _price(sub.plan);
    }

    function _price(Plan plan) internal pure returns (uint256) {
        return plan == Plan.Hobby ? HOBBY_PRICE : PRO_PRICE;
    }

    /// @dev Cost accrued between lastSettled and now. Computed as
    ///      elapsed * price / period so no precision is lost to rounding
    ///      (the truncation favors the subscriber by sub-wei dust).
    function _accrued(Subscription storage sub) internal view returns (uint256) {
        if (sub.plan == Plan.None || block.timestamp <= sub.lastSettled) {
            return 0;
        }
        uint256 elapsed = block.timestamp - sub.lastSettled;
        return (elapsed * _price(sub.plan)) / BILLING_PERIOD;
    }

    function _projectedBalance(Subscription storage sub)
        internal
        view
        returns (uint256)
    {
        uint256 due = _accrued(sub);
        return due >= sub.balance ? 0 : sub.balance - due;
    }

    /// @dev Bring an account up to date: move what it owes into accruedFees.
    ///      If the balance can't cover the full elapsed time, the balance
    ///      zeroes out — the subscription lapses, no debt is carried.
    function _settle(Subscription storage sub, address user) internal {
        uint256 due = _accrued(sub);
        if (due == 0) return;

        uint256 charged = due > sub.balance ? sub.balance : due;
        sub.balance -= charged;
        sub.lastSettled = block.timestamp;
        accruedFees += charged;

        emit Settled(user, charged);
    }

    function _pull(address from, uint256 amount) internal {
        if (!usdc.transferFrom(from, address(this), amount)) {
            revert TransferFailed();
        }
    }
}
