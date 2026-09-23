// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title PrepaidBilling
/// @notice Prepaid USDC subscriptions with per-second accrual. Customers top up,
///         pick a plan, and are charged continuously for as long as they stay
///         subscribed. Nothing here runs on a schedule: charges are computed from
///         timestamps at read/settle time, so the contract never needs a keeper.
///
///         Operator powers (deliberately minimal):
///           - owner can withdraw ONLY revenue that has already accrued (`earned`).
///           - owner cannot touch customer balances, pause, upgrade, or block anyone.
///         Plans are fixed at deploy time and can never change.
contract PrepaidBilling {
    uint256 public constant MONTH = 30 days;

    IERC20 public immutable usdc;
    address public immutable owner;

    struct Plan {
        uint128 price; // USDC per 30 days (6 decimals)
        bool exists;
    }

    // planId 0 = hobby ($5/mo), 1 = pro ($20/mo). Immutable after construction.
    mapping(uint8 => Plan) public plans;

    struct Subscription {
        uint8 planId; // plan the customer is subscribed to
        uint128 balance; // USDC balance as of `lastSettled`
        uint48 lastSettled; // last time charges were settled into `earned`
        bool active; // subscribed or not
    }

    mapping(address => Subscription) public subscriptions;

    /// @notice Total USDC that has accrued to the operator through settlement.
    ///         This is the ceiling on `withdrawRevenue`; customer balances are
    ///         never part of it.
    uint256 public earned;

    event Deposited(address indexed account, uint256 amount);
    event Subscribed(address indexed account, uint8 planId);
    event Cancelled(address indexed account, uint256 refunded);
    event RevenueWithdrawn(address indexed to, uint256 amount);

    error PlanDoesNotExist();
    error InsufficientBalance();
    error NotSubscribed();
    error NothingToWithdraw();
    error NotOwner();
    error TransferFailed();

    constructor(address usdc_, uint128 hobbyPrice, uint128 proPrice) {
        usdc = IERC20(usdc_);
        owner = msg.sender;
        plans[0] = Plan({price: hobbyPrice, exists: true});
        plans[1] = Plan({price: proPrice, exists: true});
    }

    /// @notice Top up the prepaid balance. Safe to call while subscribed —
    ///         it simply extends `subscribedUntil`.
    function deposit(uint128 amount) external {
        Subscription storage sub = subscriptions[msg.sender];
        // Settle first so that, if the subscription has lapsed, back-charges are
        // capped at the old (already consumed) balance and this deposit starts clean.
        if (sub.active) _settle(sub);
        sub.balance += amount;
        _pull(amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Subscribe to a plan, or switch plans while subscribed.
    ///         Settles charges at the old rate first. Requires enough prepaid
    ///         balance to be subscribed for a nonzero amount of time.
    function subscribe(uint8 planId) external {
        Plan memory plan = plans[planId];
        if (!plan.exists) revert PlanDoesNotExist();

        Subscription storage sub = subscriptions[msg.sender];
        // Only an active subscription accrues charges. A fresh or cancelled
        // account owes nothing, no matter how old its `lastSettled` is.
        if (sub.active) _settle(sub);

        sub.planId = planId;
        sub.active = true;
        sub.lastSettled = uint48(block.timestamp);

        if (sub.balance == 0) revert InsufficientBalance();
        emit Subscribed(msg.sender, planId);
    }

    /// @notice Cancel the subscription and withdraw the entire unused balance.
    function cancel() external {
        Subscription storage sub = subscriptions[msg.sender];
        if (!sub.active) revert NotSubscribed();
        _settle(sub);

        sub.active = false;
        uint128 refund = sub.balance;
        sub.balance = 0;
        _push(msg.sender, refund);
        emit Cancelled(msg.sender, refund);
    }

    /// @notice Withdraw an inactive (not subscribed) balance without subscribing.
    function withdraw() external {
        Subscription storage sub = subscriptions[msg.sender];
        if (sub.active) revert NotSubscribed();
        uint128 amount = sub.balance;
        if (amount == 0) revert NothingToWithdraw();
        sub.balance = 0;
        _push(msg.sender, amount);
        emit Cancelled(msg.sender, amount);
    }

    /// @notice Permissionless settlement for any account. Anyone can finalize an
    ///         expired subscription's charges; reads already account for accrual,
    ///         so this is optional housekeeping, not a required keeper.
    function settle(address account) external {
        Subscription storage sub = subscriptions[account];
        if (sub.active) _settle(sub);
    }

    /// @notice Operator withdrawal of accrued revenue only. Customer funds are
    ///         unreachable here by construction (`earned` only ever grows by
    ///         amounts subtracted from customer balances during settlement).
    function withdrawRevenue(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount == 0 || amount > earned) revert NothingToWithdraw();
        earned -= amount;
        _push(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    /// @notice Balance net of charges accrued up to now. For an inactive account
    ///         this is the full refundable balance.
    function effectiveBalance(address account) public view returns (uint256) {
        Subscription memory sub = subscriptions[account];
        if (!sub.active) return sub.balance;
        uint256 owed = _accrued(sub);
        return owed >= sub.balance ? 0 : sub.balance - owed;
    }

    /// @notice The per-request check the backend should use: is this address
    ///         currently subscribed (active and not out of funds)?
    function isSubscribed(address account) external view returns (bool) {
        Subscription memory sub = subscriptions[account];
        return sub.active && _accrued(sub) < sub.balance;
    }

    /// @notice Timestamp at which the current balance runs out at the current
    ///         plan's rate. 0 if not subscribed.
    function subscribedUntil(address account) external view returns (uint256) {
        Subscription memory sub = subscriptions[account];
        if (!sub.active) return 0;
        Plan memory plan = plans[sub.planId];
        return sub.lastSettled + (uint256(sub.balance) * MONTH) / plan.price;
    }

    function _accrued(Subscription memory sub) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - sub.lastSettled;
        if (elapsed == 0) return 0;
        return (uint256(plans[sub.planId].price) * elapsed) / MONTH;
    }

    function _settle(Subscription storage sub) internal {
        uint256 owed = _accrued(sub);
        if (owed > 0) {
            uint256 charge = owed > sub.balance ? sub.balance : owed;
            sub.balance -= uint128(charge);
            earned += charge;
        }
        sub.lastSettled = uint48(block.timestamp);
    }

    function _pull(uint256 amount) internal {
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
    }

    function _push(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }
}
