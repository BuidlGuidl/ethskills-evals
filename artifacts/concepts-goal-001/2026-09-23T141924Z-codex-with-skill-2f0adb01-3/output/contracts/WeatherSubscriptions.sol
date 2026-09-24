// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract WeatherSubscriptions {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Subscription {
        Plan plan;
        uint256 balance;
        uint256 lastAccruedAt;
        uint256 accrualRemainder;
        uint256 totalPaid;
    }

    uint256 public constant SECONDS_PER_MONTH = 30 days;
    uint256 public constant HOBBY_MONTHLY_PRICE = 5_000_000;
    uint256 public constant PRO_MONTHLY_PRICE = 20_000_000;

    IERC20 public immutable usdc;
    address public owner;
    address public treasury;
    uint256 public withdrawable;

    mapping(address account => Subscription) public subscriptions;

    bool private locked;

    event ToppedUp(address indexed account, address indexed payer, uint256 amount);
    event Subscribed(address indexed account, Plan indexed plan);
    event Settled(address indexed account, uint256 charged, uint256 remainingBalance);
    event Canceled(address indexed account, uint256 refund);
    event Withdrawn(address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error AmountIsZero();
    error InvalidAddress();
    error InvalidPlan();
    error NoSubscription();
    error NoBalance();
    error InsufficientEarnedBalance();
    error NotOwner();
    error ReentrantCall();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    constructor(IERC20 usdc_, address treasury_) {
        if (address(usdc_) == address(0) || treasury_ == address(0)) revert InvalidAddress();

        usdc = usdc_;
        owner = msg.sender;
        treasury = treasury_;

        emit OwnershipTransferred(address(0), msg.sender);
        emit TreasuryUpdated(address(0), treasury_);
    }

    function topUp(uint256 amount) external {
        topUpFor(msg.sender, amount);
    }

    function topUpFor(address account, uint256 amount) public nonReentrant {
        if (account == address(0)) revert InvalidAddress();
        if (amount == 0) revert AmountIsZero();

        _settle(account);
        subscriptions[account].balance += amount;
        _safeTransferFrom(address(usdc), msg.sender, address(this), amount);

        emit ToppedUp(account, msg.sender, amount);
    }

    function subscribe(Plan plan) external nonReentrant {
        if (plan != Plan.Hobby && plan != Plan.Pro) revert InvalidPlan();

        Subscription storage subscription = subscriptions[msg.sender];
        _settle(msg.sender);
        if (subscription.balance == 0) revert NoBalance();

        subscription.plan = plan;
        subscription.lastAccruedAt = block.timestamp;
        subscription.accrualRemainder = 0;

        emit Subscribed(msg.sender, plan);
    }

    function settle(address account) external nonReentrant returns (uint256 charged) {
        charged = _settle(account);
    }

    function cancel() external nonReentrant returns (uint256 refund) {
        Subscription storage subscription = subscriptions[msg.sender];
        if (subscription.plan == Plan.None && subscription.balance == 0) revert NoSubscription();

        _settle(msg.sender);

        refund = subscription.balance;
        subscription.plan = Plan.None;
        subscription.balance = 0;
        subscription.lastAccruedAt = 0;
        subscription.accrualRemainder = 0;

        if (refund != 0) {
            _safeTransfer(address(usdc), msg.sender, refund);
        }

        emit Canceled(msg.sender, refund);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert AmountIsZero();
        if (amount > withdrawable) revert InsufficientEarnedBalance();

        withdrawable -= amount;
        _safeTransfer(address(usdc), treasury, amount);

        emit Withdrawn(treasury, amount);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        uint256 amount = withdrawable;
        if (amount == 0) revert AmountIsZero();

        withdrawable = 0;
        _safeTransfer(address(usdc), treasury, amount);

        emit Withdrawn(treasury, amount);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();

        address oldOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function isSubscribed(address account) external view returns (bool) {
        Subscription storage subscription = subscriptions[account];
        if (subscription.plan == Plan.None || subscription.balance == 0) return false;

        (uint256 owed,) = _previewCharge(subscription, block.timestamp);
        return owed < subscription.balance;
    }

    function availableBalance(address account) external view returns (uint256) {
        Subscription storage subscription = subscriptions[account];
        (uint256 owed,) = _previewCharge(subscription, block.timestamp);

        if (owed >= subscription.balance) return 0;
        return subscription.balance - owed;
    }

    function previewCharge(address account) external view returns (uint256 charge, uint256 remainder) {
        return _previewCharge(subscriptions[account], block.timestamp);
    }

    function activeUntil(address account) public view returns (uint256) {
        Subscription storage subscription = subscriptions[account];
        uint256 monthlyPrice = monthlyPriceOf(subscription.plan);
        if (monthlyPrice == 0 || subscription.balance == 0) return 0;

        uint256 amountToExhaust = subscription.balance * SECONDS_PER_MONTH;
        if (subscription.accrualRemainder >= amountToExhaust) return subscription.lastAccruedAt;

        return subscription.lastAccruedAt + _ceilDiv(amountToExhaust - subscription.accrualRemainder, monthlyPrice);
    }

    function subscriptionStatus(address account)
        external
        view
        returns (
            Plan plan,
            string memory planName,
            uint256 balance,
            uint256 monthlyPrice,
            uint256 paidTotal,
            uint256 activeThrough,
            bool active
        )
    {
        Subscription storage subscription = subscriptions[account];
        (uint256 owed,) = _previewCharge(subscription, block.timestamp);

        plan = subscription.plan;
        planName = nameOf(plan);
        monthlyPrice = monthlyPriceOf(plan);
        paidTotal = subscription.totalPaid;
        activeThrough = activeUntil(account);
        active = plan != Plan.None && owed < subscription.balance;
        balance = owed >= subscription.balance ? 0 : subscription.balance - owed;
    }

    function monthlyPriceOf(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_MONTHLY_PRICE;
        if (plan == Plan.Pro) return PRO_MONTHLY_PRICE;
        return 0;
    }

    function nameOf(Plan plan) public pure returns (string memory) {
        if (plan == Plan.Hobby) return "hobby";
        if (plan == Plan.Pro) return "pro";
        return "none";
    }

    function _settle(address account) internal returns (uint256 charged) {
        Subscription storage subscription = subscriptions[account];
        (charged, subscription.accrualRemainder) = _previewCharge(subscription, block.timestamp);

        if (charged == 0) return 0;

        if (charged >= subscription.balance) {
            charged = subscription.balance;
            subscription.balance = 0;
            subscription.plan = Plan.None;
            subscription.lastAccruedAt = 0;
            subscription.accrualRemainder = 0;
        } else {
            subscription.balance -= charged;
            subscription.lastAccruedAt = block.timestamp;
        }

        subscription.totalPaid += charged;
        withdrawable += charged;

        emit Settled(account, charged, subscription.balance);
    }

    function _previewCharge(Subscription storage subscription, uint256 timestamp)
        internal
        view
        returns (uint256 charge, uint256 remainder)
    {
        uint256 monthlyPrice = monthlyPriceOf(subscription.plan);
        if (monthlyPrice == 0 || subscription.lastAccruedAt == 0 || timestamp <= subscription.lastAccruedAt) {
            return (0, subscription.accrualRemainder);
        }

        uint256 elapsed = timestamp - subscription.lastAccruedAt;
        uint256 numerator = elapsed * monthlyPrice + subscription.accrualRemainder;

        charge = numerator / SECONDS_PER_MONTH;
        remainder = numerator % SECONDS_PER_MONTH;
    }

    function _ceilDiv(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        if (numerator == 0) return 0;
        return ((numerator - 1) / denominator) + 1;
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
