// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUSDC {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract Billing {
    uint256 public constant MONTH = 30 days;
    uint8 public constant PLAN_COUNT = 3;

    struct Account {
        uint8 plan;
        uint256 credit;
        uint256 lastCharged;
    }

    IUSDC public immutable usdc;
    address public owner;

    mapping(uint8 => uint256) public planPrice;
    mapping(address => Account) public accounts;
    uint256 public pendingRevenue;

    event ToppedUp(address indexed user, uint256 amount);
    event Subscribed(address indexed user, uint8 plan);
    event Cancelled(address indexed user, uint8 plan, uint256 refund);
    event Lapsed(address indexed user, uint8 plan);
    event Withdrew(address indexed user, uint256 amount);
    event PriceChanged(uint8 indexed plan, uint256 price);
    event RevenueCollected(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error BadPlan();
    error InsufficientCredit();
    error NotSubscribed();
    error InsufficientRevenue();
    error UnsupportedToken();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address owner_) {
        if (usdc_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        IUSDC token = IUSDC(usdc_);
        if (token.decimals() != 6) revert UnsupportedToken();
        usdc = token;
        owner = owner_;
        planPrice[1] = 5e6;
        planPrice[2] = 20e6;
    }

    function topUp(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        accounts[msg.sender].credit += amount;
        emit ToppedUp(msg.sender, amount);
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
    }

    function subscribe(uint8 plan) external {
        if (plan == 0 || plan >= PLAN_COUNT) revert BadPlan();
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        if (a.credit < planPrice[plan]) revert InsufficientCredit();
        a.plan = plan;
        a.lastCharged = block.timestamp;
        emit Subscribed(msg.sender, plan);
    }

    function cancel() external {
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        uint8 oldPlan = a.plan;
        if (oldPlan == 0) revert NotSubscribed();
        a.plan = 0;
        a.lastCharged = block.timestamp;
        uint256 refund = a.credit;
        a.credit = 0;
        emit Cancelled(msg.sender, oldPlan, refund);
        if (!usdc.transfer(msg.sender, refund)) revert TransferFailed();
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        if (amount > a.credit) revert InsufficientCredit();
        a.credit -= amount;
        emit Withdrew(msg.sender, amount);
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
    }

    function isSubscribed(address user) external view returns (bool) {
        Account storage a = accounts[user];
        uint256 price = planPrice[a.plan];
        if (price == 0) return false;
        uint256 due = (block.timestamp - a.lastCharged) * price / MONTH;
        return a.credit > due;
    }

    function getAccount(address user)
        external
        view
        returns (uint8 plan, uint256 credit, uint256 lastCharged, uint256 pricePerMonth, uint256 paidUntil)
    {
        Account storage a = accounts[user];
        plan = a.plan;
        credit = a.credit;
        lastCharged = a.lastCharged;
        if (plan == 0) return (0, credit, lastCharged, 0, 0);
        pricePerMonth = planPrice[plan];
        uint256 due = (block.timestamp - a.lastCharged) * pricePerMonth / MONTH;
        uint256 remaining = due >= credit ? 0 : credit - due;
        paidUntil = block.timestamp + remaining * MONTH / pricePerMonth;
    }

    function settle(address user) external {
        _settle(user);
    }

    function setPlanPrice(uint8 plan, uint256 price) external onlyOwner {
        if (plan == 0 || plan >= PLAN_COUNT) revert BadPlan();
        if (price == 0) revert ZeroAmount();
        planPrice[plan] = price;
        emit PriceChanged(plan, price);
    }

    function collectRevenue(address to, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > pendingRevenue) revert InsufficientRevenue();
        pendingRevenue -= amount;
        emit RevenueCollected(to, amount);
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function _settle(address user) internal {
        Account storage a = accounts[user];
        if (a.plan == 0) return;
        uint256 due = (block.timestamp - a.lastCharged) * planPrice[a.plan] / MONTH;
        a.lastCharged = block.timestamp;
        if (due >= a.credit) {
            uint8 oldPlan = a.plan;
            pendingRevenue += a.credit;
            a.credit = 0;
            a.plan = 0;
            emit Lapsed(user, oldPlan);
        } else {
            a.credit -= due;
            pendingRevenue += due;
        }
    }
}
