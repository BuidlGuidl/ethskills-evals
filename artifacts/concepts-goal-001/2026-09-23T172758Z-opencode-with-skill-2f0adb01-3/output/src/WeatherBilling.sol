// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract WeatherBilling {
    enum Status {
        None,
        Active,
        Cancelled,
        Lapsed
    }

    struct Subscription {
        Status status;
        uint32 planId;
        uint128 price;
        uint64 lastSettle;
        uint128 credit;
    }

    uint256 public constant BILLING_PERIOD = 30 days;
    uint256 public constant HOBBY_PLAN_ID = 0;
    uint256 public constant PRO_PLAN_ID = 1;

    IERC20 public immutable usdc;
    address public owner;
    address public pendingOwner;
    uint256 public totalCredits;
    uint256 public totalSettled;

    mapping(uint256 => uint256) public planPrice;
    mapping(address => Subscription) public subs;

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidAmount();
    error InvalidPlan();
    error InvalidPrice();
    error UnknownPlan();
    error AlreadyActive();
    error NotActive();
    error SubscriptionActive();
    error InsufficientCredit(uint256 have, uint256 want);
    error TransferFailed();

    event Deposited(address indexed customer, uint256 amount);
    event Subscribed(address indexed customer, uint256 planId, uint256 price);
    event PlanSwitched(address indexed customer, uint256 planId, uint256 price);
    event Settled(address indexed customer, uint256 cost, uint256 remainingCredit);
    event Lapsed(address indexed customer);
    event Cancelled(address indexed customer, uint256 refund);
    event Withdrawn(address indexed customer, uint256 amount);
    event PlanSet(uint256 indexed planId, uint256 price);
    event Swept(uint256 amount);
    event OwnershipStarted(address indexed pendingOwner);
    event OwnershipAccepted(address indexed owner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, address usdc_, uint256 hobbyPrice_, uint256 proPrice_) {
        if (owner_ == address(0) || usdc_ == address(0)) revert ZeroAddress();
        if (hobbyPrice_ == 0 || proPrice_ == 0) revert InvalidPrice();
        if (hobbyPrice_ > type(uint128).max || proPrice_ > type(uint128).max) revert InvalidPrice();
        owner = owner_;
        usdc = IERC20(usdc_);
        planPrice[HOBBY_PLAN_ID] = hobbyPrice_;
        planPrice[PRO_PLAN_ID] = proPrice_;
        emit PlanSet(HOBBY_PLAN_ID, hobbyPrice_);
        emit PlanSet(PRO_PLAN_ID, proPrice_);
    }

    function deposit(uint256 amount) public {
        if (amount == 0 || amount > type(uint128).max) revert InvalidAmount();
        _settle(msg.sender);
        Subscription storage s = subs[msg.sender];
        if (uint256(s.credit) + amount > type(uint128).max) revert InvalidAmount();
        s.credit += uint128(amount);
        totalCredits += amount;
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Deposited(msg.sender, amount);
    }

    function depositAndSubscribe(uint256 amount, uint256 planId) external {
        deposit(amount);
        subscribe(planId);
    }

    function subscribe(uint256 planId) public {
        uint256 price = planPrice[planId];
        if (price == 0) revert UnknownPlan();
        Subscription storage s = subs[msg.sender];
        if (s.status == Status.Active) revert AlreadyActive();
        if (s.credit < price) revert InsufficientCredit(s.credit, price);
        s.status = Status.Active;
        s.planId = uint32(planId);
        s.price = uint128(price);
        s.lastSettle = uint64(block.timestamp);
        emit Subscribed(msg.sender, planId, price);
    }

    function switchPlan(uint256 planId) external {
        uint256 price = planPrice[planId];
        if (price == 0) revert UnknownPlan();
        Subscription storage s = subs[msg.sender];
        if (s.status != Status.Active) revert NotActive();
        _settle(msg.sender);
        if (s.status != Status.Active) revert NotActive();
        if (s.credit < price) revert InsufficientCredit(s.credit, price);
        s.planId = uint32(planId);
        s.price = uint128(price);
        emit PlanSwitched(msg.sender, planId, price);
    }

    function cancel() external {
        Subscription storage s = subs[msg.sender];
        if (s.status != Status.Active) revert NotActive();
        _settle(msg.sender);
        uint256 refund = s.credit;
        s.credit = 0;
        s.status = Status.Cancelled;
        totalCredits -= refund;
        if (refund > 0) {
            if (!usdc.transfer(msg.sender, refund)) revert TransferFailed();
        }
        emit Cancelled(msg.sender, refund);
    }

    function withdraw(uint256 amount) external {
        Subscription storage s = subs[msg.sender];
        if (s.status == Status.Active) revert SubscriptionActive();
        if (amount == 0 || amount > s.credit) revert InvalidAmount();
        s.credit -= uint128(amount);
        totalCredits -= amount;
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function settle(address customer) external returns (uint256) {
        return _settle(customer);
    }

    function settleMany(address[] calldata customers) external {
        for (uint256 i = 0; i < customers.length; ++i) {
            _settle(customers[i]);
        }
    }

    function isSubscribed(address customer) external view returns (bool) {
        Subscription storage s = subs[customer];
        if (s.status != Status.Active) return false;
        return accruedCost(customer) < s.credit;
    }

    function accruedCost(address customer) public view returns (uint256) {
        Subscription storage s = subs[customer];
        return (block.timestamp - s.lastSettle) * uint256(s.price) / BILLING_PERIOD;
    }

    function remainingCredit(address customer) external view returns (uint256) {
        uint256 accrued = accruedCost(customer);
        uint256 credit = subs[customer].credit;
        return credit > accrued ? credit - accrued : 0;
    }

    function setPlan(uint256 planId, uint256 price) external onlyOwner {
        if (planId > type(uint32).max) revert InvalidPlan();
        if (price > type(uint128).max) revert InvalidPrice();
        planPrice[planId] = price;
        emit PlanSet(planId, price);
    }

    function sweepExcess() external onlyOwner {
        uint256 excess = usdc.balanceOf(address(this)) - totalCredits;
        if (excess > 0) {
            if (!usdc.transfer(owner, excess)) revert TransferFailed();
            emit Swept(excess);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipStarted(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipAccepted(msg.sender);
    }

    function _settle(address customer) internal returns (uint256 cost) {
        Subscription storage s = subs[customer];
        if (s.status != Status.Active) return 0;
        uint256 elapsed = block.timestamp - s.lastSettle;
        if (elapsed == 0) return 0;
        uint256 credit = s.credit;
        cost = elapsed * uint256(s.price) / BILLING_PERIOD;
        if (cost == 0) return 0;
        if (cost >= credit) {
            cost = credit;
            s.credit = 0;
            s.status = Status.Lapsed;
            s.lastSettle = uint64(block.timestamp);
            totalCredits -= credit;
            totalSettled += cost;
            if (!usdc.transfer(owner, cost)) revert TransferFailed();
            emit Lapsed(customer);
            emit Settled(customer, cost, 0);
        } else {
            s.credit = uint128(credit - cost);
            s.lastSettle = uint64(block.timestamp);
            totalCredits -= cost;
            totalSettled += cost;
            if (!usdc.transfer(owner, cost)) revert TransferFailed();
            emit Settled(customer, cost, s.credit);
        }
    }
}
