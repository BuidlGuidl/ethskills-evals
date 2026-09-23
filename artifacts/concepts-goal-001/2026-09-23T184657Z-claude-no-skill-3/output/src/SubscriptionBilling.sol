// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, self-serve subscription billing in a single ERC-20 (intended: USDC).
///
/// How it works
/// ------------
/// A customer deposits USDC into their own credit balance, then picks a plan. Subscribing
/// moves one period's price out of `balance` and into `escrow` — money that is committed to
/// the period in progress but not yet earned by the merchant. When a period ends the escrow
/// becomes merchant revenue and the next period is funded from the remaining balance,
/// automatically, for as long as the balance holds out. If it runs dry the subscription
/// simply lapses at the end of the last period that was paid for.
///
/// Nobody has to run a cron job for that to be true. Renewals are *lazily settled*: the
/// bookkeeping is rewritten on the next touch of the account (`settle`, or any user action),
/// but every view function reports the already-projected state, so `isSubscribed` is correct
/// at all times whether or not anyone has settled. Settlement only decides when the merchant
/// may withdraw the revenue, never whether a customer is subscribed.
///
/// Cancelling refunds the unused remainder of the period in progress, pro-rated by the second,
/// back to the customer's balance, from where it can be withdrawn.
///
/// Invariant: token.balanceOf(this) >= sum(balance) + sum(escrow) + accruedRevenue.
contract SubscriptionBilling is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Length of one billing period. "Monthly" here means a fixed 30 days.
    uint64 public constant PERIOD = 30 days;

    /// @notice Sentinel plan id meaning "no subscription".
    uint8 public constant NO_PLAN = 0;

    struct Subscription {
        uint128 balance; // unspent credit, withdrawable at any time
        uint128 escrow; // committed to the period in progress, refundable pro-rata
        uint64 renewsAt; // end of the paid-for period; after a lapse, when coverage ended
        uint64 periodPrice; // price snapshotted at subscribe time; renewals honour it
        uint8 planId; // NO_PLAN when not subscribed
    }

    /// @dev Result of projecting a subscription forward to a given timestamp.
    struct Projection {
        uint128 balance;
        uint128 escrow;
        uint64 renewsAt;
        uint64 periodPrice;
        uint8 planId;
        uint32 periodsCharged; // renewals paid for during the projection
        uint256 revenue; // amount that became merchant revenue
        bool lapsed; // ran out of funds mid-projection
    }

    /// @notice The billing token. USDC in production; 6 decimals, so $5.00 == 5_000_000.
    IERC20 public immutable token;

    /// @notice Price per period for each plan id. Zero means the plan is closed to new signups.
    mapping(uint8 planId => uint256 price) public planPrice;

    mapping(address account => Subscription) private _subs;

    /// @notice Revenue that has been settled and is withdrawable by the owner.
    uint256 public accruedRevenue;

    /// @notice Sum of all customer balances and escrows. Never withdrawable by the owner.
    uint256 public customerFunds;

    /// @notice When true, new deposits and new subscriptions are blocked. Existing
    ///         subscriptions keep renewing, and withdrawals and cancellations always work.
    bool public signupsPaused;

    event Deposited(address indexed account, address indexed payer, uint256 amount, uint256 balance);
    event Withdrawn(address indexed account, address indexed to, uint256 amount, uint256 balance);
    event Subscribed(address indexed account, uint8 indexed planId, uint256 price, uint64 renewsAt);
    event Renewed(address indexed account, uint8 indexed planId, uint32 periods, uint64 renewsAt);
    event Lapsed(address indexed account, uint8 indexed planId, uint64 endedAt);
    event Cancelled(address indexed account, uint8 indexed planId, uint256 refund, uint256 charged);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event PlanPriceSet(uint8 indexed planId, uint256 price);
    event SignupsPausedSet(bool paused);

    error ZeroAddress();
    error ZeroAmount();
    error SignupsArePaused();
    error UnknownPlan(uint8 planId);
    error AlreadySubscribed(uint8 planId);
    error NotSubscribed();
    error InsufficientBalance(uint256 available, uint256 required);
    error NotBillingToken();

    /// @param billingToken ERC-20 used for billing (USDC).
    /// @param owner_ Merchant address; receives revenue, administers plans.
    /// @param hobbyPrice Price per period of plan 1, in token units.
    /// @param proPrice Price per period of plan 2, in token units.
    constructor(IERC20 billingToken, address owner_, uint256 hobbyPrice, uint256 proPrice) Ownable(owner_) {
        if (address(billingToken) == address(0)) revert ZeroAddress();
        token = billingToken;
        _setPlanPrice(1, hobbyPrice);
        _setPlanPrice(2, proPrice);
    }

    // ---------------------------------------------------------------------
    // Customer actions
    // ---------------------------------------------------------------------

    /// @notice Top up your own credit balance. Requires an ERC-20 approval first.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's credit balance (e.g. a team paying for a member).
    function depositFor(address account, uint256 amount) external {
        if (account == address(0)) revert ZeroAddress();
        _deposit(account, amount);
    }

    /// @notice Start a subscription, paying the first period out of your balance.
    function subscribe(uint8 planId) external {
        _subscribe(msg.sender, planId);
    }

    /// @notice Top up and subscribe in one transaction.
    function depositAndSubscribe(uint256 amount, uint8 planId) external {
        _deposit(msg.sender, amount);
        _subscribe(msg.sender, planId);
    }

    /// @notice Cancel immediately. The unused remainder of the period in progress is
    ///         returned to your credit balance, pro-rated by the second.
    /// @return refund Amount credited back to your balance.
    function cancel() external returns (uint256 refund) {
        return _cancel(msg.sender);
    }

    /// @notice Withdraw unspent credit to your own address.
    function withdraw(uint256 amount) external {
        _withdraw(msg.sender, msg.sender, amount);
    }

    /// @notice Withdraw unspent credit to another address.
    function withdrawTo(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();
        _withdraw(msg.sender, to, amount);
    }

    /// @notice Cancel (if subscribed) and withdraw everything, including the pro-rata refund.
    /// @return amount Total token amount sent to the caller.
    function cancelAndWithdrawAll() external returns (uint256 amount) {
        _settle(msg.sender);
        if (_subs[msg.sender].planId != NO_PLAN) _cancel(msg.sender);
        amount = _subs[msg.sender].balance;
        if (amount == 0) revert ZeroAmount();
        _withdraw(msg.sender, msg.sender, amount);
    }

    /// @notice Move to a different plan: cancels the current one (pro-rata refund back to
    ///         balance) and starts a fresh period on the new plan at today's price.
    function switchPlan(uint8 newPlanId) external {
        _settle(msg.sender);
        if (_subs[msg.sender].planId != NO_PLAN) _cancel(msg.sender);
        _subscribe(msg.sender, newPlanId);
    }

    // ---------------------------------------------------------------------
    // Settlement (permissionless)
    // ---------------------------------------------------------------------

    /// @notice Write an account's lazily-accrued renewals into storage, turning elapsed
    ///         periods into withdrawable revenue. Anyone may call it; it changes nobody's
    ///         subscription status, only when the merchant can take the money.
    function settle(address account) public {
        _settle(account);
    }

    /// @notice Settle many accounts in one transaction.
    function settleMany(address[] calldata accounts) external {
        for (uint256 i; i < accounts.length; ++i) {
            _settle(accounts[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Views — what the API backend reads
    // ---------------------------------------------------------------------

    /// @notice True if `account` is entitled to service right now.
    function isSubscribed(address account) external view returns (bool) {
        return _project(_subs[account], block.timestamp).planId != NO_PLAN;
    }

    /// @notice Everything a gatekeeper needs in one call.
    /// @param account Address to check.
    /// @return active Whether the account may be served right now.
    /// @return planId Plan currently in force (0 if none) — use it to pick a rate limit.
    /// @return activeUntil Timestamp this answer is guaranteed good until. An active answer
    ///         can only be invalidated earlier by the customer cancelling, which emits
    ///         `Cancelled`; an inactive answer can be invalidated earlier by them subscribing,
    ///         which emits `Subscribed`. Safe to cache until then if you watch those events.
    /// @return balance Unspent credit.
    /// @return escrow Amount committed to the period in progress.
    function statusOf(address account)
        external
        view
        returns (bool active, uint8 planId, uint64 activeUntil, uint256 balance, uint256 escrow)
    {
        Projection memory p = _project(_subs[account], block.timestamp);
        active = p.planId != NO_PLAN;
        planId = p.planId;
        activeUntil = p.renewsAt;
        balance = p.balance;
        escrow = p.escrow;
    }

    /// @notice Batch form of `isSubscribed`, for warming a backend cache.
    function areSubscribed(address[] calldata accounts) external view returns (bool[] memory out) {
        out = new bool[](accounts.length);
        for (uint256 i; i < accounts.length; ++i) {
            out[i] = _project(_subs[accounts[i]], block.timestamp).planId != NO_PLAN;
        }
    }

    /// @notice Raw stored record, without projecting pending renewals. For debugging;
    ///         use `statusOf` for anything that makes a decision.
    function rawSubscription(address account) external view returns (Subscription memory) {
        return _subs[account];
    }

    /// @notice Timestamp at which the subscription will lapse if no more funds arrive.
    ///         Zero when not subscribed.
    function subscribedUntil(address account) external view returns (uint64) {
        Subscription memory s = _subs[account];
        Projection memory p = _project(s, block.timestamp);
        if (p.planId == NO_PLAN) return 0;
        uint256 extra = p.periodPrice == 0 ? 0 : uint256(p.balance) / p.periodPrice;
        return uint64(uint256(p.renewsAt) + extra * PERIOD);
    }

    /// @notice What `cancel()` would refund to the caller's balance right now.
    function previewCancelRefund(address account) external view returns (uint256) {
        Projection memory p = _project(_subs[account], block.timestamp);
        if (p.planId == NO_PLAN) return 0;
        return _refundFor(p.escrow, p.renewsAt, block.timestamp);
    }

    /// @notice Revenue that would be withdrawable if `accounts` were settled first.
    function previewRevenue(address[] calldata accounts) external view returns (uint256 total) {
        total = accruedRevenue;
        for (uint256 i; i < accounts.length; ++i) {
            total += _project(_subs[accounts[i]], block.timestamp).revenue;
        }
    }

    // ---------------------------------------------------------------------
    // Merchant / owner
    // ---------------------------------------------------------------------

    /// @notice Withdraw settled revenue.
    function withdrawRevenue(address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 available = accruedRevenue;
        if (amount > available) revert InsufficientBalance(available, amount);
        accruedRevenue = available - amount;
        token.safeTransfer(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    /// @notice Set a plan's price, in token units. Zero closes the plan to new signups.
    /// @dev Only affects subscriptions created after this call: existing subscribers keep
    ///      renewing at the price snapshotted when they subscribed, until they cancel or
    ///      switch plans. That makes renewal pricing unsurprising and settlement exact.
    function setPlanPrice(uint8 planId, uint256 price) external onlyOwner {
        if (planId == NO_PLAN) revert UnknownPlan(planId);
        _setPlanPrice(planId, price);
    }

    /// @notice Block new deposits and new subscriptions. Renewals, cancellations and
    ///         withdrawals are deliberately left working.
    function setSignupsPaused(bool paused) external onlyOwner {
        signupsPaused = paused;
        emit SignupsPausedSet(paused);
    }

    /// @notice Recover tokens accidentally sent here, and any billing-token surplus that
    ///         is not owed to customers or booked as revenue.
    function rescue(IERC20 stray, address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (stray == token) {
            uint256 surplus = token.balanceOf(address(this)) - customerFunds - accruedRevenue;
            if (amount > surplus) revert InsufficientBalance(surplus, amount);
        }
        stray.safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _setPlanPrice(uint8 planId, uint256 price) private {
        if (price > type(uint64).max) revert UnknownPlan(planId);
        planPrice[planId] = price;
        emit PlanPriceSet(planId, price);
    }

    function _deposit(address account, uint256 amount) private nonReentrant {
        if (signupsPaused) revert SignupsArePaused();
        if (amount == 0) revert ZeroAmount();

        // Settle before crediting: a top-up must never retroactively fund periods the
        // account could not afford at the time, resurrecting a subscription that lapsed.
        _settle(account);

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        Subscription storage s = _subs[account];
        uint256 newBalance = uint256(s.balance) + received;
        s.balance = uint128(newBalance); // bounded by token supply << 2^128
        customerFunds += received;

        emit Deposited(account, msg.sender, received, newBalance);
    }

    function _withdraw(address account, address to, uint256 amount) private nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _settle(account);

        Subscription storage s = _subs[account];
        uint256 available = s.balance;
        if (amount > available) revert InsufficientBalance(available, amount);

        uint256 newBalance = available - amount;
        s.balance = uint128(newBalance);
        customerFunds -= amount;
        token.safeTransfer(to, amount);

        emit Withdrawn(account, to, amount, newBalance);
    }

    function _subscribe(address account, uint8 planId) private {
        if (signupsPaused) revert SignupsArePaused();
        _settle(account);

        Subscription storage s = _subs[account];
        if (s.planId != NO_PLAN) revert AlreadySubscribed(s.planId);

        uint256 price = planPrice[planId];
        if (planId == NO_PLAN || price == 0) revert UnknownPlan(planId);

        uint256 available = s.balance;
        if (available < price) revert InsufficientBalance(available, price);

        uint64 renewsAt = uint64(block.timestamp) + PERIOD;
        s.balance = uint128(available - price);
        s.escrow = uint128(price);
        s.periodPrice = uint64(price);
        s.renewsAt = renewsAt;
        s.planId = planId;

        emit Subscribed(account, planId, price, renewsAt);
    }

    function _cancel(address account) private returns (uint256 refund) {
        _settle(account);

        Subscription storage s = _subs[account];
        uint8 planId = s.planId;
        if (planId == NO_PLAN) revert NotSubscribed();

        uint256 escrow = s.escrow;
        refund = _refundFor(uint128(escrow), s.renewsAt, block.timestamp);
        uint256 charged = escrow - refund;

        s.balance = uint128(uint256(s.balance) + refund);
        s.escrow = 0;
        s.planId = NO_PLAN;
        s.periodPrice = 0;
        s.renewsAt = uint64(block.timestamp);

        if (charged != 0) {
            accruedRevenue += charged;
            customerFunds -= charged;
        }

        emit Cancelled(account, planId, refund, charged);
    }

    /// @dev Unused fraction of the period in progress. Rounds down, so sub-second dust
    ///      stays with the merchant rather than being over-refunded.
    function _refundFor(uint128 escrow, uint64 renewsAt, uint256 nowTs) private pure returns (uint256) {
        if (nowTs >= renewsAt) return 0;
        return (uint256(escrow) * (renewsAt - nowTs)) / PERIOD;
    }

    function _settle(address account) private {
        Subscription storage s = _subs[account];
        Subscription memory cached = s;
        if (cached.planId == NO_PLAN || block.timestamp < cached.renewsAt) return;

        Projection memory p = _project(cached, block.timestamp);

        s.balance = p.balance;
        s.escrow = p.escrow;
        s.renewsAt = p.renewsAt;
        s.planId = p.planId;
        if (p.planId == NO_PLAN) s.periodPrice = 0;

        if (p.revenue != 0) {
            accruedRevenue += p.revenue;
            customerFunds -= p.revenue;
        }

        if (p.lapsed) {
            emit Lapsed(account, cached.planId, p.renewsAt);
        } else {
            emit Renewed(account, p.planId, p.periodsCharged, p.renewsAt);
        }
    }

    /// @dev Pure projection of a stored subscription forward to `nowTs`. Closed form: no
    ///      loops, so a customer who has gone unsettled for years costs the same gas as one
    ///      settled yesterday.
    function _project(Subscription memory s, uint256 nowTs) private pure returns (Projection memory p) {
        p.balance = s.balance;
        p.escrow = s.escrow;
        p.renewsAt = s.renewsAt;
        p.periodPrice = s.periodPrice;
        p.planId = s.planId;

        if (s.planId == NO_PLAN || nowTs < s.renewsAt) return p;

        // The period in progress has ended. Its escrow is earned, and we renew as many
        // further periods as the balance can pay for, up to the number now due.
        uint256 price = s.periodPrice;
        uint256 periodsDue = (nowTs - s.renewsAt) / PERIOD + 1;
        uint256 affordable = price == 0 ? 0 : uint256(s.balance) / price;
        uint256 n = periodsDue < affordable ? periodsDue : affordable;
        bool lapsed = n < periodsDue;

        // Each renewal but the last one (when still solvent) covers a period that has also
        // already ended, so it is earned too. n <= periodsDue keeps renewsAt <= nowTs+PERIOD.
        uint256 revenue = uint256(s.escrow) + (lapsed ? n : n - 1) * price;

        p.balance = uint128(uint256(s.balance) - n * price);
        p.escrow = lapsed ? 0 : uint128(price);
        p.renewsAt = uint64(uint256(s.renewsAt) + n * PERIOD);
        p.planId = lapsed ? NO_PLAN : s.planId;
        p.periodsCharged = uint32(n);
        p.revenue = revenue;
        p.lapsed = lapsed;
    }
}
