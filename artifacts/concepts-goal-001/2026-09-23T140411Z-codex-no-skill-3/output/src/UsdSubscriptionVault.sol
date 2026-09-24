// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice USDC prepaid subscription vault for a two-plan API service.
/// @dev Billing is lazy: callers settle accounts when they interact, while views can still
///      determine whether deposited credit covers the current moment.
contract UsdSubscriptionVault {
    uint8 public constant PLAN_NONE = 0;
    uint8 public constant PLAN_HOBBY = 1;
    uint8 public constant PLAN_PRO = 2;

    uint256 public constant USDC_SCALE = 1_000_000;
    uint256 public constant HOBBY_PRICE = 5 * USDC_SCALE;
    uint256 public constant PRO_PRICE = 20 * USDC_SCALE;
    uint64 public constant BILLING_PERIOD = 30 days;

    IERC20 public immutable usdc;
    address public owner;
    address public treasury;
    uint256 public accruedRevenue;

    struct Account {
        uint128 balance;
        uint128 unearned;
        uint128 periodCharge;
        uint64 periodStartedAt;
        uint64 paidUntil;
        uint64 lastAccruedAt;
        uint8 planId;
        bool active;
    }

    struct Status {
        bool subscribed;
        bool active;
        uint8 planId;
        uint64 paidUntil;
        uint256 creditBalance;
        uint256 unearned;
        uint256 refundableIfCanceled;
    }

    mapping(address => Account) public accounts;

    uint256 private _locked = 1;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event Deposited(address indexed payer, address indexed account, uint256 amount);
    event CreditWithdrawn(address indexed account, uint256 amount);
    event PlanSelected(address indexed account, uint8 indexed planId);
    event PeriodCharged(
        address indexed account, uint8 indexed planId, uint64 periodStart, uint64 paidUntil, uint256 amount
    );
    event RevenueAccrued(address indexed account, uint256 amount);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event SubscriptionLapsed(address indexed account, uint64 coveredThrough);
    event SubscriptionCanceled(address indexed account, uint256 refundAmount);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidPlan();
    error InsufficientCredit(uint256 required, uint256 available);
    error NotOwner();
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(IERC20 usdc_, address owner_, address treasury_) {
        if (address(usdc_) == address(0) || owner_ == address(0) || treasury_ == address(0)) {
            revert InvalidAddress();
        }

        usdc = usdc_;
        owner = owner_;
        treasury = treasury_;

        emit OwnershipTransferred(address(0), owner_);
        emit TreasuryUpdated(address(0), treasury_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function planPrice(uint8 planId) public pure returns (uint256) {
        if (planId == PLAN_HOBBY) return HOBBY_PRICE;
        if (planId == PLAN_PRO) return PRO_PRICE;
        return 0;
    }

    function deposit(uint256 amount) external {
        depositFor(msg.sender, amount);
    }

    function depositFor(address account, uint256 amount) public nonReentrant {
        if (account == address(0)) revert InvalidAddress();
        if (amount == 0 || amount > type(uint128).max) revert InvalidAmount();

        _settle(account, uint64(block.timestamp));
        accounts[account].balance += uint128(amount);
        _safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, account, amount);
    }

    function selectPlan(uint8 planId) external nonReentrant {
        if (planPrice(planId) == 0) revert InvalidPlan();

        Account storage account = accounts[msg.sender];
        uint64 timestamp = uint64(block.timestamp);
        _settle(msg.sender, timestamp);

        account.planId = planId;
        emit PlanSelected(msg.sender, planId);

        if (!account.active) {
            account.active = true;
            _chargePeriod(msg.sender, account, timestamp, planId);
            return;
        }

        if (account.paidUntil <= timestamp && account.unearned == 0) {
            _chargePeriod(msg.sender, account, timestamp, planId);
        }
    }

    function settle(address account) external nonReentrant returns (bool subscribed) {
        _settle(account, uint64(block.timestamp));
        subscribed = _isSubscribed(accounts[account], uint64(block.timestamp));
    }

    function settleMany(address[] calldata accountList) external nonReentrant {
        uint64 timestamp = uint64(block.timestamp);
        for (uint256 i = 0; i < accountList.length; i++) {
            _settle(accountList[i], timestamp);
        }
    }

    function cancel() external nonReentrant returns (uint256 refundAmount) {
        Account storage account = accounts[msg.sender];
        _settle(msg.sender, uint64(block.timestamp));

        refundAmount = uint256(account.balance) + account.unearned;

        account.balance = 0;
        account.unearned = 0;
        account.periodCharge = 0;
        account.periodStartedAt = uint64(block.timestamp);
        account.paidUntil = uint64(block.timestamp);
        account.lastAccruedAt = uint64(block.timestamp);
        account.planId = PLAN_NONE;
        account.active = false;

        if (refundAmount != 0) {
            _safeTransfer(msg.sender, refundAmount);
        }

        emit SubscriptionCanceled(msg.sender, refundAmount);
    }

    function withdrawCredit(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();

        Account storage account = accounts[msg.sender];
        _settle(msg.sender, uint64(block.timestamp));
        if (account.balance < amount) revert InsufficientCredit(amount, account.balance);

        account.balance -= uint128(amount);
        _safeTransfer(msg.sender, amount);

        emit CreditWithdrawn(msg.sender, amount);
    }

    function withdrawRevenue(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0 || amount > accruedRevenue) revert InvalidAmount();

        accruedRevenue -= amount;
        _safeTransfer(to, amount);

        emit RevenueWithdrawn(to, amount);
    }

    function withdrawAllRevenue() external onlyOwner nonReentrant returns (uint256 amount) {
        amount = accruedRevenue;
        if (amount == 0) revert InvalidAmount();

        accruedRevenue = 0;
        _safeTransfer(treasury, amount);

        emit RevenueWithdrawn(treasury, amount);
    }

    function isSubscribed(address account) external view returns (bool) {
        return _isSubscribed(accounts[account], uint64(block.timestamp));
    }

    function subscriptionStatus(address account) external view returns (Status memory status) {
        Account memory data = accounts[account];
        status.subscribed = _isSubscribed(data, uint64(block.timestamp));
        status.active = data.active;
        status.planId = data.planId;
        status.paidUntil = _coverageUntil(data, uint64(block.timestamp));
        status.creditBalance = data.balance;
        status.unearned = _previewUnearned(data, uint64(block.timestamp));
        status.refundableIfCanceled = _previewRefund(data, uint64(block.timestamp));
    }

    function _settle(address accountAddress, uint64 timestamp) internal {
        Account storage account = accounts[accountAddress];
        if (!account.active) return;

        _accrueCurrentPeriod(accountAddress, account, timestamp);

        while (account.active && timestamp >= account.paidUntil) {
            uint256 price = planPrice(account.planId);
            if (price == 0) {
                account.active = false;
                emit SubscriptionLapsed(accountAddress, account.paidUntil);
                break;
            }

            if (account.balance < price) {
                account.active = false;
                emit SubscriptionLapsed(accountAddress, account.paidUntil);
                break;
            }

            _chargePeriod(accountAddress, account, account.paidUntil, account.planId);
            _accrueCurrentPeriod(accountAddress, account, timestamp);
        }
    }

    function _chargePeriod(address accountAddress, Account storage account, uint64 periodStart, uint8 planId) internal {
        uint256 price = planPrice(planId);
        if (account.balance < price) revert InsufficientCredit(price, account.balance);

        account.balance -= uint128(price);
        account.unearned = uint128(price);
        account.periodCharge = uint128(price);
        account.periodStartedAt = periodStart;
        account.paidUntil = periodStart + BILLING_PERIOD;
        account.lastAccruedAt = periodStart;

        emit PeriodCharged(accountAddress, planId, periodStart, account.paidUntil, price);
    }

    function _accrueCurrentPeriod(address accountAddress, Account storage account, uint64 timestamp) internal {
        if (account.unearned == 0 || account.periodCharge == 0 || timestamp <= account.lastAccruedAt) {
            return;
        }

        uint64 accrueThrough = timestamp < account.paidUntil ? timestamp : account.paidUntil;
        if (accrueThrough <= account.lastAccruedAt) return;

        uint256 earned;
        if (accrueThrough == account.paidUntil) {
            earned = account.unearned;
        } else {
            uint256 cumulativeEarned =
                uint256(account.periodCharge) * (accrueThrough - account.periodStartedAt) / BILLING_PERIOD;
            uint256 alreadyEarned = uint256(account.periodCharge) - account.unearned;
            earned = cumulativeEarned > alreadyEarned ? cumulativeEarned - alreadyEarned : 0;
        }

        if (earned != 0) {
            account.unearned -= uint128(earned);
            accruedRevenue += earned;
            emit RevenueAccrued(accountAddress, earned);
        }

        account.lastAccruedAt = accrueThrough;
    }

    function _isSubscribed(Account memory account, uint64 timestamp) internal pure returns (bool) {
        return _coverageUntil(account, timestamp) > timestamp;
    }

    function _coverageUntil(Account memory account, uint64 timestamp) internal pure returns (uint64) {
        if (!account.active || planPrice(account.planId) == 0) return account.paidUntil;

        uint64 coverageUntil = account.paidUntil;
        uint256 balance = account.balance;
        uint256 price = planPrice(account.planId);

        while (coverageUntil <= timestamp && balance >= price) {
            balance -= price;
            coverageUntil += BILLING_PERIOD;
        }

        return coverageUntil;
    }

    function _previewUnearned(Account memory account, uint64 timestamp) internal pure returns (uint256) {
        if (account.unearned == 0 || account.periodCharge == 0 || timestamp <= account.lastAccruedAt) {
            return account.unearned;
        }

        uint64 accrueThrough = timestamp < account.paidUntil ? timestamp : account.paidUntil;
        if (accrueThrough == account.paidUntil) return 0;

        uint256 cumulativeEarned =
            uint256(account.periodCharge) * (accrueThrough - account.periodStartedAt) / BILLING_PERIOD;
        uint256 alreadyEarned = uint256(account.periodCharge) - account.unearned;

        if (cumulativeEarned <= alreadyEarned) return account.unearned;
        uint256 wouldEarn = cumulativeEarned - alreadyEarned;
        return wouldEarn > account.unearned ? 0 : account.unearned - wouldEarn;
    }

    function _previewRefund(Account memory account, uint64 timestamp) internal pure returns (uint256) {
        if (!account.active) return uint256(account.balance) + account.unearned;

        uint256 balance = account.balance;
        uint256 unearned = _previewUnearned(account, timestamp);
        uint64 coverageUntil = account.paidUntil;
        uint256 price = planPrice(account.planId);

        while (coverageUntil <= timestamp && price != 0 && balance >= price) {
            balance -= price;
            coverageUntil += BILLING_PERIOD;
            unearned = coverageUntil > timestamp
                ? price - (price * (timestamp - (coverageUntil - BILLING_PERIOD)) / BILLING_PERIOD)
                : 0;
        }

        return balance + unearned;
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
