// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title WeatherBilling
/// @notice Onchain subscription billing for the weather API.
///
/// Design in one paragraph: a customer deposits USDC (a top-up), then pays for
/// 30-day periods up front. The subscription simply runs until `paidUntil`.
/// Extending it is a permissionless `renewFor(user)` call that anyone may send
/// once the paid time has elapsed; the API backend is the natural caller and
/// does it as part of request handling, but a customer can do it too, and if
/// nobody does, the subscription (and service) lapses — which is exactly what
/// "not paid" should mean. There is no cron job, no keeper service and no
/// owner key required for billing to keep working: the contract is a state
/// machine that only moves when someone calls it, and every call that matters
/// is either the customer's or the backend collecting its own revenue.
///
/// Money lives in three pots, and one dollar never becomes the other's:
///   credits — the customer's unspent deposit, refundable at any time;
///   held   — escrow for the period currently paid for, returned pro-rata
///            if the customer cancels early;
///   revenue — fully earned money, the only thing the owner can collect.
///
/// Owner powers are deliberately tiny: set plan prices (future periods only)
/// and collect earned revenue. The owner cannot pause the contract, cannot
/// touch customer credits or escrow, cannot upgrade the logic, and cannot
/// block anyone from subscribing, cancelling or withdrawing.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract WeatherBilling {
    // ---------------------------------------------------------------- errors

    error NotOwner();
    error BadPlan();
    error SamePlan();
    error NotActive();
    error AlreadyActive();
    error InsufficientCredit();
    error NotDueYet();
    error NothingToSettle();
    error NothingToWithdraw();
    error ZeroAmount();
    error Reentrant();
    error TokenCallFailed();

    // ---------------------------------------------------------------- events

    event ToppedUp(address indexed user, uint256 amount);
    event Subscribed(address indexed user, uint8 planId, uint256 price, uint64 paidUntil);
    event Renewed(address indexed user, uint8 planId, uint256 price, uint64 newPaidUntil);
    event Cancelled(address indexed user, uint8 planId, uint256 refund);
    event PlanChanged(address indexed user, uint8 fromPlan, uint8 toPlan, uint64 newPaidUntil);
    event Settled(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RevenueCollected(address indexed to, uint256 amount);
    event PriceUpdated(uint8 indexed planId, uint256 oldPrice, uint256 newPrice);

    // ---------------------------------------------------------------- state

    /// @dev 30 days, not a calendar month, so periods are uniform and the
    ///      pro-rata refund math is exact.
    uint256 public constant PERIOD = 30 days;

    enum Status {
        None, // never subscribed
        Active, // paid through `paidUntil` (may still be lapsed if past it)
        Cancelled // stopped early; refund already credited
    }

    struct Plan {
        uint256 price; // in USDC base units (e.g. 5e6 for $5 on 6-decimal USDC)
        bool exists;
    }

    struct Subscription {
        Status status;
        uint8 planId;
        uint64 paidUntil; // service is owed until this timestamp
    }

    IERC20 public immutable usdc;
    address public owner;

    /// @dev USDC the customer deposited but has not yet been charged.
    mapping(address => uint256) public credits;

    /// @dev Escrow for the customer's current paid period. Pro-rata
    ///      refundable on cancel; becomes revenue as the period is used.
    mapping(address => uint256) public held;

    /// @dev Fully earned USDC. Belongs to the owner. Only ever receives
    ///      settled money, so collecting it can never block a refund.
    uint256 public revenue;

    mapping(address => Subscription) private _subs;
    Plan[] private _plans;

    uint256 private _locked = 1; // reentrancy guard

    // ------------------------------------------------------------ constructor

    /// @param usdc_  the USDC (or any ERC20) contract address
    /// @param owner_ who may set prices and collect revenue
    /// @param prices plan prices in token base units; index is the planId.
    ///               Deploy with [5e6, 20e6] for $5 hobby / $20 pro on
    ///               6-decimal USDC.
    constructor(address usdc_, address owner_, uint256[] memory prices) {
        usdc = IERC20(usdc_);
        owner = owner_;
        for (uint256 i = 0; i < prices.length; ++i) {
            if (prices[i] == 0) revert ZeroAmount();
            _plans.push(Plan(prices[i], true));
        }
    }

    // --------------------------------------------------------- customer side

    /// @notice Deposit USDC to prepay for periods. Approve first.
    function topUp(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        credits[msg.sender] += amount;
        _safeTransferFrom(msg.sender, address(this), amount);
        emit ToppedUp(msg.sender, amount);
    }

    /// @notice Start (or restart) a subscription. Charges the first period
    ///         immediately from deposited credit; the charge sits in escrow
    ///         (`held`) and is only earned as the period is used.
    function subscribe(uint8 planId) external {
        Subscription storage s = _subs[msg.sender];
        if (s.status == Status.Active) revert AlreadyActive();
        Plan storage p = _plan(planId);
        uint256 price = p.price;
        if (credits[msg.sender] < price) revert InsufficientCredit();

        credits[msg.sender] -= price;
        held[msg.sender] += price;
        s.status = Status.Active;
        s.planId = planId;
        s.paidUntil = uint64(block.timestamp + PERIOD);

        emit Subscribed(msg.sender, planId, price, s.paidUntil);
    }

    /// @notice Extend `user`'s subscription by one period, paid from their
    ///         deposited credit. Permissionless: the backend sends this on
    ///         the request path when it observes a lapse, the customer can
    ///         send it themselves, and so can anyone — no reward needed,
    ///         the backend is collecting its own revenue. If nobody calls,
    ///         the subscription has run out, like an unpaid invoice.
    ///         One period per call, so a stranger can only ever buy the user
    ///         one more month of service with the user's own pre-deposited,
    ///         refundable funds.
    function renewFor(address user) external {
        Subscription storage s = _subs[user];
        if (s.status != Status.Active) revert NotActive();
        if (block.timestamp < s.paidUntil) revert NotDueYet();

        // The previous period has fully elapsed: it is earned revenue now.
        // Reverts here (e.g. insufficient credit for the new period) roll
        // this settlement back too, so partial states cannot persist.
        uint256 earned = held[user];
        held[user] = 0;
        revenue += earned;

        Plan storage p = _plan(s.planId);
        uint256 price = p.price;
        if (credits[user] < price) revert InsufficientCredit();

        credits[user] -= price;
        held[user] = price;
        // A lapse served no one, so a renewal always buys 30 fresh days.
        s.paidUntil = uint64(block.timestamp + PERIOD);

        if (earned > 0) emit Settled(user, earned);
        emit Renewed(user, s.planId, price, s.paidUntil);
    }

    /// @notice Mark a lapsed subscription's period as earned so the owner
    ///         can collect. Permissionless, for the same reason as renewFor:
    ///         it is the owner's money and the backend/owner is the one who
    ///         cares. Does nothing harmful to the customer — their credit
    ///         and refund rights are unaffected.
    function settle(address user) external {
        Subscription storage s = _subs[user];
        if (s.status != Status.Active) revert NotActive();
        if (block.timestamp < s.paidUntil) revert NotDueYet();
        uint256 amount = held[user];
        if (amount == 0) revert NothingToSettle();
        held[user] = 0;
        revenue += amount;
        emit Settled(user, amount);
    }

    /// @notice Stop the subscription now. The unused pro-rata share of the
    ///         current period — of what was actually paid for it — is
    ///         credited back, on top of any unspent deposit. Withdraw
    ///         everything with `withdraw()`.
    function cancel() external {
        Subscription storage s = _subs[msg.sender];
        if (s.status != Status.Active) revert NotActive();

        uint256 escrow = held[msg.sender];
        held[msg.sender] = 0;
        uint256 refund;
        if (s.paidUntil > block.timestamp) {
            refund = (escrow * (s.paidUntil - block.timestamp)) / PERIOD;
        }
        // The used share is earned the moment they stop. Rounding dust goes
        // to revenue so the contract can never become insolvent.
        revenue += escrow - refund;

        s.status = Status.Cancelled;
        if (refund > 0) credits[msg.sender] += refund;

        emit Cancelled(msg.sender, s.planId, refund);
    }

    /// @notice Switch plans mid-period: the unused share of the current
    ///         period is credited back and the new plan is charged for a
    ///         fresh 30 days from now.
    function changePlan(uint8 newPlanId) external {
        Subscription storage s = _subs[msg.sender];
        if (s.status != Status.Active) revert NotActive();
        if (newPlanId == s.planId) revert SamePlan();
        Plan storage newPlan = _plan(newPlanId);
        uint256 newPrice = newPlan.price;

        // Settle the old period: unused share back to the customer,
        // used share earned. Refund is bounded by escrow, so an owner
        // raising prices mid-period cannot inflate it, and no prior
        // revenue collection can underflow it.
        uint256 escrow = held[msg.sender];
        held[msg.sender] = 0;
        uint256 refund;
        if (s.paidUntil > block.timestamp) {
            refund = (escrow * (s.paidUntil - block.timestamp)) / PERIOD;
        }
        revenue += escrow - refund;
        if (credits[msg.sender] + refund < newPrice) revert InsufficientCredit();

        credits[msg.sender] += refund;
        credits[msg.sender] -= newPrice;
        held[msg.sender] = newPrice;

        uint8 oldPlanId = s.planId;
        s.planId = newPlanId;
        s.paidUntil = uint64(block.timestamp + PERIOD);

        emit PlanChanged(msg.sender, oldPlanId, newPlanId, s.paidUntil);
    }

    /// @notice Withdraw the entire refundable credit balance as USDC.
    function withdraw() external nonReentrant {
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        credits[msg.sender] = 0;
        _safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ------------------------------------------------------------- owner side

    /// @notice Change a plan's price. Applies to future charges only —
    ///         periods already paid for are honoured at the old price.
    ///         Subscribers who dislike the new price can cancel and
    ///         withdraw everything they have not used.
    function setPrice(uint8 planId, uint256 newPrice) external onlyOwner {
        Plan storage p = _plan(planId);
        if (newPrice == 0) revert ZeroAmount();
        uint256 old = p.price;
        p.price = newPrice;
        emit PriceUpdated(planId, old, newPrice);
    }

    /// @notice Collect USDC earned from fully-elapsed or cancelled periods.
    ///         Customer credits and escrow are not reachable by this
    ///         function — only settled `revenue` is.
    function collectRevenue(address to) external onlyOwner nonReentrant {
        uint256 amount = revenue;
        if (amount == 0) revert NothingToWithdraw();
        revenue = 0;
        _safeTransfer(to, amount);
        emit RevenueCollected(to, amount);
    }

    // ----------------------------------------------------------------- views

    /// @notice The per-request check for the API backend. Returns
    ///         (true, planId) iff the address has paid for service right
    ///         now. One `eth_call`, costs nothing, trusts nothing offchain.
    function isSubscribed(address user) external view returns (bool subscribed, uint8 planId) {
        Subscription storage s = _subs[user];
        if (s.status == Status.Active && block.timestamp < s.paidUntil) {
            return (true, s.planId);
        }
        return (false, 0);
    }

    /// @notice Full record for dashboards and debugging.
    function subscriptionOf(address user)
        external
        view
        returns (Status status, uint8 planId, uint64 paidUntil, uint256 credit)
    {
        Subscription storage s = _subs[user];
        return (s.status, s.planId, s.paidUntil, credits[user]);
    }

    /// @notice True when the backend should send a `renewFor(user)` tx:
    ///         subscription active, time up, and credit covers the price.
    ///         The request path can decide with one cheap read, then batch
    ///         the renewal transactions.
    function needsRenewal(address user) external view returns (bool) {
        Subscription storage s = _subs[user];
        return s.status == Status.Active && block.timestamp >= s.paidUntil
            && credits[user] >= _plan(s.planId).price;
    }

    function planPrice(uint8 planId) external view returns (uint256) {
        return _plan(planId).price;
    }

    function planCount() external view returns (uint256) {
        return _plans.length;
    }

    // -------------------------------------------------------------- internals

    function _plan(uint8 planId) internal view returns (Plan storage) {
        if (planId >= _plans.length) revert BadPlan();
        Plan storage p = _plans[planId];
        if (!p.exists) revert BadPlan();
        return p;
    }

    /// @dev Low-level token call that treats both an explicit `false` and
    ///      missing return data as failure but tolerates tokens that
    ///      return nothing at all (USDT style), so the contract is not
    ///      wedged to one particular USDC deployment.
    function _callToken(bytes memory data) internal returns (bytes memory out) {
        bool ok;
        (ok, out) = address(usdc).call(data);
        if (!ok) revert TokenCallFailed();
        if (out.length != 0 && !abi.decode(out, (bool))) revert TokenCallFailed();
    }

    function _safeTransfer(address to, uint256 amount) internal {
        _callToken(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        _callToken(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrant();
        _locked = 2;
        _;
        _locked = 1;
    }
}