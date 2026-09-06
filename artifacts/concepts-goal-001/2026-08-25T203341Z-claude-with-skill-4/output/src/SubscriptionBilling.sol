// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, continuously-metered subscriptions denominated in an ERC-20 (USDC).
///
/// @dev Design note, because this is the part that decides whether the thing works at all.
///
/// A contract does nothing between transactions. There is no cron, no scheduler, no timer. So
/// "charge every subscriber $5 on the 1st of the month" is not a feature, it is a promise that
/// somebody sends N transactions on the 1st of every month forever and pays the gas. Nobody is
/// paid to do that, so eventually nobody does, and the billing quietly stops.
///
/// This contract has no scheduled transaction. A subscription is a prepaid balance draining at a
/// fixed rate, and the drain is *computed at read time* from a timestamp:
///
///     owed(user) = min(rate * (now - startedAt) / PERIOD, deposited)
///
/// `isSubscribed()` is a free `eth_call` against that formula. It becomes false on its own when
/// the prepaid balance runs out — no liquidation transaction, no keeper, no bad debt (the money
/// was already collected up front), no oracle. Time passing is the only thing that has to happen,
/// and time passes for free.
///
/// The owed amount is always recomputed against a fixed `startedAt`, never accumulated
/// incrementally. That matters: incremental accrual floors a division on every settle, so anyone
/// could call `settle` once a second and round the operator's revenue away. Here the floor is
/// applied once, to the running total, so the result is identical no matter how often — or
/// whether — anyone calls `settle`.
///
/// One recurring transaction exists, and it is the operator's own payday: `settle()` moves money
/// that users have already spent out of their refundable balance and into `claimable`, and
/// `collect()` pays it out. Who sends it: the operator. Why: it is revenue that is already theirs
/// and they cannot have it otherwise. Is that enough: sweeping 100 accounts is roughly 600k gas,
/// about two cents on Base at 0.01 gwei, against $500–$2,000 of monthly revenue. And if it never
/// gets sent, nothing breaks — the USDC sits in the contract, still owed to the same parties, and
/// no user loses access. The state machine does not depend on it.
///
/// Amounts are in the billing token's base units (USDC has 6 decimals, so $5.00 == 5_000_000).
/// The contract never reads `decimals()`; prices are configured in base units.
contract SubscriptionBilling is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice A "month" for billing purposes. 30 days, flat — calendar months are not a thing
    /// the EVM knows about, and 30 days is what everyone means by "monthly" in a rate.
    uint256 public constant PERIOD = 30 days;

    /// @notice Reserved plan id meaning "no subscription".
    uint8 public constant NO_PLAN = 0;

    struct Plan {
        /// @dev Price per PERIOD in billing-token base units. Zero means the plan does not exist.
        uint64 pricePerPeriod;
        /// @dev New subscriptions and plan changes are blocked when false. Existing subscribers
        /// are unaffected — see `ratePerPeriod` on Account.
        bool active;
        string name;
    }

    struct Account {
        /// @dev Total ever deposited during the *current* subscription. Reset on cancel/switch.
        uint128 deposited;
        /// @dev Portion of `deposited` already moved into `claimable`. Monotonic within a
        /// subscription, reset alongside `deposited`.
        uint128 charged;
        /// @dev Price per PERIOD snapshotted when the user subscribed. Deliberately a copy, not a
        /// lookup: the operator raising a plan's price must not silently start draining the
        /// prepaid balance of someone who already paid at the old price.
        uint64 ratePerPeriod;
        /// @dev Start of the current subscription. All accrual is measured from here.
        uint40 startedAt;
        uint8 planId;
    }

    /// @notice The billing token. Immutable — swapping it would strand every deposit.
    IERC20 public immutable token;

    /// @notice Where `collect()` sends revenue. Only the owner can change it, but anyone can
    /// trigger the payout, so a lost owner key does not strand collected revenue.
    address public revenueRecipient;

    /// @notice Revenue that has been settled out of user balances and is waiting to be collected.
    uint256 public claimable;

    /// @notice Sum of every account's `deposited - charged`. Tracked so `sweepSurplus` can tell
    /// user money apart from tokens that were sent here by accident.
    uint256 public totalUserBalance;

    mapping(uint8 planId => Plan) private _plans;
    mapping(address account => Account) private _accounts;

    event PlanSet(uint8 indexed planId, uint64 pricePerPeriod, bool active, string name);
    event RevenueRecipientSet(address indexed recipient);
    event Subscribed(address indexed account, uint8 indexed planId, uint64 ratePerPeriod);
    event MeterRestarted(address indexed account, uint40 startedAt);
    event ToppedUp(address indexed account, address indexed payer, uint256 amount, uint40 expiresAt);
    event PlanChanged(
        address indexed account, uint8 indexed fromPlanId, uint8 indexed toPlanId, uint64 ratePerPeriod
    );
    event Withdrawn(address indexed account, address indexed to, uint256 amount);
    event Cancelled(address indexed account, uint8 indexed planId, uint256 refunded);
    event Settled(address indexed account, uint256 amount);
    event Collected(address indexed recipient, uint256 amount);
    event SurplusSwept(address indexed recipient, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPlan(uint8 planId);
    error PlanInactive(uint8 planId);
    error AlreadySubscribed(uint8 planId);
    error NotSubscribed();
    error InsufficientBalance(uint256 requested, uint256 available);
    error AmountTooLarge();
    error CannotRescueBillingToken();

    constructor(IERC20 billingToken, address initialOwner, address initialRecipient) Ownable(initialOwner) {
        if (address(billingToken) == address(0)) revert ZeroAddress();
        if (initialRecipient == address(0)) revert ZeroAddress();
        token = billingToken;
        revenueRecipient = initialRecipient;
        emit RevenueRecipientSet(initialRecipient);
    }

    // -------------------------------------------------------------------------------------------
    // Reads — this is what the API backend calls, per request, for free, via eth_call.
    // -------------------------------------------------------------------------------------------

    /// @notice The one question the backend asks: is this address paid up right now?
    /// @dev Pure function of stored state and `block.timestamp`. No transaction ever has to run to
    /// flip this to false — it goes false by itself the second the prepaid balance is exhausted.
    function isSubscribed(address account) public view returns (bool) {
        return block.timestamp < expiresAt(account);
    }

    /// @notice The timestamp at which `account` stops being subscribed unless they top up.
    /// @dev Returns 0 for accounts with no plan, so `isSubscribed` is false for them.
    function expiresAt(address account) public view returns (uint256) {
        Account storage a = _accounts[account];
        if (a.planId == NO_PLAN) return 0;
        return uint256(a.startedAt) + (uint256(a.deposited) * PERIOD) / a.ratePerPeriod;
    }

    /// @notice Total spent so far this subscription, capped at what was deposited.
    function owedOf(address account) public view returns (uint256) {
        Account storage a = _accounts[account];
        if (a.planId == NO_PLAN) return 0;
        uint256 elapsed = block.timestamp - a.startedAt;
        uint256 gross = (uint256(a.ratePerPeriod) * elapsed) / PERIOD;
        return gross > a.deposited ? a.deposited : gross;
    }

    /// @notice What the user would get back if they cancelled in this block.
    function refundableOf(address account) public view returns (uint256) {
        return _accounts[account].deposited - owedOf(account);
    }

    /// @notice Revenue accrued from `account` that has not been moved into `claimable` yet.
    function pendingOf(address account) public view returns (uint256) {
        return owedOf(account) - _accounts[account].charged;
    }

    /// @notice Sum of `pendingOf` across the given accounts. Lets the operator price a sweep
    /// before sending it — call it off-chain against a list from the `Subscribed` event log.
    function pendingOfMany(address[] calldata accounts) external view returns (uint256 total) {
        for (uint256 i; i < accounts.length; ++i) {
            total += pendingOf(accounts[i]);
        }
    }

    function accountOf(address account) external view returns (Account memory) {
        return _accounts[account];
    }

    function planOf(uint8 planId) external view returns (Plan memory) {
        return _plans[planId];
    }

    /// @notice Everything the backend or a frontend needs about an address in one call.
    function statusOf(address account)
        external
        view
        returns (bool subscribed, uint8 planId, uint256 expiry, uint256 refundable, uint64 ratePerPeriod)
    {
        Account storage a = _accounts[account];
        return (isSubscribed(account), a.planId, expiresAt(account), refundableOf(account), a.ratePerPeriod);
    }

    // -------------------------------------------------------------------------------------------
    // Customer actions
    // -------------------------------------------------------------------------------------------

    /// @notice Start a subscription and fund it. Requires an ERC-20 approval for `amount` first.
    function subscribe(uint8 planId, uint256 amount) external nonReentrant {
        Account storage a = _accounts[msg.sender];
        if (a.planId != NO_PLAN) revert AlreadySubscribed(a.planId);

        Plan storage p = _plans[planId];
        if (p.pricePerPeriod == 0) revert InvalidPlan(planId);
        if (!p.active) revert PlanInactive(planId);

        a.planId = planId;
        a.ratePerPeriod = p.pricePerPeriod;
        a.startedAt = uint40(block.timestamp);

        emit Subscribed(msg.sender, planId, p.pricePerPeriod);
        _pullFunds(msg.sender, msg.sender, amount);
    }

    /// @notice Add funds to your own account, extending the expiry.
    function topUp(uint256 amount) external nonReentrant {
        if (_accounts[msg.sender].planId == NO_PLAN) revert NotSubscribed();
        _pullFunds(msg.sender, msg.sender, amount);
    }

    /// @notice Add funds to someone else's account. Nothing here is exploitable — it can only
    /// increase the recipient's balance — and it means a company can pay for a developer's key.
    function topUpFor(address account, uint256 amount) external nonReentrant {
        if (_accounts[account].planId == NO_PLAN) revert NotSubscribed();
        _pullFunds(account, msg.sender, amount);
    }

    /// @notice Move to a different plan. Settles what you owe at the old rate, then restarts the
    /// meter at the new rate with whatever is left over.
    function changePlan(uint8 newPlanId) external nonReentrant {
        Account storage a = _accounts[msg.sender];
        uint8 oldPlanId = a.planId;
        if (oldPlanId == NO_PLAN) revert NotSubscribed();

        Plan storage p = _plans[newPlanId];
        if (p.pricePerPeriod == 0) revert InvalidPlan(newPlanId);
        if (!p.active) revert PlanInactive(newPlanId);

        _settle(msg.sender);

        // Carry the unspent remainder over and reset the meter.
        uint128 remaining = a.deposited - a.charged;
        a.deposited = remaining;
        a.charged = 0;
        a.startedAt = uint40(block.timestamp);
        a.planId = newPlanId;
        a.ratePerPeriod = p.pricePerPeriod;

        emit PlanChanged(msg.sender, oldPlanId, newPlanId, p.pricePerPeriod);
    }

    /// @notice Pull unspent funds back out without cancelling. Shortens your expiry accordingly.
    function withdraw(uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Account storage a = _accounts[msg.sender];
        if (a.planId == NO_PLAN) revert NotSubscribed();

        _settle(msg.sender);

        uint256 available = a.deposited - a.charged;
        if (amount > available) revert InsufficientBalance(amount, available);

        // casting to 'uint128' is safe because `amount <= available <= a.deposited`, a uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        a.deposited -= uint128(amount);
        totalUserBalance -= amount;

        emit Withdrawn(msg.sender, to, amount);
        token.safeTransfer(to, amount);
    }

    /// @notice Cancel and take back every unspent cent, prorated to the second.
    /// @dev Unconditional. There is no owner check, no pause, and no cooldown on this path — the
    /// operator cannot stop a customer from getting their unused balance back.
    function cancel(address to) external nonReentrant returns (uint256 refund) {
        if (to == address(0)) revert ZeroAddress();

        Account storage a = _accounts[msg.sender];
        uint8 planId = a.planId;
        if (planId == NO_PLAN) revert NotSubscribed();

        _settle(msg.sender);

        refund = a.deposited - a.charged;
        totalUserBalance -= refund;

        delete _accounts[msg.sender];

        emit Cancelled(msg.sender, planId, refund);
        if (refund > 0) token.safeTransfer(to, refund);
    }

    // -------------------------------------------------------------------------------------------
    // Revenue — the only recurring transaction in the system, and the operator sends it for money.
    // -------------------------------------------------------------------------------------------

    /// @notice Move accrued revenue out of these accounts' balances and into `claimable`.
    /// @dev Permissionless on purpose. It moves money only in the direction the accrual formula
    /// already says it went, so there is no version of this call that harms the accounts named in
    /// it, and it does not need to be trusted to a single key. Calling it more often does not
    /// change the total (see the contract-level note on fixed-start accrual).
    function settle(address[] calldata accounts) public returns (uint256 total) {
        for (uint256 i; i < accounts.length; ++i) {
            total += _settle(accounts[i]);
        }
    }

    /// @notice Pay out settled revenue to `revenueRecipient`.
    /// @dev Permissionless: the destination is fixed by the owner in advance, so letting anyone
    /// push the button removes a way for revenue to get stuck without adding a way to steal it.
    function collect() public returns (uint256 amount) {
        amount = claimable;
        if (amount == 0) return 0;
        claimable = 0;
        emit Collected(revenueRecipient, amount);
        token.safeTransfer(revenueRecipient, amount);
    }

    /// @notice The monthly operator transaction: settle a batch, then take the money. One call.
    function settleAndCollect(address[] calldata accounts) external returns (uint256 settled, uint256 collected) {
        settled = settle(accounts);
        collected = collect();
    }

    // -------------------------------------------------------------------------------------------
    // Owner
    // -------------------------------------------------------------------------------------------

    /// @notice Create or update a plan.
    /// @dev Changing `pricePerPeriod` affects new subscriptions and plan changes only. Everyone
    /// already subscribed keeps the rate they signed up at, because it is copied into their
    /// account. Setting `active = false` retires a plan without touching its subscribers: they
    /// keep their access, keep topping up, and keep their refund rights.
    function setPlan(uint8 planId, uint64 pricePerPeriod, bool active, string calldata name) external onlyOwner {
        if (planId == NO_PLAN) revert InvalidPlan(planId);
        if (pricePerPeriod == 0) revert InvalidPlan(planId);
        _plans[planId] = Plan({pricePerPeriod: pricePerPeriod, active: active, name: name});
        emit PlanSet(planId, pricePerPeriod, active, name);
    }

    function setRevenueRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        revenueRecipient = recipient;
        emit RevenueRecipientSet(recipient);
    }

    /// @notice Recover tokens that are neither user balances nor settled revenue — i.e. tokens
    /// somebody transferred in by mistake.
    /// @dev Bounded by construction: it can only ever move `balanceOf(this) - totalUserBalance -
    /// claimable`. It cannot reach a single cent of anyone's deposit.
    function sweepSurplus(address to) external onlyOwner returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        uint256 reserved = totalUserBalance + claimable;
        uint256 held = token.balanceOf(address(this));
        amount = held > reserved ? held - reserved : 0;
        if (amount == 0) return 0;
        emit SurplusSwept(to, amount);
        token.safeTransfer(to, amount);
    }

    /// @notice Recover a *different* ERC-20 sent here by mistake. Cannot touch the billing token.
    function rescueToken(IERC20 other, address to, uint256 amount) external onlyOwner {
        if (address(other) == address(token)) revert CannotRescueBillingToken();
        if (to == address(0)) revert ZeroAddress();
        other.safeTransfer(to, amount);
    }

    // -------------------------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------------------------

    function _settle(address account) internal returns (uint256 amount) {
        Account storage a = _accounts[account];
        if (a.planId == NO_PLAN) return 0;

        uint256 owed = owedOf(account);
        amount = owed - a.charged;
        if (amount == 0) return 0;

        // casting to 'uint128' is safe because `owedOf` caps its result at `a.deposited`, a uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        a.charged = uint128(owed);
        claimable += amount;
        totalUserBalance -= amount;

        emit Settled(account, amount);
    }

    /// @dev Credits `account` with whatever the contract actually received, so a token that takes
    /// a transfer fee cannot leave the contract crediting more than it holds.
    function _pullFunds(address account, address payer, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();

        _restartIfLapsed(account);

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(payer, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received > type(uint128).max) revert AmountTooLarge();

        Account storage a = _accounts[account];
        // The `+` is checked by the compiler, so an overflowing deposit reverts rather than wraps.
        // casting to 'uint128' is safe because `received` is bounded above
        // forge-lint: disable-next-line(unsafe-typecast)
        a.deposited += uint128(received);
        totalUserBalance += received;

        uint256 expiry = expiresAt(account);
        if (expiry > type(uint40).max) revert AmountTooLarge();

        emit ToppedUp(account, payer, received, uint40(expiry));
    }

    /// @dev A subscription that ran out of money is not a debt — the customer simply stopped being
    /// served. Without this, someone who lapsed in March and topped up in June would have June's
    /// deposit instantly eaten by three months of "arrears" for a service they never received.
    /// Restarting the meter charges them from the moment they fund it again.
    function _restartIfLapsed(address account) internal {
        Account storage a = _accounts[account];
        if (a.planId == NO_PLAN) return;
        if (a.startedAt == uint40(block.timestamp)) return; // meter started this block; nothing to roll
        if (block.timestamp < expiresAt(account)) return;

        _settle(account);

        a.deposited -= a.charged; // sub-cent dust at most; carried over rather than confiscated
        a.charged = 0;
        a.startedAt = uint40(block.timestamp);

        emit MeterRestarted(account, uint40(block.timestamp));
    }
}
