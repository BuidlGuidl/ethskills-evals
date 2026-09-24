// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISubscriptionBilling} from "./ISubscriptionBilling.sol";

/**
 * @title SubscriptionBilling
 * @notice Prepaid, self-custodied subscription billing in a single ERC-20 (intended: USDC).
 *
 * ## The model
 *
 * A customer deposits USDC into their own balance inside this contract, then picks a
 * plan. Subscribing buys exactly one period up front: the period's price leaves their
 * free balance and sits in escrow until that period has actually elapsed. Only then
 * does it become merchant revenue. Every later period works the same way.
 *
 * ## Nothing here happens on a timer
 *
 * Solidity has no scheduler. Nothing renews itself. So the design splits the two
 * things a subscription needs into separate mechanisms:
 *
 *  - ENTITLEMENT is *computed*, never poked. `isSubscribed()` is a pure view that
 *    answers "has this account prepaid enough to be covered at this instant?" It is
 *    correct whether or not anyone has touched the contract in months. The API
 *    gateway therefore never depends on a keeper being alive.
 *
 *  - SETTLEMENT is *poked*, by anyone, via `settle()` / `settleMany()`. Settling is
 *    what converts elapsed escrow into withdrawable revenue. The merchant is the
 *    party with an incentive to call it, because it is literally how they get paid;
 *    no altruistic keeper and no gas subsidy is required. If the merchant never
 *    calls it, the only consequence is that their own money sits here unclaimed --
 *    customers are unaffected and no funds are lost, because `_settle` reconstructs
 *    every missed period in closed form when it finally runs.
 *
 * Both paths use the same arithmetic, so a settled account and an unsettled one
 * always agree about who is subscribed.
 *
 * ## What the owner can and cannot do
 *
 * The owner can add plans, retire plans, and point revenue at a different payout
 * address. The owner can NOT pause the contract, cannot touch customer balances,
 * cannot cancel anyone, and cannot stop a withdrawal. There is no admin path to a
 * customer's deposit. If the owner key is lost or the merchant walks away, every
 * customer can still `cancel()` and `withdraw()` their unused funds forever.
 * Retiring a plan blocks new signups only; existing subscribers keep renewing at
 * their locked-in rate until they choose to leave.
 *
 * ## Prices are locked in per customer
 *
 * `Account.periodPrice` is captured when the customer subscribes and is what every
 * renewal charges. Changing a plan's price never reaches an existing subscriber --
 * they are grandfathered until they call `changePlan` themselves. This is a
 * deliberate safety property as much as a courtesy: because settlement can run long
 * after the fact, a mutable price would let the merchant raise the rate and then
 * settle a year of backdated periods at the new number.
 */
