// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20, SafeTransfer} from "./IERC20.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, self-serve subscription billing in USDC (or any ERC-20).
///
/// ## The design problem, and why it is solved this way
///
/// The obvious reading of "charge them $5 every month" is a monthly job that
/// debits each subscriber. There is no such thing onchain. A contract cannot
/// wake itself up; every state change needs a caller who pays gas. A design
/// that depends on someone calling `chargeEveryone()` on the 1st of the month
/// is a design that quietly stops billing the first month that job fails.
///
/// So nothing here is pushed on a schedule. A subscriber's balance is *drawn
/// down continuously* at their plan's rate, and every number anyone cares
/// about is a pure function of (balance, rate, time elapsed):
///
///   accrued  = elapsed * pricePerMonth / 30 days   (capped at balance)
///   active   = planId != 0 && accrued < balance
///   refund   = balance - accrued
///
/// Consequences that fall out of that, all of them good:
///
///   * "Charged monthly for as long as they keep it" — a $5 balance buys one
///     month, $60 buys a year, topping up extends the run. No renewal
///     transaction exists to fail or be forgotten.
///   * "Cancel whenever, get back what's unused" — the refund is already
///     computed. Cancelling is one transaction by the subscriber and needs no
///     cooperation from the operator.
///   * "Check per request whether an address is subscribed" — `isActive` is a
///     `view`. Your backend answers it with a free `eth_call`, no gas, no
///     indexer, no database to keep in sync.
///
/// The one transition that does need a poker is sweeping earned revenue out of
/// subscriber balances into the operator's pot (`collect`). That one is easy:
/// the operator is paid to do it, it is the only party who wants the money, and
/// delaying it costs subscribers nothing (their funds sit here either way and
/// their refund is unaffected). `collect` is permissionless anyway, so a
/// stuck operator key is not a stuck system.
///
/// ## What the operator can and cannot do
///
/// CAN: create plans, close plans to new signups, withdraw revenue it has
/// actually earned, hand ownership to another address.
///
/// CANNOT: touch a subscriber's unspent balance, change the price of a plan
/// someone is already on, cancel or block a subscriber, pause the contract, or
/// stop anyone from withdrawing. There is no pause switch and no upgrade hook
/// on purpose — a key that can freeze everyone's money is a bigger risk to your
/// customers than the bugs it would let you paper over.
///
/// Plan prices are immutable once created. Repricing means creating a new plan;
/// existing subscribers keep their old rate until they choose to switch. That
/// removes the "operator raises the price and drains prepaid balances" attack
/// entirely, rather than asking anyone to trust that it will not happen.
contract SubscriptionBilling {
    using SafeTransfer for IERC20;

    // -------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------

    struct Plan {
        /// @notice Price per 30-day month, in token units (USDC: 6 decimals, so $5 == 5_000_000).
        uint128 pricePerMonth;
        /// @notice Whether new subscribers may join. Closing never affects existing subscribers.
        bool open;
        /// @notice Human label, e.g. "hobby". Informational only.
        string name;
    }

    struct Subscription {
        /// @notice Unspent prepaid funds. Only the subscriber can ever get these back.
        uint96 balance;
        /// @notice Timestamp accrual was last settled to.
        uint64 lastSettledAt;
        /// @notice Sub-unit accrual carried between settlements. See `_settle`.
        uint64 remainder;
        /// @notice 0 means not subscribed. Non-zero indexes `plans`.
        uint16 planId;
    }

    // -------------------------------------------------------------------
    // Constants & immutables
    // -------------------------------------------------------------------

    /// @notice A "month" for billing purposes. Fixed 30 days so the rate is a
    /// constant; calendar months would make the price per day wobble by 10%.
    uint256 public constant SECONDS_PER_MONTH = 30 days;

    /// @notice The billing token. Immutable — this contract is single-token by design.
    IERC20 public immutable token;

    // -------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------

    address public owner;
    address public pendingOwner;

    uint16 public planCount;
    mapping(uint16 planId => Plan) internal _plans;
    mapping(address account => Subscription) internal _subs;

    /// @notice Revenue settled out of subscriber balances and owed to `owner`.
    uint256 public revenueAccrued;

    /// @notice Sum of all subscribers' unspent balances. Never withdrawable by `owner`.
    uint256 public totalSubscriberBalance;

    // -------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------

    event PlanCreated(uint16 indexed planId, uint128 pricePerMonth, string name);
    event PlanClosed(uint16 indexed planId);
    event Deposited(address indexed account, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed account, uint256 amount, uint256 newBalance);
    event Subscribed(address indexed account, uint16 indexed planId, uint256 activeUntil);
    event Cancelled(address indexed account, uint16 indexed planId, uint256 refunded);
    event Charged(address indexed account, uint16 indexed planId, uint256 amount);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    // -------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error ZeroAmount();
    error NoSuchPlan();
    error PlanClosedToNewSubscribers();
    error AlreadyOnThisPlan();
    error NotSubscribed();
    error InsufficientBalance();
    error PriceTooHigh();
    error DepositTooLarge();

    // -------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------

    constructor(IERC20 billingToken, address initialOwner) {
        if (address(billingToken) == address(0) || initialOwner == address(0)) revert ZeroAddress();
        token = billingToken;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ===================================================================
    // Subscriber actions
    // ===================================================================

    /// @notice Add funds to your account. Extends your subscription if you have one.
    /// @dev Requires an ERC-20 approval of at least `amount` to this contract first.
    /// That approval is a standing permission to pull tokens — approve exactly what
    /// you are depositing, not an unlimited amount.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's account. Useful for gifting or for paying on
    /// behalf of a team member; the funds become theirs and only they can withdraw.
    function depositFor(address account, uint256 amount) external {
        if (account == address(0)) revert ZeroAddress();
        _deposit(account, amount);
    }

    /// @notice Start (or restart) a subscription, optionally depositing at the same time.
    /// @param planId The plan to join.
    /// @param amount Tokens to deposit in the same transaction. May be 0 if you
    /// already hold a balance here.
    function subscribe(uint16 planId, uint256 amount) external {
        Plan storage plan = _requirePlan(planId);
        if (!plan.open) revert PlanClosedToNewSubscribers();

        Subscription storage s = _subs[msg.sender];
        if (s.planId == planId) revert AlreadyOnThisPlan();

        // Settle the old plan (if any) at the old rate before the rate changes,
        // so a plan switch never retroactively reprices time already consumed.
        _settle(msg.sender, s);

        if (amount != 0) _pullFunds(msg.sender, s, amount);

        s.planId = planId;
        s.remainder = 0;
        emit Subscribed(msg.sender, planId, activeUntil(msg.sender));
    }

    /// @notice Cancel, and withdraw everything you have not used.
    /// @dev Needs no cooperation from the operator and cannot be blocked.
    function cancel() external {
        Subscription storage s = _subs[msg.sender];
        uint16 planId = s.planId;
        if (planId == 0) revert NotSubscribed();

        _settle(msg.sender, s);

        uint256 refund = s.balance;
        s.planId = 0;
        s.remainder = 0;
        if (refund != 0) {
            s.balance = 0;
            totalSubscriberBalance -= refund;
            token.safeTransfer(msg.sender, refund);
        }
        emit Cancelled(msg.sender, planId, refund);
    }

    /// @notice Withdraw unused funds without cancelling.
    /// @dev Withdrawing everything leaves you subscribed but out of credit, which
    /// reads as inactive until you top up again.
    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Subscription storage s = _subs[msg.sender];
        _settle(msg.sender, s);

        if (amount > s.balance) revert InsufficientBalance();
        unchecked {
            // forge-lint: disable-next-line(unsafe-typecast) — amount <= s.balance, checked above.
            s.balance = uint96(s.balance - amount);
        }
        totalSubscriberBalance -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, s.balance);
    }

    /// @notice Withdraw everything unused and cancel in one call.
    function withdrawAll() external {
        Subscription storage s = _subs[msg.sender];
        _settle(msg.sender, s);
        uint256 amount = s.balance;
        if (amount == 0) revert ZeroAmount();
        s.balance = 0;
        totalSubscriberBalance -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, 0);
    }

    // ===================================================================
    // Settlement — permissionless
    // ===================================================================

    /// @notice Move earned revenue out of an account's balance into the operator's pot.
    /// @dev Callable by anyone. The operator is the party with a reason to call it
    /// (it is how it gets paid), but nothing breaks if someone else does, and a lost
    /// operator key does not strand subscriber funds. Calling this changes no
    /// subscriber's refund or active-until: it only relabels money already consumed.
    function collect(address account) public {
        _settle(account, _subs[account]);
    }

    /// @notice Batch form of `collect`, for sweeping many subscribers in one transaction.
    function collectMany(address[] calldata accounts) external {
        for (uint256 i = 0; i < accounts.length; ++i) {
            collect(accounts[i]);
        }
    }

    // ===================================================================
    // Operator actions
    // ===================================================================

    /// @notice Create a plan. Prices are immutable once set — see contract notes.
    function createPlan(uint128 pricePerMonth, string calldata name)
        external
        onlyOwner
        returns (uint16 planId)
    {
        if (pricePerMonth == 0) revert ZeroAmount();
        // Keeps `elapsed * pricePerMonth` far from overflow and rules out absurd rates.
        if (pricePerMonth > type(uint96).max) revert PriceTooHigh();

        planId = ++planCount;
        _plans[planId] = Plan({pricePerMonth: pricePerMonth, open: true, name: name});
        emit PlanCreated(planId, pricePerMonth, name);
    }

    /// @notice Stop new signups to a plan. Existing subscribers are untouched and
    /// keep running at their original price until they switch or cancel.
    function closePlan(uint16 planId) external onlyOwner {
        _requirePlan(planId).open = false;
        emit PlanClosed(planId);
    }

    /// @notice Withdraw revenue that has actually been earned and settled.
    /// @dev Bounded by `revenueAccrued`, which only grows through `_settle`. There is
    /// no code path by which this reaches an unspent subscriber balance.
    function withdrawRevenue(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > revenueAccrued) revert InsufficientBalance();
        unchecked {
            revenueAccrued -= amount;
        }
        token.safeTransfer(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    /// @notice Two-step ownership handover, so a typo cannot lose the operator role.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previous = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, msg.sender);
    }

    // ===================================================================
    // Views — this is what your backend calls
    // ===================================================================

    /// @notice Is this address subscribed and in credit right now?
    /// @dev The per-request gate. Free `eth_call`, no gas, no indexing.
    function isActive(address account) public view returns (bool) {
        return block.timestamp < activeUntil(account);
    }

    /// @notice Unix timestamp at which this account's credit runs out.
    /// @dev Returns 0 if not subscribed. Cache this in your backend and skip the RPC
    /// call until it passes — see NOTES.md.
    function activeUntil(address account) public view returns (uint256) {
        Subscription storage s = _subs[account];
        uint16 planId = s.planId;
        if (planId == 0) return 0;

        uint256 price = _plans[planId].pricePerMonth;
        uint256 budget = uint256(s.balance) * SECONDS_PER_MONTH;
        uint256 rem = s.remainder;
        if (budget <= rem) return s.lastSettledAt;
        // Seconds of runway the remaining balance buys from the last settlement.
        return s.lastSettledAt + (budget - rem) / price;
    }

    /// @notice What this account would be charged if settled right now.
    function accruedOf(address account) public view returns (uint256) {
        Subscription storage s = _subs[account];
        uint16 planId = s.planId;
        if (planId == 0 || block.timestamp <= s.lastSettledAt) return 0;

        uint256 elapsed = block.timestamp - s.lastSettledAt;
        uint256 owed = (elapsed * _plans[planId].pricePerMonth + s.remainder) / SECONDS_PER_MONTH;
        return owed > s.balance ? s.balance : owed;
    }

    /// @notice What this account would get back if it cancelled right now.
    function refundableOf(address account) external view returns (uint256) {
        return _subs[account].balance - accruedOf(account);
    }

    /// @notice Raw stored subscription record. `balance` here is pre-settlement;
    /// use `refundableOf` for the spendable figure.
    function subscriptionOf(address account) external view returns (Subscription memory) {
        return _subs[account];
    }

    function plans(uint16 planId) external view returns (Plan memory) {
        return _plans[planId];
    }

    /// @notice Token held here beyond what is owed to subscribers and the operator.
    /// @dev Should be 0. Anything else means a token was sent here directly, or a
    /// fee-on-transfer token was configured (which this contract does not support).
    function surplus() external view returns (uint256) {
        uint256 held = token.balanceOf(address(this));
        uint256 claimed = totalSubscriberBalance + revenueAccrued;
        return held > claimed ? held - claimed : 0;
    }

    // ===================================================================
    // Internals
    // ===================================================================

    function _deposit(address account, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        Subscription storage s = _subs[account];
        // Settle before the balance changes, otherwise a top-up would be exposed to
        // accrual that belongs to the period before it landed.
        _settle(account, s);
        _pullFunds(msg.sender, s, amount);
        emit Deposited(account, amount, s.balance);
    }

    /// @dev Pulls `amount` from `from` and credits it to `s`. Caller must settle first.
    function _pullFunds(address from, Subscription storage s, uint256 amount) internal {
        uint256 newBalance = uint256(s.balance) + amount;
        if (newBalance > type(uint96).max) revert DepositTooLarge();

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        // Credit only what actually arrived, so a fee-on-transfer or rebasing token
        // cannot credit more than the contract holds. USDC is neither, but the check
        // is cheap and keeps the solvency invariant true regardless of the token.
        uint256 received = token.balanceOf(address(this)) - before;
        if (received != amount) revert TokenMismatch(amount, received);

        // forge-lint: disable-next-line(unsafe-typecast) — bounded by the DepositTooLarge check above.
        s.balance = uint96(newBalance);
        totalSubscriberBalance += amount;
    }

    error TokenMismatch(uint256 expected, uint256 received);

    /// @dev Advances an account's clock, moving consumed funds to `revenueAccrued`.
    ///
    /// The `remainder` field is what makes this safe to call at any frequency. A
    /// naive implementation computes `elapsed * price / SECONDS_PER_MONTH` and
    /// rounds down; at $5/month that rate is ~1.93 token-units per second, so
    /// settling every second would round away ~48% of revenue and anyone could
    /// grief the operator by spamming `collect`. Carrying the division remainder
    /// makes the total charged independent of how often settlement happens.
    function _settle(address account, Subscription storage s) internal {
        uint64 last = s.lastSettledAt;
        // forge-lint: disable-next-line(unsafe-typecast) — uint64 seconds overflows in year 584942417355.
        uint64 nowTs = uint64(block.timestamp);

        uint16 planId = s.planId;
        if (planId == 0) {
            // Not subscribed: no accrual, but keep the clock current so that
            // resubscribing later never bills for the gap.
            s.lastSettledAt = nowTs;
            s.remainder = 0;
            return;
        }
        if (last == 0 || nowTs <= last) {
            s.lastSettledAt = nowTs;
            return;
        }

        uint256 elapsed = nowTs - last;
        uint256 numerator = elapsed * _plans[planId].pricePerMonth + s.remainder;
        uint256 owed = numerator / SECONDS_PER_MONTH;

        uint256 balance = s.balance;
        if (owed >= balance) {
            // Credit ran out somewhere in this window. Charge no more than was
            // prepaid — a lapsed subscriber does not accumulate a debt.
            owed = balance;
            s.remainder = 0;
        } else {
            // forge-lint: disable-next-line(unsafe-typecast) — a modulus of 30 days fits uint64.
            s.remainder = uint64(numerator % SECONDS_PER_MONTH);
        }

        s.lastSettledAt = nowTs;

        if (owed != 0) {
            unchecked {
                // forge-lint: disable-next-line(unsafe-typecast) — owed <= balance, and balance is uint96.
                s.balance = uint96(balance - owed);
            }
            totalSubscriberBalance -= owed;
            revenueAccrued += owed;
            emit Charged(account, planId, owed);
        }
    }

    function _requirePlan(uint16 planId) internal view returns (Plan storage plan) {
        if (planId == 0 || planId > planCount) revert NoSuchPlan();
        plan = _plans[planId];
    }
}
