// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SubscriptionBilling
/// @notice Prepaid USDC balances with continuous (per-second) subscription accrual.
///
/// There is no scheduled "monthly charge" transaction. Instead, every account with an
/// active plan owes `elapsed * monthlyRate / 30 days` at any moment. The debt is settled
/// lazily: computed at read time by the views, and persisted whenever the account is
/// touched (deposit, subscribe, withdraw, cancel) or when anyone calls `settle`.
///
/// Funds flow:
///   user --deposit()--> balance[user] --accrual over time--> accrued --withdrawRevenue()--> owner
///   user <--cancel()/withdraw()-- unused balance[user]
///
/// The owner can never touch user balances; only revenue that has already accrued.
contract SubscriptionBilling {
    uint256 public constant BILLING_PERIOD = 30 days;

    struct Plan {
        uint128 monthlyRate; // USDC (6 decimals) charged per BILLING_PERIOD
        bool active; // whether new subscriptions to this plan are accepted
    }

    struct Account {
        uint256 balance; // USDC remaining as of lastSettled
        uint256 planId; // 0 = not subscribed
        uint40 lastSettled; // timestamp balance was last settled
    }

    IERC20 public immutable usdc;
    address public owner;

    /// @dev plans[0] is a dummy; real plans start at id 1 so planId 0 means "no plan".
    Plan[] public plans;
    mapping(address => Account) public accounts;

    /// @notice Revenue settled out of user balances, awaiting owner withdrawal.
    uint256 public accrued;

    event PlanCreated(uint256 indexed planId, uint128 monthlyRate);
    event PlanActiveSet(uint256 indexed planId, bool active);
    event Deposited(address indexed user, uint256 amount);
    event Subscribed(address indexed user, uint256 indexed planId);
    event Cancelled(address indexed user, uint256 refunded);
    event Withdrawn(address indexed user, uint256 amount);
    event Settled(address indexed user, uint256 owed);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OnlyOwner();
    error PlanNotActive();
    error NotSubscribed();
    error NoBalance();
    error InsufficientBalance();
    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(IERC20 _usdc, address _owner) {
        usdc = _usdc;
        owner = _owner;
        plans.push(Plan({monthlyRate: 0, active: false})); // id 0 = "no plan"
    }

    // ------------------------------------------------------------------
    // User functions
    // ------------------------------------------------------------------

    /// @notice Top up the caller's balance. Requires a USDC allowance for this contract.
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        _safeTransferFrom(usdc, msg.sender, address(this), amount);
        accounts[msg.sender].balance += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Subscribe to a plan (or switch plans). Billing starts/continues per second
    ///         from the caller's existing balance; cancel any time to get the rest back.
    function subscribe(uint256 planId) external {
        Plan storage plan = plans[planId]; // reverts on out-of-bounds id
        if (!plan.active) revert PlanNotActive();
        _settle(msg.sender);
        if (accounts[msg.sender].balance == 0) revert NoBalance();
        accounts[msg.sender].planId = planId;
        emit Subscribed(msg.sender, planId);
    }

    /// @notice End the subscription and refund the entire unused balance.
    function cancel() external {
        Account storage acc = accounts[msg.sender];
        if (acc.planId == 0) revert NotSubscribed();
        _settle(msg.sender);
        uint256 refund = acc.balance;
        acc.planId = 0;
        acc.balance = 0;
        emit Cancelled(msg.sender, refund);
        if (refund > 0) _safeTransfer(usdc, msg.sender, refund);
    }

    /// @notice Withdraw part of an unused balance without cancelling. If the balance
    ///         no longer covers the plan, the subscription simply lapses.
    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        Account storage acc = accounts[msg.sender];
        if (amount > acc.balance) revert InsufficientBalance();
        acc.balance -= amount;
        emit Withdrawn(msg.sender, amount);
        _safeTransfer(usdc, msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Settlement (permissionless)
    // ------------------------------------------------------------------

    /// @notice Persist an account's accrued charges. Anyone may call this; the operator
    ///         is incentivized to because settled funds become withdrawable revenue.
    ///         The views above already reflect settlement, so nothing breaks if
    ///         nobody calls it.
    function settle(address user) external {
        _settle(user);
    }

    // ------------------------------------------------------------------
    // Views (what the API backend calls)
    // ------------------------------------------------------------------

    /// @notice True if `user` has an active plan and their balance covers usage up to
    ///         this second. This is the per-request gate for the API: a plain eth_call,
    ///         no transaction, no gas.
    function isSubscribed(address user) public view returns (bool) {
        Account storage acc = accounts[user];
        return acc.planId != 0 && acc.balance > _owed(acc);
    }

    /// @notice Balance remaining after charges accrued up to now.
    function effectiveBalance(address user) external view returns (uint256) {
        Account storage acc = accounts[user];
        uint256 owed = _owed(acc);
        return owed >= acc.balance ? 0 : acc.balance - owed;
    }

    /// @notice Timestamp at which the current balance runs out (type(uint256).max if
    ///         not subscribed). Useful for "your subscription lapses on ..." UIs.
    function subscribedUntil(address user) external view returns (uint256) {
        Account storage acc = accounts[user];
        if (acc.planId == 0) return type(uint256).max;
        uint256 remaining = acc.balance > _owed(acc) ? acc.balance - _owed(acc) : 0;
        return block.timestamp + (remaining * BILLING_PERIOD) / plans[acc.planId].monthlyRate;
    }

    function plansCount() external view returns (uint256) {
        return plans.length;
    }

    // ------------------------------------------------------------------
    // Owner functions
    // ------------------------------------------------------------------

    /// @notice Create a new plan. Plans are immutable once created: existing
    ///         subscribers keep the rate they signed up at, forever.
    function createPlan(uint128 monthlyRate) external onlyOwner returns (uint256 planId) {
        planId = plans.length;
        plans.push(Plan({monthlyRate: monthlyRate, active: true}));
        emit PlanCreated(planId, monthlyRate);
    }

    /// @notice Stop/start accepting NEW subscriptions for a plan. Existing subscribers
    ///         are unaffected and keep their original rate until they cancel.
    function setPlanActive(uint256 planId, bool active) external onlyOwner {
        if (planId == 0 || planId >= plans.length) revert PlanNotActive();
        plans[planId].active = active;
        emit PlanActiveSet(planId, active);
    }

    /// @notice Withdraw revenue that has accrued from subscriptions. User balances
    ///         that have not yet accrued can never be touched by the owner.
    function withdrawRevenue(address to, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > accrued) revert InsufficientBalance();
        accrued -= amount;
        emit RevenueWithdrawn(to, amount);
        _safeTransfer(usdc, to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _owed(Account storage acc) internal view returns (uint256) {
        if (acc.planId == 0) return 0;
        uint256 elapsed = block.timestamp - acc.lastSettled;
        // Rounds down, i.e. in the user's favor, by less than 1e-6 USDC.
        return (elapsed * plans[acc.planId].monthlyRate) / BILLING_PERIOD;
    }

    function _settle(address user) internal {
        Account storage acc = accounts[user];
        uint256 owed = _owed(acc);
        if (owed > 0) {
            if (owed > acc.balance) owed = acc.balance; // lapses at zero; never goes negative
            acc.balance -= owed;
            accrued += owed;
            emit Settled(user, owed);
        }
        acc.lastSettled = uint40(block.timestamp);
    }

    // USDC returns bool; some ERC20s return nothing. Handle both.
    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length > 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length > 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
