// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SubscriptionBilling
/// @notice Prepaid USDC subscriptions with per-second accrual and lazy settlement.
///
/// DESIGN: nothing onchain is automatic — no function can run "every month" by
/// itself. Instead, charges accrue continuously (per second) and are *computed*
/// whenever the account is read or touched. `isSubscribed` is a pure view: the
/// API backend checks it per request for free, and no keeper/cron is required
/// for the accounting to stay correct.
///
/// - Customers escrow USDC up front and pick a plan.
/// - Fees accrue per second at the plan price snapshotted at subscribe time.
/// - When the balance runs out, the subscription lapses at the exact second it
///   is exhausted — never mid-month, never in debt.
/// - Cancelling settles charges up to the current second and refunds the rest.
/// - The owner's `withdraw` can only touch already-earned fees (`collected`),
///   never unearned customer escrow.
contract SubscriptionBilling {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        Plan plan; // active plan (None = not subscribed)
        uint256 price; // monthly price snapshot (USDC, 6 decimals) taken at subscribe/switch time
        uint256 balance; // escrowed USDC not yet earned by the service
        uint64 lastSettled; // charges are settled through this timestamp
    }

    uint256 public constant MONTH = 30 days;

    IERC20 public immutable usdc;
    address public owner;

    /// @notice Current monthly price per plan. Only applies to NEW subscriptions
    /// and plan switches — existing subscribers keep their snapshot.
    mapping(Plan => uint256) public planPrice;

    mapping(address => Account) internal accounts;

    /// @notice Fees earned to date. Withdrawable by the owner; strictly
    /// separated from customer escrow so refunds are always backed.
    uint256 public collected;

    bool private locked;

    event Deposited(address indexed user, uint256 amount);
    event Subscribed(address indexed user, Plan plan, uint256 price);
    event PlanSwitched(address indexed user, Plan plan, uint256 price);
    event Settled(address indexed user, uint256 charged, uint256 balance);
    event Lapsed(address indexed user, uint256 paidThrough);
    event Cancelled(address indexed user, uint256 refund);
    event PlanPriceSet(Plan plan, uint256 price);
    event CollectedWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error Reentrant();
    error ZeroAmount();
    error InvalidPlan();
    error AlreadySubscribed();
    error NotSubscribed();
    error InsufficientBalance(uint256 have, uint256 need);
    error ExceedsCollected(uint256 have, uint256 want);
    error TransferFailed();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrant();
        locked = true;
        _;
        locked = false;
    }

    constructor(address usdc_, uint256 hobbyMonthly, uint256 proMonthly) {
        usdc = IERC20(usdc_);
        owner = msg.sender;
        planPrice[Plan.Hobby] = hobbyMonthly;
        planPrice[Plan.Pro] = proMonthly;
        emit PlanPriceSet(Plan.Hobby, hobbyMonthly);
        emit PlanPriceSet(Plan.Pro, proMonthly);
    }

    // ------------------------------------------------------------------
    // Customer actions
    // ------------------------------------------------------------------

    /// @notice Top up escrow with USDC. Requires a prior `approve` on the USDC
    /// contract for at least `amount`.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender, block.timestamp);
        _pull(msg.sender, amount);
        accounts[msg.sender].balance += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Start a subscription. The first month must be prepaid so an
    /// account can never be subscribed-and-instantly-lapsed.
    function subscribe(Plan plan) external {
        uint256 price = planPrice[plan];
        if (plan == Plan.None || price == 0) revert InvalidPlan();

        _settle(msg.sender, block.timestamp);
        Account storage acct = accounts[msg.sender];
        if (acct.plan != Plan.None) revert AlreadySubscribed();
        if (acct.balance < price) revert InsufficientBalance(acct.balance, price);

        acct.plan = plan;
        acct.price = price; // snapshot: future price changes don't affect this sub
        acct.lastSettled = uint64(block.timestamp);
        emit Subscribed(msg.sender, plan, price);
    }

    /// @notice Change plans. Charges to date are settled at the old rate; the
    /// new (current) price applies from now on.
    function switchPlan(Plan plan) external {
        uint256 price = planPrice[plan];
        if (plan == Plan.None || price == 0) revert InvalidPlan();

        _settle(msg.sender, block.timestamp);
        Account storage acct = accounts[msg.sender];
        if (acct.plan == Plan.None) revert NotSubscribed();

        acct.plan = plan;
        acct.price = price;
        emit PlanSwitched(msg.sender, plan, price);
    }

    /// @notice Cancel immediately. Charges up to this second are collected and
    /// every unused wei of escrow is refunded in the same transaction.
    function cancel() external nonReentrant {
        _settle(msg.sender, block.timestamp);
        Account storage acct = accounts[msg.sender];

        uint256 refund = acct.balance;
        acct.plan = Plan.None;
        acct.price = 0;
        acct.balance = 0;

        if (refund > 0) _push(msg.sender, refund);
        emit Cancelled(msg.sender, refund);
    }

    // ------------------------------------------------------------------
    // Permissionless settlement
    // ------------------------------------------------------------------

    /// @notice Checkpoint any account's accounting. Callable by anyone; never
    /// required for correctness (all views settle lazily) but lets the service
    /// or third parties move earned fees into `collected` without waiting for
    /// the customer to act.
    function poke(address user) external {
        _settle(user, block.timestamp);
    }

    // ------------------------------------------------------------------
    // Views (free eth_call — this is what the API backend hits per request)
    // ------------------------------------------------------------------

    /// @notice True iff `user` is on a plan and their balance covers charges
    /// accrued through this exact second. This is the access-control check for
    /// the API: subscribed ⟺ paid up right now.
    function isSubscribed(address user) external view returns (bool) {
        Account storage acct = accounts[user];
        if (acct.plan == Plan.None) return false;
        return _owed(acct, block.timestamp) <= acct.balance;
    }

    /// @notice The timestamp through which `user` has paid. `isSubscribed` is
    /// equivalent to `block.timestamp <= paidThrough(user)` (up to rounding).
    /// Handy for "your subscription lapses on …" UI.
    function paidThrough(address user) external view returns (uint256) {
        Account storage acct = accounts[user];
        if (acct.plan == Plan.None || acct.price == 0) return acct.lastSettled;
        return uint256(acct.lastSettled) + (acct.balance * MONTH) / acct.price;
    }

    /// @notice Full account state with charges projected to the current second.
    function accountOf(address user)
        external
        view
        returns (Plan plan, uint256 price, uint256 balance, uint256 lastSettledAt)
    {
        Account storage acct = accounts[user];
        plan = acct.plan;
        price = acct.price;
        balance = acct.balance;
        uint256 owed = _owed(acct, block.timestamp);
        if (plan == Plan.None) {
            lastSettledAt = acct.lastSettled;
        } else if (owed >= balance) {
            // lapsed: would settle to zero and drop the plan
            lastSettledAt = uint256(acct.lastSettled) + (balance * MONTH) / price;
            plan = Plan.None;
            balance = 0;
        } else {
            balance -= owed;
            lastSettledAt = block.timestamp;
        }
    }

    // ------------------------------------------------------------------
    // Owner
    // ------------------------------------------------------------------

    /// @notice Set the monthly price for future subscriptions/switches.
    /// Existing subscribers keep the price they signed up at (snapshot model),
    /// so this can never retroactively raise someone's bill.
    function setPlanPrice(Plan plan, uint256 price) external onlyOwner {
        if (plan == Plan.None || price == 0) revert InvalidPlan();
        planPrice[plan] = price;
        emit PlanPriceSet(plan, price);
    }

    /// @notice Withdraw earned fees. Cannot touch customer escrow: the contract
    /// always holds at least (USDC balance - collected) earmarked for refunds.
    function withdraw(uint256 amount) external nonReentrant onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > collected) revert ExceedsCollected(collected, amount);
        collected -= amount;
        _push(owner, amount);
        emit CollectedWithdrawn(owner, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /// @dev Charges accrued on an account between lastSettled and `ts`.
    function _owed(Account storage acct, uint256 ts) internal view returns (uint256) {
        if (acct.plan == Plan.None || acct.price == 0 || ts <= acct.lastSettled) return 0;
        return ((ts - uint256(acct.lastSettled)) * acct.price) / MONTH;
    }

    /// @dev Bring an account's accounting up to `ts`. If the balance can't
    /// cover accrued charges, the subscription lapses: everything remaining is
    /// collected (it exactly covers service already rendered) and the plan ends.
    /// No debt is ever created.
    function _settle(address user, uint256 ts) internal {
        Account storage acct = accounts[user];
        if (acct.plan == Plan.None) return;

        uint256 owed = _owed(acct, ts);
        if (owed >= acct.balance) {
            uint256 paidThroughAt = uint256(acct.lastSettled) + (acct.balance * MONTH) / acct.price;
            collected += acct.balance;
            acct.balance = 0;
            acct.plan = Plan.None;
            acct.price = 0;
            acct.lastSettled = uint64(paidThroughAt);
            emit Lapsed(user, paidThroughAt);
        } else {
            collected += owed;
            acct.balance -= owed;
            acct.lastSettled = uint64(ts);
            emit Settled(user, owed, acct.balance);
        }
    }

    /// @dev SafeERC20-lite: accept tokens that return bool (USDC) or nothing
    /// (legacy tokens), revert on `false`.
    function _pull(address from, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, address(this), amount)));
        if (!ok || (data.length > 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _push(address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length > 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