contract SubscriptionBilling is ISubscriptionBilling, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice One billing period. "Monthly" is 30 fixed days, not a calendar month,
    ///         so a year is ~12.17 charges. Calendar months would need an oracle for
    ///         month length; 30 days keeps renewal arithmetic exact and closed-form.
    uint256 public constant PERIOD = 30 days;

    struct Plan {
        uint128 price; // per PERIOD, in token units (USDC: 6 decimals)
        bool active; // false = no new signups; existing subscribers keep renewing
    }

    struct Account {
        uint128 balance; // free funds, withdrawable by the customer at any time
        uint128 periodPrice; // locked-in rate; also the amount escrowed for the current period
        uint64 periodStart; // start of the currently escrowed period
        uint64 paidThrough; // end of the currently escrowed period
        uint32 planId; // 0 = not subscribed
    }

    IERC20 public immutable token;

    mapping(address => Account) internal _accounts;
    mapping(uint32 => Plan) internal _plans;
    uint32 public planCount;

    /// @notice Sum of all customers' free balances. Never claimable by the merchant.
    uint256 public totalCustomerBalance;
    /// @notice Sum of all escrowed (paid-for but not yet elapsed) periods.
    ///         Refundable to customers on cancel; not claimable by the merchant.
    uint256 public totalEscrowed;
    /// @notice Revenue from periods that have actually elapsed. Merchant-claimable.
    uint256 public withdrawableRevenue;
    /// @notice Lifetime revenue paid out, for bookkeeping.
    uint256 public lifetimeRevenueWithdrawn;

    /// @notice Where revenue goes. Anyone may trigger the payout; only here.
    address public payoutAddress;

    event PlanAdded(uint32 indexed planId, uint128 price);
    event PlanActiveSet(uint32 indexed planId, bool active);
    event PayoutAddressSet(address indexed payoutAddress);
    event Deposited(address indexed account, address indexed from, uint256 amount);
    event Withdrawn(address indexed account, address indexed to, uint256 amount);
    event Subscribed(address indexed account, uint32 indexed planId, uint128 price, uint64 paidThrough);
    event Renewed(address indexed account, uint32 indexed planId, uint256 periods, uint64 paidThrough);
    event Lapsed(address indexed account, uint32 indexed planId, uint64 endedAt);
    event Cancelled(address indexed account, uint32 indexed planId, uint256 refunded, uint256 earned);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event SurplusRescued(address indexed tokenAddress, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error UnknownPlan();
    error PlanRetired();
    error AlreadySubscribed();
    error NotSubscribed();
    error InsufficientBalance();
    error InsufficientRevenue();
    error SamePlan();
    error NoSurplus();
    error BalanceOverflow();

    constructor(IERC20 token_, address owner_, address payoutAddress_) Ownable(owner_) {
        if (address(token_) == address(0) || payoutAddress_ == address(0)) revert ZeroAddress();
        token = token_;
        payoutAddress = payoutAddress_;
        emit PayoutAddressSet(payoutAddress_);
    }

    // ---------------------------------------------------------------------
    // Entitlement: pure reads, correct without anyone having poked anything
    // ---------------------------------------------------------------------

    /**
     * @notice Is this account entitled to service right now?
     * @dev Two ways to be entitled:
     *      1. The escrowed period still covers `now`, or
     *      2. that period has elapsed and the free balance covers every period
     *         needed to reach `now`. Case 2 is the unsettled case -- the customer
     *         has the money, so they get the service, and the merchant collects
     *         whenever they next call `settle()`. This is what keeps the gateway
     *         independent of keeper liveness.
     */
    function isSubscribed(address account) public view returns (bool) {
        Account storage a = _accounts[account];
        if (a.planId == 0) return false;
        if (block.timestamp < a.paidThrough) return true;
        uint256 due = ((block.timestamp - a.paidThrough) / PERIOD) + 1;
        return uint256(a.balance) >= due * uint256(a.periodPrice);
    }

    /// @inheritdoc ISubscriptionBilling
    function planOf(address account) external view returns (uint32) {
        return isSubscribed(account) ? _accounts[account].planId : 0;
    }

    /**
     * @notice The instant this account loses service if it is never topped up again.
     * @dev Current escrowed period plus every whole period the free balance can still
     *      buy. A gateway may cache an allow decision until this timestamp without
     *      reading the chain again -- the only events that can move it earlier are
     *      `cancel` and `withdraw`, both of which the customer initiates, so watch
     *      those two events if you cache aggressively.
     */
    function entitledUntil(address account) public view returns (uint64) {
        Account storage a = _accounts[account];
        if (a.planId == 0) return 0;
        uint256 price = a.periodPrice;
        // Whole periods only: a partial period buys no service, so flooring here is
        // the intended behaviour, not a precision loss.
        uint256 extra = uint256(a.balance) / price;
        uint256 end = uint256(a.paidThrough) + (extra * PERIOD);
        return end > type(uint64).max ? type(uint64).max : uint64(end);
    }

    /// @notice Whole periods of runway left after the currently escrowed one.
    function periodsOfRunway(address account) external view returns (uint256) {
        Account storage a = _accounts[account];
        if (a.planId == 0) return 0;
        return uint256(a.balance) / uint256(a.periodPrice);
    }

    /// @notice What `cancel()` would return to the free balance right now.
    function refundableIfCancelled(address account) external view returns (uint256) {
        Account storage a = _accounts[account];
        if (a.planId == 0 || !isSubscribed(account)) return 0;
        (uint128 balance, uint128 periodPrice,, uint64 paidThrough,) = _preview(account);
        uint256 unearned = 0;
        if (paidThrough > block.timestamp) {
            uint256 elapsed = PERIOD - (paidThrough - block.timestamp);
            unearned = periodPrice - ((uint256(periodPrice) * elapsed) / PERIOD);
        }
        return uint256(balance) + unearned;
    }

    function accountOf(address account) external view returns (Account memory) {
        return _accounts[account];
    }

    function planOfId(uint32 planId) external view returns (Plan memory) {
        return _plans[planId];
    }

    // ---------------------------------------------------------------------
    // Customer actions
    // ---------------------------------------------------------------------

    /// @notice Top up your own account. Requires an ERC-20 approval first.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's account (team wallet paying for a dev, etc).
    function depositFor(address account, uint256 amount) external {
        if (account == address(0)) revert ZeroAddress();
        _deposit(account, amount);
    }

    function _deposit(address account, uint256 amount) internal nonReentrant {
        if (amount == 0) revert ZeroAmount();
        // Settle first: otherwise a new deposit would retroactively fund periods the
        // account already lapsed through, back-charging the customer for months in
        // which they had no funds and (correctly) got no service.
        _settle(account);

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before; // fee-on-transfer safe

        // Balances are uint128 to keep an Account in two storage slots. Unreachable
        // with any real USDC amount, but a truncating cast is not worth the risk.
        if (received > type(uint128).max - _accounts[account].balance) revert BalanceOverflow();
        _accounts[account].balance += uint128(received);
        totalCustomerBalance += received;
        emit Deposited(account, msg.sender, received);
    }

    /**
     * @notice Withdraw free balance. Always available -- no pause, no admin gate.
     * @dev The currently escrowed period is not touched, so withdrawing mid-period
     *      does not cut off service; it just shortens runway. Withdraw everything
     *      and the subscription lapses at the end of the period already paid for.
     */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);

        Account storage a = _accounts[msg.sender];
        if (a.balance < amount) revert InsufficientBalance();
        a.balance -= uint128(amount);
        totalCustomerBalance -= amount;

        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, msg.sender, amount);
    }

    /// @notice Cancel (if subscribed) and take everything back in one transaction.
    function cancelAndWithdrawAll() external nonReentrant {
        _settle(msg.sender);
        if (_accounts[msg.sender].planId != 0) _cancel(msg.sender);

        Account storage a = _accounts[msg.sender];
        uint256 amount = a.balance;
        if (amount == 0) revert ZeroAmount();
        a.balance = 0;
        totalCustomerBalance -= amount;

        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, msg.sender, amount);
    }

    /// @notice Start a subscription. Buys the first period immediately.
    function subscribe(uint32 planId) external nonReentrant {
        _settle(msg.sender);
        if (_accounts[msg.sender].planId != 0) revert AlreadySubscribed();
        _startPeriod(msg.sender, planId, true);
    }

    /**
     * @notice Switch plans. Refunds the unused slice of the current period, then
     *         starts a fresh period on the new plan at today's price.
     */
    function changePlan(uint32 newPlanId) external nonReentrant {
        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (a.planId == 0) revert NotSubscribed();
        if (a.planId == newPlanId) revert SamePlan();
        _cancel(msg.sender);
        _startPeriod(msg.sender, newPlanId, true);
    }

    /**
     * @notice Cancel. The unused fraction of the current period is prorated back to
     *         your free balance, to the second. Call `withdraw` to take it out.
     */
    function cancel() external nonReentrant {
        _settle(msg.sender);
        if (_accounts[msg.sender].planId == 0) revert NotSubscribed();
        _cancel(msg.sender);
    }

    // ---------------------------------------------------------------------
    // Settlement: permissionless. The merchant's incentive is getting paid.
    // ---------------------------------------------------------------------

    /// @notice Bring one account's billing up to date. Callable by anyone.
    function settle(address account) external {
        _settle(account);
    }

    /// @notice Batch version -- what the merchant's payout job actually calls.
    function settleMany(address[] calldata accounts) external {
        for (uint256 i = 0; i < accounts.length; ++i) {
            _settle(accounts[i]);
        }
    }

    /**
     * @notice Sweep earned revenue to `payoutAddress`.
     * @dev Intentionally callable by anyone: the destination is fixed, so there is
     *      nothing to steal, and it means payouts do not depend on the owner key
     *      being online. Only covers periods that have actually elapsed -- escrowed
     *      and customer balances are structurally out of reach.
     */
    function withdrawRevenue(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > withdrawableRevenue) revert InsufficientRevenue();
        withdrawableRevenue -= amount;
        lifetimeRevenueWithdrawn += amount;

        address to = payoutAddress;
        token.safeTransfer(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    // ---------------------------------------------------------------------
    // Owner: plan catalogue and payout destination. Nothing else.
    // ---------------------------------------------------------------------

    function addPlan(uint128 price) external onlyOwner returns (uint32 planId) {
        if (price == 0) revert ZeroAmount();
        planId = ++planCount;
        _plans[planId] = Plan({price: price, active: true});
        emit PlanAdded(planId, price);
    }

    /// @dev Retiring only blocks new signups. Existing subscribers keep their rate.
    function setPlanActive(uint32 planId, bool active) external onlyOwner {
        if (planId == 0 || planId > planCount) revert UnknownPlan();
        _plans[planId].active = active;
        emit PlanActiveSet(planId, active);
    }

    function setPayoutAddress(address newPayoutAddress) external onlyOwner {
        if (newPayoutAddress == address(0)) revert ZeroAddress();
        payoutAddress = newPayoutAddress;
        emit PayoutAddressSet(newPayoutAddress);
    }

    /**
     * @notice Recover tokens that do not belong to anyone here.
     * @dev For the billing token this is strictly the surplus above
     *      (customer balances + escrow + earned revenue) -- i.e. stray transfers
     *      sent directly to the contract. Customer money can never be rescued.
     */
    function rescueSurplus(address tokenAddress, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = IERC20(tokenAddress).balanceOf(address(this));
        if (tokenAddress == address(token)) {
            uint256 spokenFor = totalCustomerBalance + totalEscrowed + withdrawableRevenue;
            amount = amount > spokenFor ? amount - spokenFor : 0;
        }
        if (amount == 0) revert NoSurplus();
        IERC20(tokenAddress).safeTransfer(to, amount);
        emit SurplusRescued(tokenAddress, to, amount);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _startPeriod(address account, uint32 planId, bool requireActive) internal {
        if (planId == 0 || planId > planCount) revert UnknownPlan();
        Plan storage p = _plans[planId];
        if (requireActive && !p.active) revert PlanRetired();

        Account storage a = _accounts[account];
        uint128 price = p.price;
        if (a.balance < price) revert InsufficientBalance();

        a.balance -= price;
        totalCustomerBalance -= price;
        totalEscrowed += price;

        a.planId = planId;
        a.periodPrice = price;
        a.periodStart = uint64(block.timestamp);
        a.paidThrough = uint64(block.timestamp + PERIOD);

        emit Subscribed(account, planId, price, a.paidThrough);
    }

    /**
     * @dev Advance billing to the present. Closed form, no loop: an account ignored
     *      for three years settles in the same gas as one settled yesterday.
     *
     *      `due` is how many further periods it takes to cover `now`. `afford` is how
     *      many the free balance can buy. We buy `k = min(due, afford)`:
     *        - k == due  -> still subscribed, the k-th period is the new escrow.
     *        - k <  due  -> ran out of money partway; charge for the k periods that
     *                       were served (the gateway was answering "yes" for them,
     *                       because `isSubscribed` uses this same comparison) and
     *                       lapse at the moment the money ran out.
     *
     *      Note `k <= due` always, so `paidThrough` can never be pushed further than
     *      one period past `now` -- the uint64 cast cannot be made to overflow.
     */
    function _settle(address account) internal {
        Account storage a = _accounts[account];
        uint32 planId = a.planId;
        if (planId == 0) return;

        uint64 paidThrough = a.paidThrough;
        if (block.timestamp < paidThrough) return; // current period still running

        uint256 price = a.periodPrice;
        uint256 due = ((block.timestamp - paidThrough) / PERIOD) + 1;
        uint256 afford = uint256(a.balance) / price;
        uint256 k = due < afford ? due : afford;

        if (k == 0) {
            // Nothing left to buy. The escrowed period is fully elapsed, so it is
            // earned; the subscription ended at `paidThrough`.
            totalEscrowed -= price;
            withdrawableRevenue += price;
            a.planId = 0;
            a.periodPrice = 0;
            emit Lapsed(account, planId, paidThrough);
            return;
        }

        uint256 spent = k * price;
        a.balance -= uint128(spent);
        totalCustomerBalance -= spent;

        if (k == due) {
            // The last period bought covers `now` and runs into the future: it
            // replaces the old escrow one-for-one, so `totalEscrowed` is unchanged.
            // Everything before it has elapsed and is revenue.
            withdrawableRevenue += spent; // old period + (k-1) fully elapsed ones
            uint64 newStart = uint64(paidThrough + ((k - 1) * PERIOD));
            a.periodStart = newStart;
            a.paidThrough = newStart + uint64(PERIOD);
            emit Renewed(account, planId, k, a.paidThrough);
        } else {
            // Funds ran out. All k purchased periods are in the past, as is the old
            // escrowed one, so escrow drops to zero and the account lapses.
            totalEscrowed -= price;
            withdrawableRevenue += spent + price;
            uint64 endedAt = uint64(paidThrough + (k * PERIOD));
            a.periodStart = endedAt - uint64(PERIOD);
            a.paidThrough = endedAt;
            a.planId = 0;
            a.periodPrice = 0;
            emit Renewed(account, planId, k, endedAt);
            emit Lapsed(account, planId, endedAt);
        }
    }

    /// @dev Caller must have settled first and confirmed `planId != 0`, which
    ///      guarantees `paidThrough > block.timestamp` here.
    function _cancel(address account) internal {
        Account storage a = _accounts[account];
        uint32 planId = a.planId;
        uint256 price = a.periodPrice;

        // Round the *charge* down, not the refund: sub-unit dust goes to the
        // customer. `earned <= price` always, so the refund never exceeds escrow.
        uint256 elapsed = PERIOD - (uint256(a.paidThrough) - block.timestamp);
        uint256 earned = (price * elapsed) / PERIOD;
        uint256 unearned = price - earned;

        totalEscrowed -= price;
        withdrawableRevenue += earned;
        a.balance += uint128(unearned);
        totalCustomerBalance += unearned;

        a.planId = 0;
        a.periodPrice = 0;
        a.periodStart = uint64(block.timestamp);
        a.paidThrough = uint64(block.timestamp);

        emit Cancelled(account, planId, unearned, earned);
    }

    /// @dev Read-only mirror of `_settle`, so views can report post-settlement state
    ///      without requiring anyone to have paid gas to settle.
    function _preview(address account)
        internal
        view
        returns (uint128 balance, uint128 periodPrice, uint64 periodStart, uint64 paidThrough, uint32 planId)
    {
        Account storage a = _accounts[account];
        (balance, periodPrice, periodStart, paidThrough, planId) =
        (a.balance, a.periodPrice, a.periodStart, a.paidThrough, a.planId);
        if (planId == 0 || block.timestamp < paidThrough) {
            return (balance, periodPrice, periodStart, paidThrough, planId);
        }

        uint256 due = ((block.timestamp - paidThrough) / PERIOD) + 1;
        uint256 afford = uint256(balance) / periodPrice;
        uint256 k = due < afford ? due : afford;

        if (k == 0) return (balance, 0, periodStart, paidThrough, 0);

        balance -= uint128(k * periodPrice);
        if (k == due) {
            periodStart = uint64(paidThrough + ((k - 1) * PERIOD));
            paidThrough = periodStart + uint64(PERIOD);
        } else {
            paidThrough = uint64(paidThrough + (k * PERIOD));
            periodStart = paidThrough - uint64(PERIOD);
            periodPrice = 0;
            planId = 0;
        }
    }
}
