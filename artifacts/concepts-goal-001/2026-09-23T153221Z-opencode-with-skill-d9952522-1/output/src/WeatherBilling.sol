// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title WeatherBilling
/// @notice Prepaid USDC billing for the weather API.
///
///  Lifecycle:
///   1. Customer approves USDC and calls topUp(); USDC sits as per-user credit.
///   2. Customer calls subscribe(Hobby | Pro); whole 30-day months are bought
///      from credit up to MAX_AHEAD months ahead, extending paidUntil.
///   3. While plan is set and paidUntil > now, isSubscribed(user) is true.
///      Nobody needs to run a monthly cron: any later touch (topUp, settle,
///      subscribe change) buys the next months from remaining credit. A lapsed
///      subscription restarts from "now" when settled - elapsed idle time is
///      never back-billed.
///   4. cancel() refunds the unused fraction of the current prepaid month plus
///      all remaining credit, in USDC, and closes the account.
///
///  Operator revenue accrues per second as prepaid time is consumed and is
///  recognised lazily whenever the user is touched; collect() is permissionless
///  and pays out only recognised revenue, to a fixed treasury. There is no
///  owner, no pause, no upgrade path: prices, USDC and treasury are immutable.
contract WeatherBilling {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    /// @notice One billing period. Fixed 30 days, not a calendar month.
    uint256 public constant MONTH = 30 days;

    /// @notice Most months a customer may prepay from credit. Bounds loop gas
    ///         and staleness; unused prepaid time is fully refundable anyway.
    uint256 public constant MAX_AHEAD = 12;

    IERC20 public immutable usdc;
    address public immutable treasury;
    uint256 public immutable hobbyPrice;
    uint256 public immutable proPrice;

    /// @notice USDC held on behalf of a user, spendable on months, refundable on cancel.
    mapping(address => uint256) public credit;

    /// @notice Chosen plan. Plan.None means no subscription relationship.
    mapping(address => Plan) public plan;

    /// @notice Timestamp through which the customer has paid. While this is in
    ///         the future the customer is subscribed.
    mapping(address => uint256) public paidUntil;

    /// @notice Up to when this user's prepaid consumption has been recognised
    ///         as operator revenue. Equals min(now, paidUntil) at last touch.
    mapping(address => uint256) public lastAccrued;

    /// @notice Operator revenue that has been earned but not yet collected.
    uint256 public earnedPot;

    /// @notice Total revenue ever paid out to the treasury.
    uint256 public collectedTotal;

    event ToppedUp(address indexed user, uint256 amount, uint256 newCredit);
    event Subscribed(address indexed user, Plan plan, uint256 paidUntil);
    event Extended(address indexed user, Plan plan, uint256 monthsBought, uint256 newPaidUntil, uint256 newCredit);
    event PlanChanged(address indexed user, Plan from, Plan to, uint256 creditedRefund);
    event Canceled(address indexed user, uint256 refund);
    event RevenueCollected(uint256 amount);

    error InvalidPlan();
    error AlreadyOnPlan();
    error NothingToCancel();
    error ZeroAmount();
    error TransferFailed();

    constructor(IERC20 usdc_, address treasury_, uint256 hobbyPrice_, uint256 proPrice_) {
        usdc = usdc_;
        treasury = treasury_;
        hobbyPrice = hobbyPrice_;
        proPrice = proPrice_;
    }

    // ------------------------------------------------------------------
    // Customer actions
    // ------------------------------------------------------------------

    /// @notice Deposit USDC as spendable credit. If the caller already has a
    ///         plan, any months due are bought immediately (lazy renewal).
    function topUp(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        credit[msg.sender] += amount;
        _account(msg.sender);
        _renew(msg.sender);
        emit ToppedUp(msg.sender, amount, credit[msg.sender]);
    }

    /// @notice Choose a plan. Charges the first month(s) from credit.
    ///         Switching plans while active credits back the unused part of
    ///         the current prepaid month and starts the new plan now.
    function subscribe(Plan requested) external {
        if (requested == Plan.None) revert InvalidPlan();
        _account(msg.sender);

        Plan current = plan[msg.sender];
        if (paidUntil[msg.sender] > block.timestamp) {
            if (current == requested) revert AlreadyOnPlan();
            uint256 creditedRefund = _remainingRefund(msg.sender);
            credit[msg.sender] += creditedRefund;
            emit PlanChanged(msg.sender, current, requested, creditedRefund);
        }

        plan[msg.sender] = requested;
        paidUntil[msg.sender] = 0;
        _renew(msg.sender);
        emit Subscribed(msg.sender, requested, paidUntil[msg.sender]);
    }

    /// @notice Permissionless: recognise elapsed prepaid time as revenue and
    ///         buy any due months from the user's credit. Anyone may call it
    ///         for anyone; it can only ever extend the user's own subscription
    ///         with the user's own credit, so there is nothing to grief.
    function settle(address user) external {
        _account(user);
        _renew(user);
    }

    /// @notice Close the account and pay out everything the caller has not
    ///         used: the prorated unused part of the current prepaid month
    ///         plus all remaining credit.
    function cancel() external {
        _account(msg.sender);
        uint256 payout = credit[msg.sender];
        if (plan[msg.sender] != Plan.None && paidUntil[msg.sender] > block.timestamp) {
            payout += _remainingRefund(msg.sender);
        }
        if (payout == 0 && plan[msg.sender] == Plan.None) revert NothingToCancel();

        credit[msg.sender] = 0;
        plan[msg.sender] = Plan.None;
        paidUntil[msg.sender] = 0;
        lastAccrued[msg.sender] = 0;

        if (payout > 0 && !usdc.transfer(msg.sender, payout)) revert TransferFailed();
        emit Canceled(msg.sender, payout);
    }

    // ------------------------------------------------------------------
    // Operator revenue
    // ------------------------------------------------------------------

    /// @notice Pay out earned, uncollected revenue to the treasury.
    ///         Permissionless: revenue always flows to the fixed treasury, so
    ///         anyone can sweep it - typically the operator, who wants paid.
    ///         It can never touch user credit or prepaid-but-unconsumed time.
    function collect() external {
        uint256 amount = earnedPot;
        earnedPot = 0;
        if (amount > 0 && !usdc.transfer(treasury, amount)) revert TransferFailed();
        collectedTotal += amount;
        emit RevenueCollected(amount);
    }

    // ------------------------------------------------------------------
    // Reads (what the API backend calls per request)
    // ------------------------------------------------------------------

    /// @notice True while the customer's plan is set and paid time remains.
    function isSubscribed(address user) external view returns (bool) {
        return plan[user] != Plan.None && paidUntil[user] > block.timestamp;
    }

    /// @notice Everything the backend or a frontend needs about an account.
    function getAccount(address user)
        external
        view
        returns (Plan currentPlan, uint256 paidUntilTs, uint256 creditUsdc, uint256 monthlyPrice)
    {
        currentPlan = plan[user];
        paidUntilTs = paidUntil[user];
        creditUsdc = credit[user];
        monthlyPrice = currentPlan == Plan.None ? 0 : _price(currentPlan);
    }

    function pendingCollect() external view returns (uint256) {
        return earnedPot;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _price(Plan p) internal view returns (uint256) {
        return p == Plan.Pro ? proPrice : hobbyPrice;
    }

    /// @dev Recognise prepaid time already consumed as operator revenue.
    ///      Called on every touch of the user. Intentionally understated
    ///      between touches: only ever grows, never overstates.
    function _account(address user) internal {
        Plan p = plan[user];
        if (p == Plan.None) return;
        uint256 until = paidUntil[user];
        uint256 recognized = block.timestamp < until ? block.timestamp : until;
        if (recognized <= lastAccrued[user]) return; // stale/no prepaid time: nothing to recognise
        uint256 consumed = recognized - lastAccrued[user];
        earnedPot += (consumed * _price(p)) / MONTH;
        lastAccrued[user] = recognized;
    }

    /// @dev Refundable value of the current prepaid span. Caller must ensure
    ///      the account is active (paidUntil > now).
    function _remainingRefund(address user) internal view returns (uint256) {
        uint256 remaining = paidUntil[user] - block.timestamp;
        return (remaining * _price(plan[user])) / MONTH;
    }

    /// @dev Buy whole months from credit while it lasts, without ever billing
    ///      for time that already elapsed uncovered (a lapsed subscription
    ///      restarts from now, it is not back-billed).
    function _renew(address user) internal {
        Plan p = plan[user];
        if (p == Plan.None) return;
        uint256 price = _price(p);

        uint256 anchor;
        if (paidUntil[user] > block.timestamp) {
            anchor = paidUntil[user];
        } else {
            anchor = block.timestamp; // lapsed or never started: restart, never back-bill
        }

        uint256 horizon = block.timestamp + MAX_AHEAD * MONTH;
        uint256 bought;
        while (bought < MAX_AHEAD && anchor + MONTH <= horizon && credit[user] >= price) {
            credit[user] -= price;
            anchor += MONTH;
            unchecked {
                ++bought;
            }
        }

        if (bought > 0) {
            paidUntil[user] = anchor;
            lastAccrued[user] = block.timestamp; // consumption accrues from the new span's clock
            emit Extended(user, p, bought, anchor, credit[user]);
        }
    }
}
