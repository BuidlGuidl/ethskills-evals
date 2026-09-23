// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SubscriptionManager
/// @notice Prepaid USDC subscription billing. Customers top up a balance, pick a
///         plan, and are charged `plan.price` every `plan.period` seconds from
///         their prepaid balance for as long as they stay subscribed. Cancelling
///         refunds the unused balance. Anyone can permissionlessly settle due
///         payments via `processPayment` (the operator runs it as a keeper).
///
///         Model notes:
///         - Charges are NOT prorated. A period is paid in full up front; the
///           current period is considered "used" once paid. Cancelling refunds
///           only the remaining (unused) balance.
///         - If a balance can't cover a due charge, the subscription lapses.
///           The leftover balance stays in the contract and can be withdrawn.
///         - Plan changes = cancel + resubscribe (keeps accounting trivial).
contract SubscriptionManager {
    // ---------------------------------------------------------------------
    // Types & storage
    // ---------------------------------------------------------------------

    struct Plan {
        uint256 price; // in USDC smallest units (6 decimals)
        uint64 period; // seconds between charges
        bool active; // whether new subscriptions can pick this plan
    }

    struct Account {
        uint256 planId; // 0 = no subscription
        uint256 balance; // prepaid, not-yet-charged USDC
        uint256 paidThrough; // timestamp the subscription is paid up to
    }

    uint256 public constant HOBBY = 1; // $5 / month
    uint256 public constant PRO = 2; // $20 / month

    IERC20 public immutable usdc;
    address public owner;

    mapping(uint256 => Plan) public plans;
    mapping(address => Account) public accounts;

    /// @notice USDC collected as fees, available for the owner to sweep.
    ///         User balances are always fully backed: contract USDC balance
    ///         == sum(user balances) + collectedFees.
    uint256 public collectedFees;

    uint256 private _locked = 1;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Subscribed(address indexed user, uint256 indexed planId, uint256 paidThrough);
    event PaymentCollected(
        address indexed user, uint256 indexed planId, uint256 amount, uint256 paidThrough
    );
    event SubscriptionLapsed(address indexed user, uint256 indexed planId);
    event Cancelled(address indexed user, uint256 indexed planId, uint256 refunded);
    event PlanUpdated(uint256 indexed planId, uint256 price, uint64 period, bool active);
    event FeesSwept(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error PlanNotActive();
    error AlreadySubscribed();
    error NotSubscribed();
    error InsufficientBalance(uint256 needed, uint256 have);
    error InsufficientFees(uint256 requested, uint256 available);
    error ZeroPeriod();
    error TransferFailed();
    error Reentrant();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked == 2) revert Reentrant();
        _locked = 2;
        _;
        _locked = 1;
    }

    // ---------------------------------------------------------------------
    // Constructor & admin
    // ---------------------------------------------------------------------

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        // USDC has 6 decimals: $5 = 5e6, $20 = 20e6.
        plans[HOBBY] = Plan({price: 5e6, period: 30 days, active: true});
        plans[PRO] = Plan({price: 20e6, period: 30 days, active: true});
        emit PlanUpdated(HOBBY, 5e6, 30 days, true);
        emit PlanUpdated(PRO, 20e6, 30 days, true);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Create or update a plan. Existing subscribers keep the price
    ///         they signed up at until their next charge after the update —
    ///         change prices with care (see NOTES.md).
    function setPlan(uint256 planId, uint256 price, uint64 period, bool active) external onlyOwner {
        if (period == 0) revert ZeroPeriod(); // would infinite-loop _settle
        plans[planId] = Plan({price: price, period: period, active: active});
        emit PlanUpdated(planId, price, period, active);
    }

    /// @notice Withdraw collected fees. Can never touch user balances.
    function sweepFees(uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > collectedFees) revert InsufficientFees(amount, collectedFees);
        collectedFees -= amount;
        _safeTransfer(to, amount);
        emit FeesSwept(to, amount);
    }

    // ---------------------------------------------------------------------
    // Customer actions
    // ---------------------------------------------------------------------

    /// @notice Top up the prepaid balance. Requires a prior USDC `approve`.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        accounts[msg.sender].balance += amount;
        _safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Subscribe to a plan. Charges the first period immediately from
    ///         the prepaid balance. To change plans, cancel first.
    function subscribe(uint256 planId) external nonReentrant {
        Plan memory plan = plans[planId];
        if (!plan.active) revert PlanNotActive();

        Account storage acct = accounts[msg.sender];
        if (acct.planId != 0 && acct.paidThrough >= block.timestamp) revert AlreadySubscribed();

        if (acct.balance < plan.price) revert InsufficientBalance(plan.price, acct.balance);
        acct.balance -= plan.price;
        collectedFees += plan.price;

        acct.planId = planId;
        acct.paidThrough = block.timestamp + plan.period;

        emit Subscribed(msg.sender, planId, acct.paidThrough);
        emit PaymentCollected(msg.sender, planId, plan.price, acct.paidThrough);
    }

    /// @notice Cancel the subscription and refund the entire unused balance.
    ///         The current (already paid) period is not refunded.
    function cancel() external nonReentrant {
        Account storage acct = accounts[msg.sender];
        uint256 planId = acct.planId;
        uint256 refund = acct.balance;

        acct.planId = 0;
        acct.paidThrough = 0;
        acct.balance = 0;

        if (refund > 0) {
            _safeTransfer(msg.sender, refund);
            emit Withdrawn(msg.sender, refund);
        }
        emit Cancelled(msg.sender, planId, refund);
    }

    /// @notice Withdraw (part of) the prepaid balance while NOT subscribed.
    ///         While subscribed, use `cancel` (which refunds everything).
    function withdraw(uint256 amount) external nonReentrant {
        Account storage acct = accounts[msg.sender];
        if (acct.planId != 0 && acct.paidThrough >= block.timestamp) revert AlreadySubscribed();
        if (amount == 0) revert ZeroAmount();
        if (acct.balance < amount) revert InsufficientBalance(amount, acct.balance);

        // A lapsed-but-not-settled account is settled first so `balance`
        // reflects any overdue charges before withdrawing.
        if (acct.planId != 0) _settle(acct, msg.sender);

        if (acct.balance < amount) revert InsufficientBalance(amount, acct.balance);
        acct.balance -= amount;
        _safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Keeper
    // ---------------------------------------------------------------------

    /// @notice Settle due payments for a user. Permissionless: the operator
    ///         calls this on a schedule (and can batch via `processPayments`).
    ///         Charges every elapsed period the balance can cover; if the
    ///         balance runs out, the subscription lapses.
    function processPayment(address user) public nonReentrant {
        Account storage acct = accounts[user];
        if (acct.planId == 0) return;
        _settle(acct, user);
    }

    function processPayments(address[] calldata users) external {
        for (uint256 i = 0; i < users.length; i++) {
            processPayment(users[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Views (this is what the API backend calls)
    // ---------------------------------------------------------------------

    /// @notice True iff `user` has an active subscription paid through now.
    ///         Accurate without any keeper interaction.
    function isSubscribed(address user) external view returns (bool) {
        Account storage acct = accounts[user];
        return acct.planId != 0 && acct.paidThrough >= block.timestamp;
    }

    /// @notice Full account snapshot for dashboards / backend checks.
    function getAccount(address user)
        external
        view
        returns (uint256 planId, uint256 balance, uint256 paidThrough, bool subscribed)
    {
        Account storage acct = accounts[user];
        return (
            acct.planId,
            acct.balance,
            acct.paidThrough,
            acct.planId != 0 && acct.paidThrough >= block.timestamp
        );
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _settle(Account storage acct, address user) internal {
        Plan memory plan = plans[acct.planId];
        while (acct.paidThrough <= block.timestamp) {
            if (acct.balance < plan.price) {
                // Can't cover the next period: subscription lapses. The
                // leftover balance stays withdrawable via `withdraw`/`cancel`.
                uint256 lapsedPlan = acct.planId;
                acct.planId = 0;
                emit SubscriptionLapsed(user, lapsedPlan);
                return;
            }
            acct.balance -= plan.price;
            collectedFees += plan.price;
            acct.paidThrough += plan.period;
            emit PaymentCollected(user, acct.planId, plan.price, acct.paidThrough);
        }
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(usdc)
            .call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
