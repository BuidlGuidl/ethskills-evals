// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract WeatherBilling {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    uint256 public constant BILLING_PERIOD = 30 days;
    uint256 public constant HOBBY_MONTHLY_USDC = 5_000_000;
    uint256 public constant PRO_MONTHLY_USDC = 20_000_000;

    IERC20 public immutable usdc;
    address public immutable operator;

    struct Account {
        Plan plan;
        uint64 lastSettled;
        uint256 credit;
    }

    mapping(address => Account) public accounts;

    uint256 public revenuePool;

    event ToppedUp(address indexed user, uint256 amount, uint256 creditAfter);
    event Subscribed(address indexed user, Plan plan, uint256 paidFrom);
    event AccountLapsed(address indexed user, uint64 at);
    event Cancelled(address indexed user, uint256 refund);
    event RevenueWithdrawn(address indexed to, uint256 amount);

    error InvalidPlan();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientCredit();
    error NotOperator();
    error AnchorOverflow();
    error UsdcTransferFailed();

    constructor(address usdc_, address operator_) {
        if (usdc_ == address(0) || operator_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        operator = operator_;
    }

    function topUp(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        a.credit += amount;
        emit ToppedUp(msg.sender, amount, a.credit);
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert UsdcTransferFailed();
    }

    function subscribe(Plan plan) external {
        if (plan != Plan.Hobby && plan != Plan.Pro) revert InvalidPlan();
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        if (a.credit == 0) revert InsufficientCredit();
        a.plan = plan;
        a.lastSettled = uint64(block.timestamp);
        emit Subscribed(msg.sender, plan, block.timestamp);
    }

    function cancel() external {
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        uint256 refund = a.credit;
        a.credit = 0;
        a.plan = Plan.None;
        emit Cancelled(msg.sender, refund);
        if (!usdc.transfer(msg.sender, refund)) revert UsdcTransferFailed();
    }

    function isSubscribed(address user) external view returns (bool) {
        Account memory a = accounts[user];
        if (a.plan == Plan.None) return false;
        return block.timestamp < paidThrough(user);
    }

    function paidThrough(address user) public view returns (uint256) {
        Account memory a = accounts[user];
        if (a.plan == Plan.None) return 0;
        return uint256(a.lastSettled) + a.credit * BILLING_PERIOD / monthlyPrice(a.plan);
    }

    function getAccount(address user)
        external
        view
        returns (Plan plan, uint256 credit, uint64 lastSettled, uint256 paidThroughAt)
    {
        Account memory a = accounts[user];
        return (a.plan, a.credit, a.lastSettled, paidThrough(user));
    }

    function withdrawRevenue() external {
        if (msg.sender != operator) revert NotOperator();
        uint256 amount = revenuePool;
        revenuePool = 0;
        emit RevenueWithdrawn(operator, amount);
        if (!usdc.transfer(operator, amount)) revert UsdcTransferFailed();
    }

    function monthlyPrice(Plan plan) public pure returns (uint256) {
        return plan == Plan.Pro ? PRO_MONTHLY_USDC : HOBBY_MONTHLY_USDC;
    }

    function _settle(address user) internal {
        Account storage a = accounts[user];
        if (a.plan == Plan.None) return;
        uint256 price = monthlyPrice(a.plan);
        uint256 owed = (block.timestamp - a.lastSettled) * price / BILLING_PERIOD;
        if (owed < a.credit) {
            a.credit -= owed;
            a.lastSettled = uint64(block.timestamp);
            revenuePool += owed;
        } else {
            uint256 paid = a.credit;
            uint256 anchor = uint256(a.lastSettled) + paid * BILLING_PERIOD / price;
            if (anchor > type(uint64).max) revert AnchorOverflow();
            a.lastSettled = uint64(anchor);
            a.credit = 0;
            a.plan = Plan.None;
            revenuePool += paid;
            emit AccountLapsed(user, uint64(anchor));
        }
    }
}