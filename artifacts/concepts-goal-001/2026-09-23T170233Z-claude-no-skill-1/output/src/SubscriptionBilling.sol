// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";

import {ISubscriptionBilling} from "./ISubscriptionBilling.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, self-renewing monthly subscriptions settled in USDC.
///
/// @dev Model
/// -----------------------------------------------------------------------
/// An account tops up a USDC `credit` balance. Subscribing moves exactly one
/// period's price out of `credit` into escrow and starts a paid period. Every
/// time the period boundary is crossed, the next period is charged from
/// `credit` -- but that renewal is *computed*, not pushed. No keeper, no cron:
/// `_project` replays every boundary that has passed in closed form, so reads
/// and writes always agree and a subscription that nobody has touched in a
/// year still reports the correct state.
///
/// When `credit` can no longer fund a renewal the subscription lapses at that
/// boundary. Whatever is left (always < one period's price) stays withdrawable.
///
/// Cancelling ends access immediately and returns the unused remainder of the
/// current period pro rata, to the second. That is the reason merchant revenue
/// accrues *continuously* inside a paid period rather than being booked up
/// front: the owner can never withdraw USDC that a subscriber could still
/// reclaim. Escrow is released to the owner only as it is earned.
///
/// @dev Accounting invariant, enforced by test/Invariant.t.sol:
///      usdc.balanceOf(this) >= totalUserFunds + merchantAccrued
///      where totalUserFunds == sum(credit) + sum(escrowed period payments).
contract SubscriptionBilling is ISubscriptionBilling, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Billing period. A flat 30 days, not a calendar month, so that
    /// renewal arithmetic is exact and needs no calendar logic on chain.
    uint256 public constant PERIOD = 30 days;

    struct Plan {
        uint128 price; // per period, in USDC base units (6 decimals)
        bool active; // false = closed to new sign-ups; existing subs keep renewing
    }

    struct Subscription {
        uint8 plan; // 0 = not subscribed
        uint40 periodStart; // start of the currently paid period
        uint128 rate; // price locked in at sign-up / plan change
        // --- slot boundary ---
        uint128 credit; // unallocated deposit; escrow is held outside this
    }

    IERC20 public immutable usdc;

    mapping(uint8 planId => Plan) internal _plans;
    mapping(address account => Subscription) internal _subs;

    /// @notice USDC earned and not yet withdrawn by the owner.
    uint256 public merchantAccrued;

    /// @notice USDC owed to accounts: unallocated credit plus escrowed periods.
    uint256 public totalUserFunds;

    /// @notice When true, deposits, new sign-ups and plan changes are blocked.
    /// @dev Cancelling, withdrawing credit and settling are never blocked, so a
    /// paused contract can still be fully drained by its users.
    bool public paused;

    event PlanSet(uint8 indexed planId, uint128 price, bool active);
    event Deposited(address indexed account, address indexed payer, uint256 amount, uint256 credit);
    event CreditWithdrawn(address indexed account, address indexed to, uint256 amount);
    event Subscribed(address indexed account, uint8 indexed plan, uint128 rate, uint64 periodStart);
    event Renewed(address indexed account, uint8 indexed plan, uint256 periods, uint256 charged, uint64 periodStart);
    event Lapsed(address indexed account, uint8 indexed plan, uint64 at, uint256 creditLeft);
    event PlanChanged(address indexed account, uint8 indexed oldPlan, uint8 indexed newPlan, uint256 refunded);
    event Cancelled(address indexed account, uint8 indexed plan, uint256 refunded, uint256 forfeited);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event Swept(address indexed token, address indexed to, uint256 amount);
    event PausedSet(bool paused);

    error Paused();
    error ZeroAmount();
    error ZeroAddress();
    error UnknownPlan(uint8 plan);
    error PlanClosed(uint8 plan);
    error AlreadySubscribed(uint8 plan);
    error NotSubscribed();
    error SamePlan(uint8 plan);
    error InsufficientCredit(uint256 required, uint256 available);
    error InsufficientRevenue(uint256 required, uint256 available);

    modifier notPaused() {
        if (paused) revert Paused();
        _;
    }

    /// @param usdc_  The billing token. Must be a non-rebasing ERC-20; deposits
    ///               are credited by measured balance delta, so a fee-on-transfer
    ///               token would credit the net amount rather than silently
    ///               over-crediting the contract.
    /// @param owner_ Receives revenue and administers plans.
    constructor(IERC20 usdc_, address owner_) Ownable(owner_) {
        if (address(usdc_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    // ---------------------------------------------------------------------
    // Projection: the one piece of arithmetic everything else is built on
    // ---------------------------------------------------------------------

    struct Projection {
        uint8 plan; // 0 if the subscription has lapsed
        uint40 periodStart;
        uint128 rate;
        uint128 credit;
        uint256 earned; // revenue realised by replaying the elapsed periods
        uint256 renewals; // periods charged while replaying
        uint64 lapsedAt; // 0 unless the subscription ran out of money
    }

    /// @dev Replays every period boundary between `s.periodStart` and `now` in
    /// closed form. Pure function of stored state -- views and state changes
    /// share it, so they cannot drift.
    function _project(Subscription memory s) internal view returns (Projection memory p) {
        p.plan = s.plan;
        p.periodStart = s.periodStart;
        p.rate = s.rate;
        p.credit = s.credit;
        if (s.plan == 0) return p;

        uint256 crossed = (block.timestamp - s.periodStart) / PERIOD;
        if (crossed == 0) return p; // still inside the paid period

        uint256 rate = s.rate; // > 0: setPlan rejects a zero price
        uint256 affordable = uint256(s.credit) / rate;
        uint256 renewals = crossed < affordable ? crossed : affordable;

        // The period that was current has now fully elapsed, so its escrow is earned.
        p.earned = rate;
        p.renewals = renewals;
        p.credit = uint128(uint256(s.credit) - renewals * rate);

        if (renewals == crossed) {
            // Every boundary was funded. The last renewal is the new current
            // period and stays escrowed; the ones before it are earned.
            p.earned += (renewals - 1) * rate;
            p.periodStart = uint40(uint256(s.periodStart) + crossed * PERIOD);
        } else {
            // Ran out of credit. All `renewals` funded periods ended before now,
            // so all of them are earned, and the subscription lapsed at the
            // boundary it could no longer pay for.
            p.earned += renewals * rate;
            p.lapsedAt = uint64(uint256(s.periodStart) + (renewals + 1) * PERIOD);
            p.plan = 0;
            p.periodStart = 0;
            p.rate = 0;
        }
    }

    /// @dev Applies a projection to storage and books the revenue it realised.
    function _settle(address account) internal returns (Subscription storage s) {
        s = _subs[account];
        if (s.plan == 0) return s;

        Projection memory p = _project(s);
        if (p.earned == 0) return s; // nothing crossed a boundary

        uint8 oldPlan = s.plan;
        s.plan = p.plan;
        s.periodStart = p.periodStart;
        s.rate = p.rate;
        s.credit = p.credit;

        merchantAccrued += p.earned;
        totalUserFunds -= p.earned;

        if (p.plan == 0) {
            emit Lapsed(account, oldPlan, p.lapsedAt, p.credit);
        } else {
            emit Renewed(account, oldPlan, p.renewals, p.renewals * p.rate, p.periodStart);
        }
    }

    /// @dev Unused remainder of the current period, pro rata to the second.
    /// Rounds down, so at most 1 base unit of dust is kept by the merchant.
    function _unusedOfPeriod(Subscription memory s) internal view returns (uint256) {
        uint256 periodEnd = uint256(s.periodStart) + PERIOD;
        if (block.timestamp >= periodEnd) return 0;
        return (uint256(s.rate) * (periodEnd - block.timestamp)) / PERIOD;
    }

    /// @dev Ends an active subscription, moving the unused remainder back to
    /// credit and booking the rest as revenue. Caller must have settled first.
    function _endSubscription(Subscription storage s) internal returns (uint256 unused, uint256 earned) {
        unused = _unusedOfPeriod(s);
        earned = uint256(s.rate) - unused;

        s.credit += uint128(unused);
        merchantAccrued += earned;
        totalUserFunds -= earned;

        s.plan = 0;
        s.periodStart = 0;
        s.rate = 0;
    }

    // ---------------------------------------------------------------------
    // Customer: funding
    // ---------------------------------------------------------------------

    /// @notice Top up `account` with USDC pulled from the caller.
    /// @dev Anyone may fund any account, so a team can pay for a bot's address.
    function deposit(address account, uint256 amount) public nonReentrant notPaused {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 before = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        Subscription storage s = _settle(account);
        s.credit += uint128(received);
        totalUserFunds += received;

        emit Deposited(account, msg.sender, received, s.credit);
    }

    /// @notice Top up in a single transaction using an EIP-2612 signature.
    /// @dev Native USDC on Base/Arbitrum/Ethereum supports `permit`. The permit
    /// is wrapped in try/catch so a griefer front-running it with the same
    /// signature cannot make the deposit revert on an already-spent nonce.
    function depositWithPermit(address account, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s_)
        external
    {
        try IERC20Permit(address(usdc)).permit(msg.sender, address(this), amount, deadline, v, r, s_) {} catch {}
        deposit(account, amount);
    }

    /// @notice Withdraw unallocated credit. Never blocked, even while paused.
    /// @dev Does not touch the current period's escrow; use `cancel` for that.
    function withdrawCredit(address to, uint256 amount) public nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Subscription storage s = _settle(msg.sender);
        if (s.credit < amount) revert InsufficientCredit(amount, s.credit);

        s.credit -= uint128(amount);
        totalUserFunds -= amount;

        emit CreditWithdrawn(msg.sender, to, amount);
        usdc.safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------------
    // Customer: subscription lifecycle
    // ---------------------------------------------------------------------

    /// @notice Start a subscription. Charges the first period immediately from
    /// credit; subsequent periods renew themselves for as long as credit lasts.
    function subscribe(uint8 planId) public {
        _subscribeFor(msg.sender, planId);
    }

    /// @notice Fund and subscribe in one transaction.
    function depositAndSubscribe(uint256 amount, uint8 planId) external {
        deposit(msg.sender, amount);
        _subscribeFor(msg.sender, planId);
    }

    function _subscribeFor(address account, uint8 planId) internal notPaused {
        Plan memory plan = _plans[planId];
        if (plan.price == 0) revert UnknownPlan(planId);
        if (!plan.active) revert PlanClosed(planId);

        Subscription storage s = _settle(account);
        if (s.plan != 0) revert AlreadySubscribed(s.plan);
        if (s.credit < plan.price) revert InsufficientCredit(plan.price, s.credit);

        s.credit -= plan.price;
        s.plan = planId;
        s.rate = plan.price;
        s.periodStart = uint40(block.timestamp);

        emit Subscribed(account, planId, plan.price, uint64(block.timestamp));
    }

    /// @notice Switch plans. The unused remainder of the current period is
    /// credited back and a fresh period starts now at the new plan's price.
    function changePlan(uint8 newPlanId) external notPaused {
        Plan memory plan = _plans[newPlanId];
        if (plan.price == 0) revert UnknownPlan(newPlanId);
        if (!plan.active) revert PlanClosed(newPlanId);

        Subscription storage s = _settle(msg.sender);
        if (s.plan == 0) revert NotSubscribed();
        if (s.plan == newPlanId) revert SamePlan(newPlanId);

        uint8 oldPlan = s.plan;
        (uint256 refunded,) = _endSubscription(s);

        if (s.credit < plan.price) revert InsufficientCredit(plan.price, s.credit);
        s.credit -= plan.price;
        s.plan = newPlanId;
        s.rate = plan.price;
        s.periodStart = uint40(block.timestamp);

        emit PlanChanged(msg.sender, oldPlan, newPlanId, refunded);
    }

    /// @notice Cancel immediately. The unused remainder of the current period
    /// is returned to credit; withdraw it with `withdrawCredit`.
    function cancel() public {
        Subscription storage s = _settle(msg.sender);
        if (s.plan == 0) revert NotSubscribed();

        uint8 plan = s.plan;
        (uint256 refunded, uint256 forfeited) = _endSubscription(s);
        emit Cancelled(msg.sender, plan, refunded, forfeited);
    }

    /// @notice Cancel and send the whole remaining balance back in one call.
    function cancelAndWithdraw(address to) external {
        cancel();
        uint256 credit = _subs[msg.sender].credit;
        // Cancelling in the final seconds of a period can round the refund to
        // zero; treat that as a clean cancel rather than reverting the whole tx.
        if (credit != 0) withdrawCredit(to, credit);
    }

    // ---------------------------------------------------------------------
    // Settlement helpers (anyone may call; they only realise what is already owed)
    // ---------------------------------------------------------------------

    /// @notice Crystallise elapsed periods for one account into `merchantAccrued`.
    function settle(address account) external {
        _settle(account);
    }

    /// @notice Batch form, for the owner's periodic revenue sweep.
    function settleMany(address[] calldata accounts) external {
        for (uint256 i; i < accounts.length; ++i) {
            _settle(accounts[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @inheritdoc ISubscriptionBilling
    function isSubscribed(address account) external view returns (bool) {
        return _project(_subs[account]).plan != 0;
    }

    /// @inheritdoc ISubscriptionBilling
    function entitlementOf(address account) external view returns (bool active, uint8 plan) {
        plan = _project(_subs[account]).plan;
        active = plan != 0;
    }

    /// @inheritdoc ISubscriptionBilling
    function statusOf(address account) external view returns (Status memory st) {
        Projection memory p = _project(_subs[account]);
        st.plan = p.plan;
        st.active = p.plan != 0;
        st.rate = p.rate;
        st.credit = p.credit;
        if (!st.active) return st;

        st.periodEnd = uint64(uint256(p.periodStart) + PERIOD);
        // Credit funds this many further periods beyond the current one. An
        // absurdly over-funded account is reported as saturated rather than
        // wrapping a uint64, so a gateway can never cache on a wrapped value.
        uint256 expires = uint256(p.periodStart) + (1 + uint256(p.credit) / p.rate) * PERIOD;
        st.expiresAt = expires > type(uint64).max ? type(uint64).max : uint64(expires);

        Subscription memory projected =
            Subscription({plan: p.plan, periodStart: p.periodStart, rate: p.rate, credit: p.credit});
        st.refundable = uint256(p.credit) + _unusedOfPeriod(projected);
    }

    /// @notice Raw stored record, without projecting elapsed periods.
    /// @dev For debugging and indexers; `statusOf` is what a gateway should read.
    function rawSubscription(address account) external view returns (Subscription memory) {
        return _subs[account];
    }

    function plans(uint8 planId) external view returns (Plan memory) {
        return _plans[planId];
    }

    /// @notice Revenue the owner could withdraw if every account were settled.
    /// @dev `merchantAccrued` only counts settled accounts; this is the true figure.
    function accruedIncluding(address[] calldata accounts) external view returns (uint256 total) {
        total = merchantAccrued;
        for (uint256 i; i < accounts.length; ++i) {
            total += _project(_subs[accounts[i]]).earned;
        }
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    /// @notice Create or reprice a plan.
    /// @dev Repricing affects new sign-ups and plan changes only. Existing
    /// subscribers keep the rate they signed up at until they act, so a price
    /// change can never be applied retroactively to periods already consumed.
    /// Set `active=false` to close a plan to new sign-ups without evicting anyone.
    function setPlan(uint8 planId, uint128 price, bool active) external onlyOwner {
        if (planId == 0) revert UnknownPlan(0);
        if (price == 0) revert ZeroAmount();
        _plans[planId] = Plan({price: price, active: active});
        emit PlanSet(planId, price, active);
    }

    /// @notice Withdraw earned revenue.
    function withdrawRevenue(address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount > merchantAccrued) revert InsufficientRevenue(amount, merchantAccrued);
        merchantAccrued -= amount;
        emit RevenueWithdrawn(to, amount);
        usdc.safeTransfer(to, amount);
    }

    /// @notice Block deposits, sign-ups and plan changes. Exits stay open.
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    /// @notice Recover tokens that are not owed to anyone.
    /// @dev For the billing token this is strictly the surplus over
    /// `totalUserFunds + merchantAccrued`, i.e. USDC sent here by mistake.
    function sweep(IERC20 token, address to) external nonReentrant onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = token.balanceOf(address(this));
        if (token == usdc) {
            uint256 reserved = totalUserFunds + merchantAccrued;
            amount = amount > reserved ? amount - reserved : 0;
        }
        if (amount == 0) revert ZeroAmount();
        emit Swept(address(token), to, amount);
        token.safeTransfer(to, amount);
    }
}
