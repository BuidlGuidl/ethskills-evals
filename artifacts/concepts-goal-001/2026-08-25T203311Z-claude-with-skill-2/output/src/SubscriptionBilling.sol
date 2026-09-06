// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, self-metering subscriptions denominated in an ERC-20 stablecoin (USDC).
///
/// @dev Design note, because it is the whole point of this contract:
///
/// Nothing onchain runs on a schedule. There is no cron, no keeper, no "charge everyone on the
/// 1st". A subscriber's cost accrues continuously from a timestamp at their plan's per-second
/// rate, and is *computed at read time*. `settle` only writes that already-true number down; it
/// moves money from the subscriber's prepaid balance into the operator's claimable pot. If it is
/// never called, nobody is over- or under-charged, no subscription wrongly stays alive, and the
/// operator loses nothing: the funds cannot leave via any path that does not settle first.
///
/// That means the only party who ever *needs* to send a maintenance transaction is the operator,
/// and only when they want to actually move their own revenue out. There is no state transition
/// here that a stranger has to be paid to advance, and none that stops working if the operator
/// walks away — subscribers can always cancel and withdraw their unused balance themselves.
contract SubscriptionBilling is Ownable2Step {
    using SafeERC20 for IERC20;

    /// @notice One billing "month", fixed at exactly 30 days.
    /// @dev A calendar year holds 12.17 of these, so a $5/month plan bills $60.83 over a year.
    uint256 public constant PERIOD = 30 days;

    struct Plan {
        /// @dev Price for one PERIOD, in token base units (USDC: 6 decimals, so 5e6 == $5).
        uint128 pricePerPeriod;
        /// @dev Whether new subscribers may join or switch onto this plan. Never affects
        ///      anyone already on it — see `setPlanOpen`.
        bool open;
    }

    struct Subscription {
        /// @dev 0 means "not subscribed". Plan ids start at 1.
        uint32 planId;
        /// @dev Timestamp up to which `balance` has already been debited.
        uint64 lastSettled;
        /// @dev Prepaid funds not yet earned by the operator, in token base units.
        uint128 balance;
    }

    /// @notice The billing token. Immutable: this contract can never be pointed at another asset.
    // lowercase so the public getter reads `token()` in the ABI consumers use
    // forge-lint: disable-next-line(screaming-snake-case-immutable)
    IERC20 public immutable token;

    mapping(uint256 planId => Plan) public plans;
    mapping(address subscriber => Subscription) public subscriptions;

    uint256 public nextPlanId = 1;

    /// @notice Sum of every subscriber's unspent prepaid balance. Never withdrawable by the owner.
    uint256 public totalUserBalance;

    /// @notice Revenue already earned and settled, awaiting withdrawal by the owner.
    uint256 public operatorAccrued;

    event PlanCreated(uint256 indexed planId, uint256 pricePerPeriod);
    event PlanOpenSet(uint256 indexed planId, bool open);
    event Subscribed(address indexed subscriber, uint256 indexed planId, uint256 deposited, uint256 balance);
    event ToppedUp(address indexed subscriber, uint256 amount, uint256 balance);
    event Settled(address indexed subscriber, uint256 charged, uint256 balance);
    event Cancelled(address indexed subscriber, uint256 indexed planId, uint256 refunded);
    event EarningsWithdrawn(address indexed to, uint256 amount);

    error PlanDoesNotExist();
    error PlanClosed();
    error NotSubscribed();
    error AlreadyOnPlan();
    error ZeroPrice();
    error ZeroAmount();
    error UnderfundedForPlan(uint256 required, uint256 provided);
    error InsufficientEarnings();
    error AmountTooLarge();

    /// @param billingToken The stablecoin subscribers pay in (USDC on the target chain).
    /// @param initialOwner Receives plan administration and revenue withdrawal rights.
    constructor(IERC20 billingToken, address initialOwner) Ownable(initialOwner) {
        if (address(billingToken) == address(0)) revert ZeroAmount();
        token = billingToken;
    }

    // ---------------------------------------------------------------------
    // Reads — this is what the API backend calls
    // ---------------------------------------------------------------------

    /// @notice True if `subscriber` has an active plan with prepaid funds left right now.
    /// @dev The single question the backend needs answered per request. Pure view: free over
    ///      `eth_call`, no transaction, no gas, works against any RPC provider or your own node.
    function isSubscribed(address subscriber) public view returns (bool) {
        Subscription memory s = subscriptions[subscriber];
        if (s.planId == 0) return false;
        return _accrued(s) < s.balance;
    }

    /// @notice Timestamp through which `subscriber` is guaranteed to stay subscribed if they do
    ///         nothing, or 0 if they are not subscribed.
    /// @dev Safe to cache against: integer division floors, so the returned instant is never later
    ///      than the true lapse moment (it can be up to one second early). It only ever moves
    ///      *earlier* through `subscribe` (switching to a pricier plan) or `cancel`, both of which
    ///      emit events — so pair a `paidThrough` cache with event-driven invalidation, or a short
    ///      TTL, if you want upgrades and cancellations to take effect promptly.
    function paidThrough(address subscriber) public view returns (uint256) {
        Subscription memory s = subscriptions[subscriber];
        if (s.planId == 0) return 0;
        uint256 price = plans[s.planId].pricePerPeriod;
        return uint256(s.lastSettled) + (uint256(s.balance) * PERIOD) / price;
    }

    /// @notice Everything the backend or a dashboard needs about one account in a single call.
    /// @return planId 0 if not subscribed.
    /// @return pricePerPeriod Price of that plan for one 30-day period.
    /// @return balance Prepaid funds recorded onchain, before deducting unsettled usage.
    /// @return unusedBalance What a `cancel` right now would refund.
    /// @return activeUntil Same as `paidThrough`.
    /// @return active Same as `isSubscribed`.
    function accountOf(address subscriber)
        external
        view
        returns (
            uint256 planId,
            uint256 pricePerPeriod,
            uint256 balance,
            uint256 unusedBalance,
            uint256 activeUntil,
            bool active
        )
    {
        Subscription memory s = subscriptions[subscriber];
        planId = s.planId;
        balance = s.balance;
        if (planId == 0) return (0, 0, balance, balance, 0, false);
        pricePerPeriod = plans[s.planId].pricePerPeriod;
        unusedBalance = balance - _accrued(s);
        activeUntil = paidThrough(subscriber);
        active = _accrued(s) < s.balance;
    }

    /// @notice Usage accrued but not yet settled for `subscriber` — owed to the operator.
    function pendingCharge(address subscriber) external view returns (uint256) {
        return _accrued(subscriptions[subscriber]);
    }

    /// @notice What `cancel` would refund `subscriber` right now.
    function previewRefund(address subscriber) external view returns (uint256) {
        Subscription memory s = subscriptions[subscriber];
        return s.balance - _accrued(s);
    }

    /// @notice Minimum deposit required to subscribe to `planId` — one full period up front.
    function minimumDeposit(uint256 planId) public view returns (uint256) {
        return plans[planId].pricePerPeriod;
    }

    // ---------------------------------------------------------------------
    // Subscriber actions — the subscriber sends every one of these themselves
    // ---------------------------------------------------------------------

    /// @notice Subscribe to `planId`, or switch an existing subscription onto it, depositing
    ///         `amount` of the billing token at the same time.
    /// @dev Requires an ERC-20 approval for `amount` first. Switching settles usage at the *old*
    ///      plan's rate before the new rate starts, so nobody is retroactively repriced. The
    ///      resulting balance must cover at least one period of the new plan.
    /// @param planId Plan to join. Must be open to new subscribers.
    /// @param amount Tokens to deposit now. May be 0 when switching with enough balance already.
    function subscribe(uint256 planId, uint256 amount) external {
        Plan memory plan = plans[planId];
        if (plan.pricePerPeriod == 0) revert PlanDoesNotExist();
        if (!plan.open) revert PlanClosed();

        Subscription storage s = subscriptions[msg.sender];
        if (s.planId == planId && amount == 0) revert AlreadyOnPlan();

        _settle(msg.sender);

        uint256 received = amount == 0 ? 0 : _pull(msg.sender, amount);
        uint256 newBalance = uint256(s.balance) + received;
        if (newBalance < plan.pricePerPeriod) {
            revert UnderfundedForPlan(plan.pricePerPeriod, newBalance);
        }

        // planId is bounded by nextPlanId, which increments by one per createPlan call
        // forge-lint: disable-next-line(unsafe-typecast)
        s.planId = uint32(planId);
        s.balance = _toUint128(newBalance);
        totalUserBalance += received;

        emit Subscribed(msg.sender, planId, received, newBalance);
    }

    /// @notice Add funds to an existing subscription, extending how long it stays active.
    /// @dev Also the renewal path for a subscription that ran out of funds: usage is settled
    ///      first, capped at whatever balance was left, so no debt accrues across the gap and the
    ///      new money buys time starting now.
    function topUp(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Subscription storage s = subscriptions[msg.sender];
        if (s.planId == 0) revert NotSubscribed();

        _settle(msg.sender);

        uint256 received = _pull(msg.sender, amount);
        uint256 newBalance = uint256(s.balance) + received;
        s.balance = _toUint128(newBalance);
        totalUserBalance += received;

        emit ToppedUp(msg.sender, received, newBalance);
    }

    /// @notice Cancel and withdraw every token not yet used, to the second.
    /// @dev Needs no cooperation from the operator and cannot be blocked by them: there is no
    ///      pause, no owner switch and no timelock on this path.
    function cancel() external {
        Subscription storage s = subscriptions[msg.sender];
        uint256 planId = s.planId;
        if (planId == 0) revert NotSubscribed();

        _settle(msg.sender);

        uint256 refund = s.balance;
        s.planId = 0;
        s.balance = 0;
        totalUserBalance -= refund;

        emit Cancelled(msg.sender, planId, refund);

        if (refund > 0) token.safeTransfer(msg.sender, refund);
    }

    // ---------------------------------------------------------------------
    // Settlement — permissionless, and never required for correctness
    // ---------------------------------------------------------------------

    /// @notice Book `subscriber`'s accrued usage as operator revenue.
    /// @dev Open to anyone, but in practice only the operator has a reason to call it: it is
    ///      the step that makes their own revenue withdrawable. Skipping it forever changes no
    ///      balance, no expiry and no access decision — the numbers are already true, this only
    ///      writes them down. Roughly 30k gas for a subscriber holding up to a month of revenue.
    function settle(address subscriber) external {
        _settle(subscriber);
    }

    /// @notice `settle` for many subscribers in one transaction.
    function settleMany(address[] calldata subscribers) external {
        for (uint256 i = 0; i < subscribers.length; ++i) {
            _settle(subscribers[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Operator actions
    // ---------------------------------------------------------------------

    /// @notice Create a new plan, open to new subscribers.
    /// @dev Prices are immutable once created — deliberately. Nobody who already pays you can
    ///      have their rate changed out from under them. To reprice, create a new plan, close the
    ///      old one, and ask existing subscribers to switch.
    /// @param pricePerPeriod Price for one 30-day period, in token base units.
    /// @return planId The id of the new plan.
    function createPlan(uint256 pricePerPeriod) external onlyOwner returns (uint256 planId) {
        if (pricePerPeriod == 0) revert ZeroPrice();
        planId = nextPlanId++;
        plans[planId] = Plan({pricePerPeriod: _toUint128(pricePerPeriod), open: true});
        emit PlanCreated(planId, pricePerPeriod);
    }

    /// @notice Open or close a plan to *new* subscribers and plan switches.
    /// @dev Closing does not touch anyone already on the plan: they keep their price, keep their
    ///      balance, can keep topping up, and can still cancel for a refund.
    function setPlanOpen(uint256 planId, bool open) external onlyOwner {
        if (plans[planId].pricePerPeriod == 0) revert PlanDoesNotExist();
        plans[planId].open = open;
        emit PlanOpenSet(planId, open);
    }

    /// @notice Withdraw settled revenue.
    /// @dev Bounded by `operatorAccrued`, which only ever grows through `_settle`. There is no
    ///      code path by which the owner reaches an unspent subscriber balance.
    function withdrawEarnings(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAmount();
        if (amount > operatorAccrued) revert InsufficientEarnings();
        operatorAccrued -= amount;
        emit EarningsWithdrawn(to, amount);
        token.safeTransfer(to, amount);
    }

    /// @notice Settle a batch of subscribers and sweep the resulting revenue in one transaction.
    /// @return withdrawn Total tokens sent to `to`.
    function collect(address[] calldata subscribers, address to) external onlyOwner returns (uint256 withdrawn) {
        if (to == address(0)) revert ZeroAmount();
        for (uint256 i = 0; i < subscribers.length; ++i) {
            _settle(subscribers[i]);
        }
        withdrawn = operatorAccrued;
        if (withdrawn > 0) {
            operatorAccrued = 0;
            emit EarningsWithdrawn(to, withdrawn);
            token.safeTransfer(to, withdrawn);
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @dev Usage owed since `lastSettled`, capped at the prepaid balance. The cap is what makes
    ///      a lapsed subscription cost nothing to leave sitting: it can never go into debt, so a
    ///      subscriber who disappears for a year and comes back is charged only from their return.
    function _accrued(Subscription memory s) internal view returns (uint256) {
        if (s.planId == 0 || s.balance == 0) return 0;
        uint256 elapsed = block.timestamp - s.lastSettled;
        uint256 owed = (uint256(plans[s.planId].pricePerPeriod) * elapsed) / PERIOD;
        return owed > s.balance ? s.balance : owed;
    }

    function _settle(address subscriber) internal {
        Subscription storage s = subscriptions[subscriber];
        uint256 charged = _accrued(s);
        if (charged > 0) {
            // _accrued caps `charged` at s.balance, which is already a uint128
            // forge-lint: disable-next-line(unsafe-typecast)
            s.balance -= uint128(charged);
            totalUserBalance -= charged;
            operatorAccrued += charged;
        }
        s.lastSettled = uint64(block.timestamp);
        emit Settled(subscriber, charged, s.balance);
    }

    /// @dev Transfers in and returns the amount actually received, so a billing token that ever
    ///      starts taking a transfer fee cannot leave the contract crediting more than it holds.
    function _pull(address from, uint256 amount) internal returns (uint256 received) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
    }

    function _toUint128(uint256 value) internal pure returns (uint128) {
        if (value > type(uint128).max) revert AmountTooLarge();
        // range-checked on the line above
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint128(value);
    }
}
