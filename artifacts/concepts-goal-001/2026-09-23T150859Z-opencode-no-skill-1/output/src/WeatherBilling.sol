// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract WeatherBilling {
    uint256 public constant BILLING_PERIOD = 30 days;

    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        Plan plan;
        uint128 price;
        uint64 lastSettled;
        uint256 balance;
    }

    IERC20 public immutable usdc;
    address public owner;
    uint128 public hobbyPrice;
    uint128 public proPrice;
    uint256 public totalEarned;

    mapping(address => Account) internal accounts;

    event TopUp(address indexed user, uint256 amount);
    event PlanSet(address indexed user, Plan plan, uint128 price);
    event Cancelled(address indexed user, uint256 refund);
    event Settled(
        address indexed user, uint256 charged, uint256 remainingBalance, uint64 settledUntil
    );
    event EarnedWithdrawn(address indexed to, uint256 amount);
    event PricesSet(uint128 hobbyPrice, uint128 proPrice);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidPlan();
    error InsufficientEarned();
    error UsdcTransferFailed();
    error ReentrantCall();

    uint256 private constant UNLOCKED = 1;
    uint256 private constant LOCKED = 2;
    uint256 private guardState = UNLOCKED;

    modifier nonReentrant() {
        if (guardState != UNLOCKED) revert ReentrantCall();
        guardState = LOCKED;
        _;
        guardState = UNLOCKED;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address owner_, uint128 hobbyPrice_, uint128 proPrice_) {
        if (usdc_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (hobbyPrice_ == 0 || proPrice_ == 0) revert ZeroAmount();
        usdc = IERC20(usdc_);
        owner = owner_;
        hobbyPrice = hobbyPrice_;
        proPrice = proPrice_;
        emit OwnershipTransferred(address(0), owner_);
        emit PricesSet(hobbyPrice_, proPrice_);
    }

    function topUp(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        accounts[msg.sender].balance += amount;
        emit TopUp(msg.sender, amount);
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert UsdcTransferFailed();
    }

    function setPlan(Plan plan) external {
        if (plan == Plan.None) revert InvalidPlan();
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        a.plan = plan;
        a.price = currentPrice(plan);
        emit PlanSet(msg.sender, plan, a.price);
    }

    function cancel() external nonReentrant {
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        uint256 refund = a.balance;
        a.balance = 0;
        a.plan = Plan.None;
        a.price = 0;
        a.lastSettled = uint64(block.timestamp);
        emit Cancelled(msg.sender, refund);
        if (refund > 0) {
            if (!usdc.transfer(msg.sender, refund)) revert UsdcTransferFailed();
        }
    }

    function settle(address user) external {
        _settle(user);
    }

    function settleMany(address[] calldata users) external {
        for (uint256 i = 0; i < users.length; i++) {
            _settle(users[i]);
        }
    }

    function isSubscribed(address user) public view returns (bool) {
        Account storage a = accounts[user];
        if (a.plan == Plan.None || a.balance == 0) return false;
        uint256 elapsed = block.timestamp - a.lastSettled;
        return (elapsed * a.price) / BILLING_PERIOD < a.balance;
    }

    function secondsRemaining(address user) external view returns (uint256) {
        Account storage a = accounts[user];
        if (a.plan == Plan.None || a.balance == 0) return 0;
        uint256 elapsed = block.timestamp - a.lastSettled;
        uint256 covered = (a.balance * BILLING_PERIOD) / a.price;
        return covered > elapsed ? covered - elapsed : 0;
    }

    function getAccount(address user)
        external
        view
        returns (
            Plan plan,
            uint128 price,
            uint64 lastSettled,
            uint256 balance,
            uint256 owedNow,
            bool subscribed
        )
    {
        Account storage a = accounts[user];
        plan = a.plan;
        price = a.price;
        lastSettled = a.lastSettled;
        balance = a.balance;
        owedNow = (a.plan == Plan.None || a.balance == 0)
            ? 0
            : ((block.timestamp - a.lastSettled) * a.price) / BILLING_PERIOD;
        subscribed = isSubscribed(user);
    }

    function withdrawEarned(uint256 amount) external nonReentrant onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > totalEarned) revert InsufficientEarned();
        totalEarned -= amount;
        emit EarnedWithdrawn(owner, amount);
        if (!usdc.transfer(owner, amount)) revert UsdcTransferFailed();
    }

    function setPrices(uint128 hobbyPrice_, uint128 proPrice_) external onlyOwner {
        if (hobbyPrice_ == 0 || proPrice_ == 0) revert ZeroAmount();
        hobbyPrice = hobbyPrice_;
        proPrice = proPrice_;
        emit PricesSet(hobbyPrice_, proPrice_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    function currentPrice(Plan plan) public view returns (uint128) {
        return plan == Plan.Hobby ? hobbyPrice : proPrice;
    }

    function _settle(address user) internal {
        Account storage a = accounts[user];
        if (a.plan == Plan.None || a.balance == 0) {
            a.lastSettled = uint64(block.timestamp);
            return;
        }
        uint256 elapsed = block.timestamp - a.lastSettled;
        if (elapsed == 0) return;
        uint256 owed = (elapsed * a.price) / BILLING_PERIOD;
        if (owed == 0) return;
        if (owed >= a.balance) {
            uint256 timeCovered = (a.balance * BILLING_PERIOD) / a.price;
            a.lastSettled += uint64(timeCovered);
            uint256 charged = a.balance;
            a.balance = 0;
            totalEarned += charged;
            emit Settled(user, charged, 0, a.lastSettled);
        } else {
            a.balance -= owed;
            a.lastSettled = uint64(block.timestamp);
            totalEarned += owed;
            emit Settled(user, owed, a.balance, a.lastSettled);
        }
    }
}
