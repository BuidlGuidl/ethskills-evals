// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SubscriptionBilling
/// @notice Prepaid USDC subscription billing.
///
/// Model:
///  - Customers deposit USDC up front into a personal balance.
///  - Subscribing to a plan charges one 30-day period immediately from that
///    balance and sets `paidThrough = now + 30 days`.
///  - Renewal is lazy: the next time the account is touched after `paidThrough`
///    (by the customer, or by anyone via `chargeBatch`), one more period is
///    charged and `paidThrough` extends from the charge time. An account whose
///    balance cannot cover the renewal simply lapses; no debt accrues and no
///    one is ever back-charged for lapsed time.
///  - `isActive` is a pure view: a subscriber is active while paid up, OR while
///    their balance can cover the renewal that the next touch will apply — so
///    the answer never depends on whether the keeper has run yet.
///  - Cancelling stops future charges, keeps access until the end of the
///    already-paid period, and immediately refunds the unused balance.
contract SubscriptionBilling {
    uint256 public constant PERIOD = 30 days;

    IERC20 public immutable usdc;
    address public owner;

    struct Plan {
        uint256 price; // per PERIOD, in USDC base units (6 decimals)
        bool exists;
    }

    struct Account {
        uint256 balance; // prepaid USDC not yet consumed by charges
        uint256 planId;
        uint256 paidThrough; // end of the last paid period
        bool subscribed;
    }

    mapping(uint256 => Plan) public plans;
    mapping(address => Account) public accounts;

    /// @notice Fees already charged to customers, waiting to be swept by owner.
    /// @dev The contract's USDC balance = sum(user balances) + collectedFees.
    uint256 public collectedFees;

    event PlanSet(uint256 indexed planId, uint256 price, bool exists);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Subscribed(address indexed user, uint256 planId);
    event Cancelled(address indexed user, uint256 refund);
    event Charged(address indexed user, uint256 planId, uint256 amount, uint256 paidThrough);
    event Swept(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAmount();
    error UnknownPlan(uint256 planId);
    error NotSubscribed();
    error InsufficientBalance(uint256 requested, uint256 available);
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address owner_) {
        require(usdc_ != address(0) && owner_ != address(0), "zero address");
        usdc = IERC20(usdc_);
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    // ------------------------------------------------------------------ views

    /// @notice Can `user` use the API right now?
    /// @dev True while paid up, or while the balance can still cover the
    ///      renewal that the next state touch will apply. This keeps the answer
    ///      seamless across the renewal boundary even before any transaction
    ///      settles the account.
    function isActive(address user) public view returns (bool) {
        Account storage a = accounts[user];
        if (!a.subscribed) return false;
        if (block.timestamp < a.paidThrough) return true;
        Plan storage p = plans[a.planId];
        return p.exists && a.balance >= p.price;
    }

    /// @notice Timestamp until which `user` is effectively paid up, accounting
    ///         for a pending renewal the next touch would apply.
    function effectivePaidThrough(address user) external view returns (uint256) {
        Account storage a = accounts[user];
        if (block.timestamp < a.paidThrough) return a.paidThrough;
        if (!a.subscribed) return a.paidThrough;
        Plan storage p = plans[a.planId];
        if (p.exists && a.balance >= p.price) return block.timestamp + PERIOD;
        return a.paidThrough;
    }

    function getAccount(address user)
        external
        view
        returns (uint256 balance, uint256 planId, uint256 paidThrough, bool subscribed)
    {
        Account storage a = accounts[user];
        return (a.balance, a.planId, a.paidThrough, a.subscribed);
    }

    // ---------------------------------------------------------- user actions

    /// @notice Top up the caller's prepaid balance. Settles first, so a lapsed
    ///         subscriber reactivates here (charging from now, never for the gap).
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _transferFrom(msg.sender, amount);
        accounts[msg.sender].balance += amount;
        emit Deposited(msg.sender, amount);
        // Settle after crediting so a lapsed subscriber reactivates on this
        // very top-up (charging one period from now, never for the gap).
        _settle(msg.sender);
    }

    /// @notice Withdraw unused balance. Already-paid periods are unaffected.
    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        if (amount > a.balance) revert InsufficientBalance(amount, a.balance);
        a.balance -= amount;
        _transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Subscribe to a plan, or switch plans if already subscribed.
    /// @dev Charges the first period immediately (if the balance covers it).
    ///      On a plan switch the current paid period keeps its old terms; the
    ///      new price applies from the next renewal.
    function subscribe(uint256 planId) external {
        if (!plans[planId].exists) revert UnknownPlan(planId);
        Account storage a = accounts[msg.sender];
        a.planId = planId;
        if (!a.subscribed) {
            a.subscribed = true;
            a.paidThrough = block.timestamp; // makes the settle below charge now
        }
        emit Subscribed(msg.sender, planId);
        _settle(msg.sender);
    }

    /// @notice Stop future charges, refund the unused balance immediately.
    /// @dev Access continues until `paidThrough` (already paid for); the refund
    ///      is everything not yet consumed by charges. No renewal is applied on
    ///      cancel, even if one is due.
    function cancel() external {
        Account storage a = accounts[msg.sender];
        if (!a.subscribed) revert NotSubscribed();
        a.subscribed = false;
        uint256 refund = a.balance;
        a.balance = 0;
        if (refund > 0) _transfer(msg.sender, refund);
        emit Cancelled(msg.sender, refund);
    }

    // -------------------------------------------------------- owner actions

    /// @notice Create or update a plan. Price changes apply at next renewal;
    ///         setting exists=false lets current subscribers run out their paid
    ///         period, then lapse.
    function setPlan(uint256 planId, uint256 price, bool exists) external onlyOwner {
        plans[planId] = Plan(price, exists);
        emit PlanSet(planId, price, exists);
    }

    /// @notice Withdraw collected fees. Customer balances can never be swept.
    function sweep(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > collectedFees) revert InsufficientBalance(amount, collectedFees);
        collectedFees -= amount;
        _transfer(owner, amount);
        emit Swept(owner, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ---------------------------------------------------------------- keeper

    /// @notice Settle a batch of accounts, realizing due renewals. Permissionless:
    ///         it only does what the lazy accounting would do on the next touch.
    ///         The operator runs this periodically (see NOTES.md); correctness of
    ///         `isActive` never depends on it.
    function chargeBatch(address[] calldata users) external {
        for (uint256 i = 0; i < users.length; i++) {
            _settle(users[i]);
        }
    }

    // --------------------------------------------------------------- internal

    /// @dev Charge one period if one is due and affordable. Never charges for
    ///      lapsed time: the new period always starts at the charge time.
    function _settle(address user) internal {
        Account storage a = accounts[user];
        if (!a.subscribed) return;
        if (block.timestamp < a.paidThrough) return;
        Plan storage p = plans[a.planId];
        if (!p.exists || a.balance < p.price) return; // lapsed
        a.balance -= p.price;
        a.paidThrough = block.timestamp + PERIOD;
        collectedFees += p.price;
        emit Charged(user, a.planId, p.price, a.paidThrough);
    }

    function _transfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _transferFrom(address from, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, address(this), amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
