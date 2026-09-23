// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, self-serve subscription billing in USDC for an API service.
///
/// @dev Nothing in here runs on a schedule, because nothing onchain can. A plan
///      priced "$5/month" is stored as a monthly price and debited continuously
///      from the subscriber's prepaid balance: the charge owed at any instant is
///      derived from `block.timestamp - lastSettled`, so no monthly "charge day"
///      transaction exists for anybody to forget to send.
///
///      That has three consequences worth knowing:
///        * A subscription is active exactly while the prepaid balance still
///          covers the current second. `isSubscribed` is a pure view — your
///          backend reads it, nobody has to poke the contract first.
///        * Cancelling is exact. The subscriber has already paid for the time
///          they used and not a second more, so the refund is simply whatever
///          balance is left.
///        * The operator's revenue accrues whether or not anyone calls
///          `settle`. Settling only moves already-owed money out of subscriber
///          balances and into the withdrawable pot; it is bookkeeping, not a
///          deadline. See `settle` / `settleMany`.
contract SubscriptionBilling is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice A "month" for billing purposes. Fixed 30 days so the rate is
    ///         constant and predictable rather than drifting with the calendar.
    uint256 public constant SECONDS_PER_MONTH = 30 days;

    /// @notice A new subscription must start with at least this much runway, so
    ///         nobody ends up nominally subscribed but failing every API call.
    uint256 public constant MIN_RUNWAY_ON_SUBSCRIBE = 1 days;

    /// @notice The payment token. Immutable: this contract bills in one token.
    IERC20 public immutable token;

    struct Plan {
        /// @dev Price per 30 days, in token units (USDC: 6 decimals, so 5e6 = $5).
        ///      Immutable once created — see `addPlan`.
        uint96 pricePerMonth;
        /// @dev Whether new subscribers may join. Existing subscribers are
        ///      unaffected by this flag.
        bool open;
        string name;
    }

    struct Account {
        /// @notice Prepaid token units held for this address, as of `lastSettled`.
        uint128 balance;
        /// @notice Timestamp through which `balance` has already been debited.
        uint64 lastSettled;
        /// @notice Current plan, or 0 for "not subscribed".
        uint32 planId;
        /// @dev Sub-unit remainder of accrual carried between settlements, in
        ///      units x seconds (always < SECONDS_PER_MONTH). Keeps repeated
        ///      settling from either rounding revenue away or over-charging.
        uint32 carry;
    }

    /// @dev Index 0 is a permanent placeholder meaning "no plan".
    Plan[] private _plans;

    mapping(address => Account) private _accounts;

    /// @notice Sum of all subscriber balances as last settled. Used to keep
    ///         operator withdrawals strictly separated from customer money.
    uint256 public totalCustomerBalance;

    /// @notice Revenue that has been settled out of subscriber balances and is
    ///         withdrawable by the operator.
    uint256 public collectedRevenue;

    event PlanAdded(uint32 indexed planId, string name, uint96 pricePerMonth);
    event PlanOpenSet(uint32 indexed planId, bool open);
    event Deposited(address indexed account, address indexed payer, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed account, address indexed to, uint256 amount, uint256 newBalance);
    event Subscribed(address indexed account, uint32 indexed planId, uint256 expiresAt);
    event Cancelled(address indexed account, uint32 indexed planId, uint256 refundableBalance);
    event Settled(address indexed account, uint32 indexed planId, uint256 charged, uint256 newBalance);
    event Lapsed(address indexed account, uint32 indexed planId);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event SurplusSwept(address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error UnknownPlan(uint32 planId);
    error PlanClosed(uint32 planId);
    error AlreadyOnPlan(uint32 planId);
    error NotSubscribed();
    error InsufficientBalance(uint256 requested, uint256 available);
    error InsufficientRunway(uint256 minimumSeconds);
    error PriceMustBeNonZero();
    error NothingToSweep();
    error AmountTooLarge();

    /// @param token_ Payment token (USDC on the target chain).
    /// @param owner_ Operator address — can add plans and withdraw *revenue only*.
    constructor(IERC20 token_, address owner_) Ownable(owner_) {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = token_;
        // Reserve id 0 as "not subscribed" so a fresh Account struct is inert.
        _plans.push(Plan({pricePerMonth: 0, open: false, name: "none"}));
    }

    // ---------------------------------------------------------------------
    // Reads — this is what the API backend calls
    // ---------------------------------------------------------------------

    /// @notice The single question the backend asks per request: is this address
    ///         currently paid up? True only while the prepaid balance still
    ///         covers the current second.
    function isSubscribed(address account) public view returns (bool) {
        return block.timestamp < expiresAt(account);
    }

    /// @notice Timestamp at which this account's prepaid balance runs out at its
    ///         current plan rate. 0 if not subscribed.
    /// @dev Cache this in your backend: it only moves earlier if the subscriber
    ///      withdraws or switches to a pricier plan, both of which emit events.
    function expiresAt(address account) public view returns (uint256) {
        Account memory a = _accounts[account];
        if (a.planId == 0) return 0;
        return uint256(a.lastSettled) + _runway(a, _plans[a.planId].pricePerMonth);
    }

    /// @dev Whole seconds of service the remaining balance still pays for,
    ///      measured from `lastSettled`.
    function _runway(Account memory a, uint256 price) private pure returns (uint256) {
        uint256 remaining = uint256(a.balance) * SECONDS_PER_MONTH;
        if (remaining <= a.carry) return 0;
        return (remaining - a.carry) / price;
    }

    /// @notice Everything the backend or a dashboard needs, in one call.
    /// @param account The address being asked about.
    /// @return active Whether the address may use the API right now.
    /// @return planId Current plan id (0 = not subscribed).
    /// @return pricePerMonth Price of that plan, token units per 30 days.
    /// @return balance Prepaid balance after deducting everything owed so far.
    /// @return expiry Timestamp the balance runs out at the current rate.
    function subscriptionOf(address account)
        external
        view
        returns (bool active, uint32 planId, uint256 pricePerMonth, uint256 balance, uint256 expiry)
    {
        Account memory a = _accounts[account];
        (uint256 charge,) = _pending(a);
        return (
            isSubscribed(account),
            a.planId,
            a.planId == 0 ? 0 : _plans[a.planId].pricePerMonth,
            uint256(a.balance) - charge,
            expiresAt(account)
        );
    }

    /// @notice Balance the account could withdraw right now, i.e. net of unbilled
    ///         time already consumed. This is the refund on cancellation.
    function availableBalance(address account) public view returns (uint256) {
        Account memory a = _accounts[account];
        (uint256 charge,) = _pending(a);
        return uint256(a.balance) - charge;
    }

    /// @notice Revenue accrued but not yet moved into `collectedRevenue` for this
    ///         account. Included in the operator's economics whether or not
    ///         `settle` has been called.
    function pendingRevenue(address account) external view returns (uint256 charge) {
        (charge,) = _pending(_accounts[account]);
    }

    /// @notice Batch version of `isSubscribed`, for reconciliation jobs.
    function areSubscribed(address[] calldata accounts) external view returns (bool[] memory out) {
        out = new bool[](accounts.length);
        for (uint256 i; i < accounts.length; ++i) {
            out[i] = isSubscribed(accounts[i]);
        }
    }

    function planCount() external view returns (uint256) {
        return _plans.length;
    }

    function getPlan(uint32 planId) external view returns (Plan memory) {
        if (planId == 0 || planId >= _plans.length) revert UnknownPlan(planId);
        return _plans[planId];
    }

    // ---------------------------------------------------------------------
    // Customer actions
    // ---------------------------------------------------------------------

    /// @notice Top up your own account.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's account — an employer paying for a team
    ///         member, or a faucet. Permissionless on purpose; it can only ever
    ///         increase the recipient's balance.
    function depositFor(address account, uint256 amount) external {
        if (account == address(0)) revert ZeroAddress();
        _deposit(account, amount);
    }

    /// @notice Top up in one transaction using an EIP-2612 permit (USDC supports
    ///         this), so the customer never sends a separate `approve`.
    /// @dev The permit is applied best-effort: if someone front-runs it, the
    ///      deposit still succeeds on the allowance it created.
    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        try IERC20Permit(address(token)).permit(msg.sender, address(this), amount, deadline, v, r, s) {}
            catch {}
        _deposit(msg.sender, amount);
    }

    /// @notice Subscribe to a plan, or switch plans. Time on the previous plan is
    ///         billed at the old rate first, so switching is never retroactive.
    /// @param planId The plan to move onto.
    function subscribe(uint32 planId) external {
        if (planId == 0 || planId >= _plans.length) revert UnknownPlan(planId);
        Plan memory plan = _plans[planId];
        if (!plan.open) revert PlanClosed(planId);

        Account storage a = _accounts[msg.sender];
        if (a.planId == planId) revert AlreadyOnPlan(planId);

        _settle(msg.sender);

        a.planId = planId;
        a.lastSettled = uint64(block.timestamp);

        // Refuse to start a subscription that is already expired on arrival —
        // it would look "subscribed" in a wallet and fail every API call.
        uint256 runway = _runway(a, plan.pricePerMonth);
        if (runway < MIN_RUNWAY_ON_SUBSCRIBE) revert InsufficientRunway(MIN_RUNWAY_ON_SUBSCRIBE);

        emit Subscribed(msg.sender, planId, block.timestamp + runway);
    }

    /// @notice Cancel. Bills the time used up to this second and leaves the rest
    ///         of the balance withdrawable. No notice period, no penalty.
    function cancel() public {
        Account storage a = _accounts[msg.sender];
        uint32 planId = a.planId;
        if (planId == 0) revert NotSubscribed();

        _settle(msg.sender);
        a.planId = 0;

        emit Cancelled(msg.sender, planId, a.balance);
    }

    /// @notice Withdraw unused prepaid balance. Allowed while still subscribed —
    ///         it simply shortens the runway.
    /// @param amount Token units to withdraw.
    /// @param to Recipient.
    function withdraw(uint256 amount, address to) public nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _settle(msg.sender);

        Account storage a = _accounts[msg.sender];
        if (amount > a.balance) revert InsufficientBalance(amount, a.balance);

        a.balance -= uint128(amount);
        totalCustomerBalance -= amount;

        emit Withdrawn(msg.sender, to, amount, a.balance);
        token.safeTransfer(to, amount);
    }

    /// @notice Cancel and take everything unused back, in one transaction.
    function cancelAndWithdraw(address to) external returns (uint256 refund) {
        cancel();
        refund = _accounts[msg.sender].balance;
        if (refund > 0) withdraw(refund, to);
    }

    // ---------------------------------------------------------------------
    // Settlement — bookkeeping only, callable by anyone
    // ---------------------------------------------------------------------

    /// @notice Move the revenue an account owes so far out of its balance and
    ///         into `collectedRevenue`.
    /// @dev Deliberately permissionless and deliberately optional. The operator
    ///      calls it (or a batch of it) before withdrawing; the accrual it
    ///      records already existed, so a caller cannot change anyone's balance
    ///      in their own favour, and skipping it costs the operator nothing but
    ///      the ability to withdraw that slice today.
    function settle(address account) external {
        _settle(account);
    }

    /// @notice Batch `settle`. What the operator runs before a payout.
    function settleMany(address[] calldata accounts) external {
        for (uint256 i; i < accounts.length; ++i) {
            _settle(accounts[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Operator
    // ---------------------------------------------------------------------

    /// @notice Create a plan. Prices are immutable once created: an existing
    ///         subscriber can never be repriced underneath them. To change a
    ///         price, add a new plan and close the old one; subscribers move
    ///         across by choosing to.
    function addPlan(string calldata name, uint96 pricePerMonth) external onlyOwner returns (uint32 planId) {
        if (pricePerMonth == 0) revert PriceMustBeNonZero();
        _plans.push(Plan({pricePerMonth: pricePerMonth, open: true, name: name}));
        planId = uint32(_plans.length - 1);
        emit PlanAdded(planId, name, pricePerMonth);
    }

    /// @notice Open or close a plan to *new* subscribers. Existing subscribers on
    ///         a closed plan keep running at their agreed price until they
    ///         cancel, switch, or run out of balance.
    function setPlanOpen(uint32 planId, bool open) external onlyOwner {
        if (planId == 0 || planId >= _plans.length) revert UnknownPlan(planId);
        _plans[planId].open = open;
        emit PlanOpenSet(planId, open);
    }

    /// @notice Withdraw settled revenue. Cannot reach customer balances — the
    ///         ceiling is `collectedRevenue`, which only ever grows from time
    ///         subscribers have actually consumed.
    function withdrawRevenue(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > collectedRevenue) revert InsufficientBalance(amount, collectedRevenue);
        collectedRevenue -= amount;
        emit RevenueWithdrawn(to, amount);
        token.safeTransfer(to, amount);
    }

    /// @notice Recover tokens sent here by mistake: anything held beyond customer
    ///         balances plus settled revenue. Cannot touch either of those.
    function sweepSurplus(address to) external onlyOwner nonReentrant returns (uint256 surplus) {
        if (to == address(0)) revert ZeroAddress();
        uint256 owed = totalCustomerBalance + collectedRevenue;
        uint256 held = token.balanceOf(address(this));
        if (held <= owed) revert NothingToSweep();
        surplus = held - owed;
        emit SurplusSwept(to, surplus);
        token.safeTransfer(to, surplus);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _deposit(address account, uint256 amount) private nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint128).max) revert AmountTooLarge();

        // Settle first so the incoming funds are never retroactively eaten by
        // time the old balance already failed to cover.
        _settle(account);

        _accounts[account].balance += uint128(amount);
        totalCustomerBalance += amount;

        emit Deposited(account, msg.sender, amount, _accounts[account].balance);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @dev Whole token units owed since `lastSettled`, plus the sub-unit
    ///      remainder to carry forward. Never charges for time the balance could
    ///      not cover: once the prepaid runway is gone the service is off, so the
    ///      lapsed tail is free.
    function _pending(Account memory a) private view returns (uint256 charge, uint32 newCarry) {
        if (a.planId == 0 || block.timestamp <= a.lastSettled) {
            return (0, a.carry);
        }
        uint256 elapsed = block.timestamp - a.lastSettled;
        uint256 scaled = uint256(a.carry) + elapsed * _plans[a.planId].pricePerMonth;

        charge = scaled / SECONDS_PER_MONTH;
        if (charge >= a.balance) return (a.balance, 0);

        newCarry = uint32(scaled % SECONDS_PER_MONTH);
    }

    function _settle(address account) private {
        Account storage a = _accounts[account];
        uint32 planId = a.planId;
        (uint256 charge, uint32 newCarry) = _pending(a);

        bool lapsed = planId != 0 && charge > 0 && charge == a.balance;

        a.lastSettled = uint64(block.timestamp);
        a.carry = newCarry;
        if (charge > 0) {
            a.balance -= uint128(charge);
            totalCustomerBalance -= charge;
            collectedRevenue += charge;
            emit Settled(account, planId, charge, a.balance);
        }
        if (lapsed) emit Lapsed(account, planId);
    }
}
