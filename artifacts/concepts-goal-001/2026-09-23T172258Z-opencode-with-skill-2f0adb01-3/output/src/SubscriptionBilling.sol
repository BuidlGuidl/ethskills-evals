// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SubscriptionBilling
/// @notice Prepaid USDC subscription billing with continuous (per-second) accrual.
///
///         How it works:
///         - A customer approves USDC and tops up a prepaid balance (`topUp`).
///         - They subscribe to a plan (`subscribe`). From that moment, the plan
///           price accrues against their balance continuously, per second.
///         - Nothing needs to "run" monthly: accounting is settled lazily inside
///           every state-changing call, and `isActive` computes the current
///           position on the fly. A subscriber is active iff their balance still
///           covers the fees accrued so far.
///         - `cancel` settles and refunds whatever hasn't been used.
///         - If a balance runs out, the subscription lapses: the remaining
///           balance is credited to the operator and the account goes inactive.
///         - Settled fees accumulate in `earned`; the operator withdraws them
///           with `withdrawEarned`. Anyone can call `settle`/`settleMany` to
///           move accrued fees into `earned` — the operator is incentivized to
///           do this because it is their revenue.
contract SubscriptionBilling {
    uint256 public constant BILLING_PERIOD = 30 days;

    IERC20 public immutable usdc;
    address public immutable owner;

    struct Plan {
        uint128 pricePerPeriod; // USDC (6 decimals) charged per BILLING_PERIOD
        bool exists;
    }

    struct Subscription {
        uint256 planId;
        uint256 balance; // remaining prepaid USDC
        uint40 lastSettled; // timestamp fees were last accounted
        bool active;
    }

    mapping(uint256 => Plan) public plans;
    mapping(address => Subscription) public subscriptions;

    /// @notice Fees that have been settled and are withdrawable by the owner.
    uint256 public earned;

    event PlanSet(uint256 indexed planId, uint256 pricePerPeriod);
    event Subscribed(address indexed account, uint256 indexed planId);
    event ToppedUp(address indexed account, uint256 amount);
    event Cancelled(address indexed account, uint256 refunded);
    event Lapsed(address indexed account);
    event Settled(address indexed account, uint256 fee);
    event BalanceWithdrawn(address indexed account, uint256 amount);
    event EarnedWithdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error AlreadySubscribed();
    error NotSubscribed();
    error StillSubscribed();
    error PlanDoesNotExist();
    error NothingToWithdraw();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param usdc_ Address of the USDC token contract.
    /// @param hobbyPrice Price per 30 days of the hobby plan (plan id 1), in USDC base units (6 decimals).
    /// @param proPrice Price per 30 days of the pro plan (plan id 2), in USDC base units (6 decimals).
    constructor(address usdc_, uint128 hobbyPrice, uint128 proPrice) {
        usdc = IERC20(usdc_);
        owner = msg.sender;
        _setPlan(1, hobbyPrice);
        _setPlan(2, proPrice);
    }

    // ------------------------------------------------------------------
    // Customer functions
    // ------------------------------------------------------------------

    /// @notice Top up the caller's prepaid balance. Requires USDC approval.
    function topUp(uint256 amount) external {
        _settle(msg.sender); // keep accounting fresh if currently subscribed
        subscriptions[msg.sender].balance += amount;
        _transferFrom(usdc, msg.sender, address(this), amount);
        emit ToppedUp(msg.sender, amount);
    }

    /// @notice Subscribe the caller to a plan. Billing accrues per second from now.
    function subscribe(uint256 planId) external {
        if (!plans[planId].exists) revert PlanDoesNotExist();
        _settle(msg.sender); // settles (and possibly lapses) any previous subscription
        Subscription storage sub = subscriptions[msg.sender];
        if (sub.active) revert AlreadySubscribed();
        sub.planId = planId;
        sub.lastSettled = uint40(block.timestamp);
        sub.active = true;
        emit Subscribed(msg.sender, planId);
    }

    /// @notice Cancel the caller's subscription and refund the unused balance.
    function cancel() external {
        Subscription storage sub = subscriptions[msg.sender];
        if (!sub.active) revert NotSubscribed();
        _settle(msg.sender); // may lapse the sub, in which case refund is 0
        uint256 refund = sub.balance;
        sub.active = false;
        sub.planId = 0;
        sub.balance = 0;
        if (refund > 0) _transfer(usdc, msg.sender, refund);
        emit Cancelled(msg.sender, refund);
    }

    /// @notice Withdraw balance for an account with no active subscription
    ///         (e.g. topped up but never subscribed, or previously lapsed/cancelled).
    function withdrawBalance() external {
        Subscription storage sub = subscriptions[msg.sender];
        if (sub.active) revert StillSubscribed();
        uint256 amount = sub.balance;
        if (amount == 0) revert NothingToWithdraw();
        sub.balance = 0;
        _transfer(usdc, msg.sender, amount);
        emit BalanceWithdrawn(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Settlement (permissionless — anyone can poke these)
    // ------------------------------------------------------------------

    /// @notice Settle one account: move accrued fees into `earned`, lapse if broke.
    function settle(address account) external {
        _settle(account);
    }

    /// @notice Settle many accounts in one transaction.
    function settleMany(address[] calldata accounts) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            _settle(accounts[i]);
        }
    }

    // ------------------------------------------------------------------
    // Operator functions
    // ------------------------------------------------------------------

    /// @notice Withdraw settled fees to the owner.
    function withdrawEarned() external onlyOwner {
        uint256 amount = earned;
        if (amount == 0) revert NothingToWithdraw();
        earned = 0;
        _transfer(usdc, owner, amount);
        emit EarnedWithdrawn(owner, amount);
    }

    /// @notice Create or update a plan. Existing subscribers keep their current
    ///         plan's new price from their next settlement onward.
    function setPlan(uint256 planId, uint128 pricePerPeriod) external onlyOwner {
        _setPlan(planId, pricePerPeriod);
    }

    // ------------------------------------------------------------------
    // Views (for the backend / dashboard)
    // ------------------------------------------------------------------

    /// @notice True if the account is subscribed AND its balance still covers
    ///         accrued fees. This is the per-request check for the API backend.
    function isActive(address account) public view returns (bool) {
        Subscription storage sub = subscriptions[account];
        if (!sub.active) return false;
        return _owed(sub) < sub.balance;
    }

    /// @notice Everything a backend or dashboard needs in one call.
    function getAccount(address account)
        external
        view
        returns (uint256 planId, uint256 balance, uint256 owed, bool subscribed, bool activeNow)
    {
        Subscription storage sub = subscriptions[account];
        planId = sub.planId;
        subscribed = sub.active;
        if (sub.active) {
            owed = _owed(sub);
            balance = owed < sub.balance ? sub.balance - owed : 0;
            activeNow = owed < sub.balance;
        }
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _owed(Subscription storage sub) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - sub.lastSettled;
        if (elapsed == 0) return 0;
        return (elapsed * plans[sub.planId].pricePerPeriod) / BILLING_PERIOD;
    }

    function _settle(address account) internal {
        Subscription storage sub = subscriptions[account];
        if (!sub.active) return;
        uint256 owed = _owed(sub);
        if (owed == 0) return;
        if (owed >= sub.balance) {
            // Balance exhausted: operator takes what is left, sub lapses.
            earned += sub.balance;
            emit Settled(account, sub.balance);
            sub.balance = 0;
            sub.active = false;
            emit Lapsed(account);
        } else {
            sub.balance -= owed;
            earned += owed;
            emit Settled(account, owed);
        }
        sub.lastSettled = uint40(block.timestamp);
    }

    function _setPlan(uint256 planId, uint128 pricePerPeriod) internal {
        plans[planId] = Plan({pricePerPeriod: pricePerPeriod, exists: true});
        emit PlanSet(planId, pricePerPeriod);
    }

    function _transfer(IERC20 token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(token.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _transferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(token.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
