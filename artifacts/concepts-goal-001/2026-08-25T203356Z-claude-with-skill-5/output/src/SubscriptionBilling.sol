// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransfer} from "./SafeTransfer.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, streaming subscriptions denominated in USDC.
///
/// @dev Design note — nothing runs itself.
///
///      There is no "charge everyone on the 1st" job in here, because a contract
///      cannot run one: a contract only moves when somebody sends it a transaction
///      and pays the gas. A monthly sweep over N subscribers would be a transaction
///      the operator has to send forever, and it stops the day the operator does.
///
///      Instead the subscription price is *streamed*: a subscriber's prepaid balance
///      is treated as draining continuously at `price / 30 days` per second, and the
///      split between "the subscriber's money" and "the operator's revenue" is a pure
///      function of `block.timestamp`. Nobody has to send anything for a subscriber to
///      be billed — the passage of time is the billing.
///
///      `settle()` only writes down what accrual already implies, so the operator can
///      call it whenever it suits their bookkeeping (monthly, quarterly, never until
///      they want to withdraw) with no risk of missing revenue: `withdrawable()` for a
///      subscriber is always net of everything accrued to this second, so a subscriber
///      can never withdraw money the stream has already earned.
///
///      Running out of money is likewise not an event anyone has to trigger. Accrual is
///      capped at the balance, so an unfunded account simply reads as not subscribed
///      from the instant it runs dry. The lapse is recorded in storage the next time
///      anyone touches the account.
contract SubscriptionBilling {
    using SafeTransfer for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice A "month" for billing purposes. Fixed length so the per-second rate is
    ///         constant; calendar months are not equal and would make the stream jump.
    uint256 public constant MONTH = 30 days;

    /// @notice A new subscription must be funded for at least this long. Stops accounts
    ///         being opened with dust that lapses in the same block.
    uint256 public constant MIN_FUNDING_PERIOD = 1 days;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    struct Plan {
        /// @notice Price per MONTH, in token units (6 decimals for USDC). Never changes.
        uint128 pricePerMonth;
        /// @notice False once closed: no new subscribers, existing ones are untouched.
        bool open;
    }

    /// @dev Packs into one slot: 128 + 64 + 8.
    struct Account {
        /// @notice Prepaid token units not yet streamed to the operator.
        uint128 balance;
        /// @notice Last time `balance` was reconciled against the stream.
        uint64 lastSettled;
        /// @notice Plan id, or 0 for "not subscribed".
        uint8 plan;
    }

    /// @notice The billing token. Immutable — a swapped token would strand deposits.
    IERC20 public immutable token;

    /// @notice Plan id => plan. Index 0 is reserved for "no subscription".
    Plan[] internal _plans;

    mapping(address => Account) internal _accounts;

    /// @notice Streamed revenue that has been settled and is awaiting withdrawal.
    uint256 public revenueAccrued;

    /// @notice Where withdrawn revenue is sent.
    address public treasury;
    /// @notice Pending treasury in a two-step handover.
    address public pendingTreasury;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted after every change to an account. A backend can keep an
    ///         up-to-date view of who is subscribed from this event alone: cache
    ///         `paidThrough` and treat the account as active until that timestamp.
    event AccountUpdated(address indexed account, uint8 plan, uint128 balance, uint64 paidThrough);

    event Deposited(address indexed account, address indexed payer, uint256 amount);
    event Withdrawn(address indexed account, address indexed to, uint256 amount);
    event Subscribed(address indexed account, uint8 indexed plan, uint256 pricePerMonth);
    event Cancelled(address indexed account, uint8 indexed plan);
    /// @notice The account ran out of prepaid balance and stopped being subscribed at
    ///         `at`. Emitted when the lapse is written down, which may be later.
    event Lapsed(address indexed account, uint8 indexed plan, uint64 at);
    event Settled(address indexed account, uint256 amount);

    event PlanAdded(uint8 indexed plan, uint256 pricePerMonth);
    event PlanClosed(uint8 indexed plan);
    event TreasuryTransferStarted(address indexed from, address indexed to);
    event TreasuryTransferred(address indexed from, address indexed to);
    event RevenueWithdrawn(address indexed to, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error ZeroAmount();
    error UnknownPlan();
    error PlanNotOpen();
    error AlreadyOnPlan();
    error NotSubscribed();
    error Underfunded(uint256 balance, uint256 required);
    error InsufficientBalance(uint256 requested, uint256 withdrawable);
    error NotTreasury();
    error TooManyPlans();
    error BalanceOverflow();

    modifier onlyTreasury() {
        if (msg.sender != treasury) revert NotTreasury();
        _;
    }

    /// @param token_ The billing token, expected to be USDC (6 decimals).
    /// @param treasury_ Recipient of streamed revenue.
    /// @param pricesPerMonth Initial plan prices in token units, in plan-id order
    ///        starting at 1. For USDC: [5_000_000, 20_000_000].
    constructor(IERC20 token_, address treasury_, uint128[] memory pricesPerMonth) {
        if (address(token_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        token = token_;
        treasury = treasury_;

        // Plan 0 is the sentinel for "not subscribed" and is never subscribable.
        _plans.push(Plan({pricePerMonth: 0, open: false}));
        for (uint256 i; i < pricesPerMonth.length; ++i) {
            _addPlan(pricesPerMonth[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          SUBSCRIBER ENTRYPOINTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Top up your own prepaid balance.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's prepaid balance. Anyone may pay for anyone;
    ///         it grants no control over the account.
    function depositFor(address account, uint256 amount) external {
        if (account == address(0)) revert ZeroAddress();
        _deposit(account, amount);
    }

    /// @notice Start a subscription, or switch plans, using the existing balance.
    function subscribe(uint8 plan) external {
        _subscribe(msg.sender, plan);
    }

    /// @notice Top up and subscribe in one transaction. The normal first-time path.
    function depositAndSubscribe(uint256 amount, uint8 plan) external {
        _deposit(msg.sender, amount);
        _subscribe(msg.sender, plan);
    }

    /// @notice Stop the stream. Everything not yet consumed stays withdrawable.
    function cancel() external {
        Account storage a = _accounts[msg.sender];
        _settle(msg.sender);
        uint8 plan = a.plan;
        if (plan == 0) revert NotSubscribed();
        a.plan = 0;
        emit Cancelled(msg.sender, plan);
        _emitUpdate(msg.sender);
    }

    /// @notice Withdraw unconsumed balance. Allowed while still subscribed — it just
    ///         shortens how long the subscription stays funded.
    function withdraw(uint256 amount, address to) public {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (amount > a.balance) revert InsufficientBalance(amount, a.balance);

        // checked against `a.balance` (a uint128) on the line above
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance -= uint128(amount);
        emit Withdrawn(msg.sender, to, amount);
        _emitUpdate(msg.sender);

        token.safeTransfer(to, amount);
    }

    /// @notice Cancel and take back the entire unconsumed remainder in one transaction.
    /// @return refunded Token units returned.
    function cancelAndWithdraw() external returns (uint256 refunded) {
        Account storage a = _accounts[msg.sender];
        _settle(msg.sender);

        uint8 plan = a.plan;
        if (plan != 0) {
            a.plan = 0;
            emit Cancelled(msg.sender, plan);
        }

        refunded = a.balance;
        if (refunded != 0) {
            a.balance = 0;
            emit Withdrawn(msg.sender, msg.sender, refunded);
        }
        _emitUpdate(msg.sender);

        if (refunded != 0) token.safeTransfer(msg.sender, refunded);
    }

    /*//////////////////////////////////////////////////////////////
                                SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Write down accrual for an account. Permissionless and non-economic:
    ///         it changes nobody's entitlement, it only moves already-earned units out
    ///         of `balance` into `revenueAccrued`. The operator calls this before
    ///         withdrawing; nobody else ever has to.
    function settle(address account) external {
        _settle(account);
        _emitUpdate(account);
    }

    /// @notice Batch form, for the operator's periodic bookkeeping sweep.
    function settleMany(address[] calldata accounts) external {
        for (uint256 i; i < accounts.length; ++i) {
            _settle(accounts[i]);
            _emitUpdate(accounts[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice The per-request check the API backend makes.
    /// @dev Pure function of storage and `block.timestamp`; no settlement required for
    ///      it to be correct.
    function isSubscribed(address account) public view returns (bool) {
        Account memory a = _accounts[account];
        if (a.plan == 0) return false;
        return block.timestamp < _paidThrough(a);
    }

    /// @notice The instant this account stops being subscribed if nothing else happens.
    ///         0 when not subscribed. Safe for a backend to cache until: the only ways
    ///         it can move are a deposit, a withdrawal, a plan change or a cancel, and
    ///         each of those emits `AccountUpdated`.
    function paidThrough(address account) external view returns (uint64) {
        Account memory a = _accounts[account];
        if (a.plan == 0) return 0;
        return _paidThrough(a);
    }

    /// @notice Everything a backend or dashboard needs in one call.
    function statusOf(address account)
        external
        view
        returns (bool active, uint8 plan, uint256 balance, uint64 paidThroughAt, uint256 owed)
    {
        Account memory a = _accounts[account];
        owed = _accrued(a);
        plan = a.plan;
        balance = a.balance - owed;
        paidThroughAt = plan == 0 ? 0 : _paidThrough(a);
        active = plan != 0 && block.timestamp < paidThroughAt;
    }

    /// @notice Token units the account could withdraw right now (net of accrual).
    function withdrawable(address account) external view returns (uint256) {
        Account memory a = _accounts[account];
        return a.balance - _accrued(a);
    }

    /// @notice Revenue the operator could withdraw right now, including amounts that
    ///         have accrued but not yet been settled for the given accounts.
    function revenueIncluding(address[] calldata accounts) external view returns (uint256 total) {
        total = revenueAccrued;
        for (uint256 i; i < accounts.length; ++i) {
            total += _accrued(_accounts[accounts[i]]);
        }
    }

    function planCount() external view returns (uint256) {
        return _plans.length;
    }

    function plans(uint8 plan) external view returns (uint128 pricePerMonth, bool open) {
        if (plan == 0 || plan >= _plans.length) revert UnknownPlan();
        Plan memory p = _plans[plan];
        return (p.pricePerMonth, p.open);
    }

    function accountOf(address account) external view returns (Account memory) {
        return _accounts[account];
    }

    /*//////////////////////////////////////////////////////////////
                             OPERATOR ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Sweep settled revenue to the treasury. Permissionless to call, because
    ///         the destination is fixed — a stranger calling it only does the operator
    ///         a favour.
    function withdrawRevenue() external returns (uint256 amount) {
        amount = revenueAccrued;
        if (amount == 0) revert ZeroAmount();
        revenueAccrued = 0;
        emit RevenueWithdrawn(treasury, amount);
        token.safeTransfer(treasury, amount);
    }

    /// @notice Add a new plan. Prices of existing plans can never be edited, so this
    ///         cannot raise the price on anyone already subscribed.
    function addPlan(uint128 pricePerMonth) external onlyTreasury returns (uint8 plan) {
        return _addPlan(pricePerMonth);
    }

    /// @notice Close a plan to new subscribers. Existing subscribers keep streaming at
    ///         their locked price until they cancel or run out.
    function closePlan(uint8 plan) external onlyTreasury {
        if (plan == 0 || plan >= _plans.length) revert UnknownPlan();
        _plans[plan].open = false;
        emit PlanClosed(plan);
    }

    /// @notice Stop billing these accounts. Settles what they owe up to now, cancels
    ///         the subscription, and leaves every remaining unit withdrawable by the
    ///         account itself.
    ///
    /// @dev This exists for one situation: winding the API down. Closing the plans stops
    ///      new signups but does nothing about existing subscribers, who would go on
    ///      being charged for a service that no longer answers until their prepaid
    ///      balance ran out. This lets the operator stop the meter for them.
    ///
    ///      It is, deliberately named, a power over a paying customer's access: the
    ///      operator can end anyone's subscription at any time, for any reason. What it
    ///      is not is a power over their money — it moves nothing to the treasury beyond
    ///      time already served, and the remainder stays withdrawable by the account
    ///      forever. See NOTES.md.
    function endSubscriptions(address[] calldata accounts) external onlyTreasury {
        for (uint256 i; i < accounts.length; ++i) {
            address account = accounts[i];
            _settle(account);
            Account storage a = _accounts[account];
            uint8 plan = a.plan;
            if (plan != 0) {
                a.plan = 0;
                emit Cancelled(account, plan);
            }
            _emitUpdate(account);
        }
    }

    /// @notice Two-step handover of the revenue destination. This is the only
    ///         privileged role in the contract and it cannot touch subscriber deposits.
    function transferTreasury(address to) external onlyTreasury {
        if (to == address(0)) revert ZeroAddress();
        pendingTreasury = to;
        emit TreasuryTransferStarted(treasury, to);
    }

    function acceptTreasury() external {
        if (msg.sender != pendingTreasury) revert NotTreasury();
        emit TreasuryTransferred(treasury, msg.sender);
        treasury = msg.sender;
        pendingTreasury = address(0);
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _deposit(address account, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();

        // Settle first: an account that ran dry while unattended must have its lapse
        // written down before new money lands, or the new deposit would be eaten by
        // the gap it was not being served during.
        _settle(account);

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        // Credit what actually arrived, not what was asked for.
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        // Balances are held in uint128 to pack the account into one slot. USDC's whole
        // supply is ~1e17 units against a uint128 ceiling of ~3.4e38, so this can only
        // trip on a misconfigured token, but truncating here would mint balance.
        if (received > type(uint128).max) revert BalanceOverflow();
        // bounded by the `type(uint128).max` check on the line above
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 credited = uint128(received);
        if (_accounts[account].balance > type(uint128).max - credited) revert BalanceOverflow();
        _accounts[account].balance += credited;

        emit Deposited(account, msg.sender, received);
        _emitUpdate(account);
    }

    function _subscribe(address account, uint8 plan) internal {
        if (plan == 0 || plan >= _plans.length) revert UnknownPlan();
        Plan memory p = _plans[plan];
        if (!p.open) revert PlanNotOpen();

        _settle(account);
        Account storage a = _accounts[account];
        if (a.plan == plan) revert AlreadyOnPlan();

        // Require enough runway that the subscription is real rather than dust.
        uint256 required = (uint256(p.pricePerMonth) * MIN_FUNDING_PERIOD) / MONTH;
        if (a.balance < required) revert Underfunded(a.balance, required);

        a.plan = plan;
        emit Subscribed(account, plan, p.pricePerMonth);
        _emitUpdate(account);
    }

    /// @dev Moves everything the stream has earned up to now out of `balance` and into
    ///      `revenueAccrued`, and records a lapse if the balance was exhausted.
    function _settle(address account) internal {
        Account storage a = _accounts[account];
        uint8 plan = a.plan;

        if (plan == 0) {
            // Nothing streaming; keep the clock fresh so a later subscribe starts now.
            // uint64 seconds overflows in year ~584942417355
            // forge-lint: disable-next-line(unsafe-typecast)
            a.lastSettled = uint64(block.timestamp);
            return;
        }

        uint64 through = _paidThrough(a);
        uint256 owed = _accrued(a);

        if (owed != 0) {
            // `owed` is capped at `a.balance` (a uint128) by `_accrued`
            // forge-lint: disable-next-line(unsafe-typecast)
            a.balance -= uint128(owed);
            revenueAccrued += owed;
            emit Settled(account, owed);
        }
        // uint64 seconds overflows in year ~584942417355
        // forge-lint: disable-next-line(unsafe-typecast)
        a.lastSettled = uint64(block.timestamp);

        if (block.timestamp >= through) {
            // The balance is exhausted: service stopped at `through` and the account
            // must not keep accruing a debt for time it was not being served.
            a.plan = 0;
            emit Lapsed(account, plan, through);
        }
    }

    /// @dev Token units the stream has earned but not yet written down. Capped at the
    ///      balance — the contract never accrues a debt beyond what was prepaid.
    function _accrued(Account memory a) internal view returns (uint256) {
        if (a.plan == 0 || a.balance == 0) return 0;
        uint256 elapsed = block.timestamp - a.lastSettled;
        uint256 owed = (uint256(_plans[a.plan].pricePerMonth) * elapsed) / MONTH;
        return owed > a.balance ? a.balance : owed;
    }

    /// @dev The timestamp at which the remaining balance is exactly consumed.
    ///      Assumes `a.plan != 0`.
    function _paidThrough(Account memory a) internal view returns (uint64) {
        uint256 price = _plans[a.plan].pricePerMonth;
        uint256 runway = (uint256(a.balance) * MONTH) / price;
        uint256 end = a.lastSettled + runway;
        // Saturate rather than wrap: a wrapped value would read as "already expired"
        // and let the stream over-collect. Only reachable with an absurd balance.
        // saturated against `type(uint64).max` in the ternary itself
        // forge-lint: disable-next-line(unsafe-typecast)
        return end > type(uint64).max ? type(uint64).max : uint64(end);
    }

    function _addPlan(uint128 pricePerMonth) internal returns (uint8 plan) {
        if (pricePerMonth == 0) revert ZeroAmount();
        if (_plans.length > type(uint8).max) revert TooManyPlans();
        plan = uint8(_plans.length);
        _plans.push(Plan({pricePerMonth: pricePerMonth, open: true}));
        emit PlanAdded(plan, pricePerMonth);
    }

    function _emitUpdate(address account) internal {
        Account memory a = _accounts[account];
        emit AccountUpdated(account, a.plan, a.balance, a.plan == 0 ? 0 : _paidThrough(a));
    }
}
