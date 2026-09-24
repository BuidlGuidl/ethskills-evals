// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract WeatherSubscription {
    uint8 public constant PLAN_NONE = 0;
    uint8 public constant PLAN_HOBBY = 1;
    uint8 public constant PLAN_PRO = 2;

    uint256 public constant MONTH = 30 days;
    uint256 public constant HOBBY_MONTHLY_USDC = 5_000_000;
    uint256 public constant PRO_MONTHLY_USDC = 20_000_000;

    IERC20 public immutable usdc;
    address public owner;
    uint256 public providerBalance;

    struct Account {
        uint8 plan;
        bool active;
        uint256 lastAccruedAt;
        uint256 balance;
        uint256 accrualRemainder;
    }

    struct AccountStatus {
        uint8 plan;
        bool active;
        bool subscribed;
        uint256 escrowBalance;
        uint256 pendingCharge;
        uint256 remainingBalance;
        uint256 paidThrough;
    }

    mapping(address customer => Account account) public accounts;

    uint256 private _locked = 1;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ToppedUp(address indexed customer, address indexed payer, uint256 amount);
    event Subscribed(address indexed customer, uint8 indexed plan);
    event Settled(address indexed customer, uint256 charged, uint256 remainingBalance);
    event Cancelled(address indexed customer, uint256 refund);
    event Withdrawn(address indexed to, uint256 amount);

    error AmountZero();
    error InvalidAddress();
    error InvalidPlan();
    error NotOwner();
    error NoCredit();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        require(_locked == 1, "REENTRANT");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(IERC20 usdc_, address owner_) {
        if (address(usdc_) == address(0) || owner_ == address(0)) revert InvalidAddress();
        usdc = usdc_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function topUp(uint256 amount) external nonReentrant {
        _topUp(msg.sender, msg.sender, amount);
    }

    function topUpFor(address customer, uint256 amount) external nonReentrant {
        if (customer == address(0)) revert InvalidAddress();
        _topUp(customer, msg.sender, amount);
    }

    function subscribe(uint8 plan) external {
        _subscribe(msg.sender, plan);
    }

    function topUpAndSubscribe(uint8 plan, uint256 amount) external nonReentrant {
        _topUp(msg.sender, msg.sender, amount);
        _subscribe(msg.sender, plan);
    }

    function settle(address customer) external returns (uint256 charged) {
        charged = _accrue(customer);
    }

    function settleMany(address[] calldata customers) external returns (uint256 totalCharged) {
        for (uint256 i = 0; i < customers.length; i++) {
            totalCharged += _accrue(customers[i]);
        }
    }

    function cancel() external nonReentrant returns (uint256 refund) {
        _accrue(msg.sender);

        Account storage account = accounts[msg.sender];
        refund = account.balance;
        account.balance = 0;
        account.accrualRemainder = 0;
        account.lastAccruedAt = block.timestamp;
        account.active = false;
        account.plan = PLAN_NONE;

        if (refund > 0) {
            _safeTransfer(msg.sender, refund);
        }

        emit Cancelled(msg.sender, refund);
    }

    function withdraw(address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert AmountZero();
        providerBalance -= amount;
        _safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function planPrice(uint8 plan) public pure returns (uint256) {
        uint256 price = _planPriceUnchecked(plan);
        if (price != 0) return price;
        revert InvalidPlan();
    }

    function isSubscribed(address customer) external view returns (bool) {
        return _status(customer).subscribed;
    }

    function accountStatus(address customer) external view returns (AccountStatus memory) {
        return _status(customer);
    }

    function paidThrough(address customer) external view returns (uint256) {
        return _status(customer).paidThrough;
    }

    function _topUp(address customer, address payer, uint256 amount) private {
        if (amount == 0) revert AmountZero();

        _safeTransferFrom(payer, address(this), amount);

        Account storage account = accounts[customer];
        if (account.active) {
            _accrue(customer);
        }

        account.balance += amount;
        emit ToppedUp(customer, payer, amount);
    }

    function _subscribe(address customer, uint8 plan) private {
        planPrice(plan);

        Account storage account = accounts[customer];
        if (account.active) {
            _accrue(customer);
        }
        if (account.balance == 0) revert NoCredit();

        account.plan = plan;
        account.active = true;
        account.lastAccruedAt = block.timestamp;
        account.accrualRemainder = 0;

        emit Subscribed(customer, plan);
    }

    function _accrue(address customer) private returns (uint256 charged) {
        Account storage account = accounts[customer];
        if (!account.active || account.balance == 0 || account.plan == PLAN_NONE) {
            return 0;
        }

        uint256 elapsed = block.timestamp - account.lastAccruedAt;
        if (elapsed == 0) {
            return 0;
        }

        uint256 monthlyPrice = _planPriceUnchecked(account.plan);
        if (monthlyPrice == 0) {
            return 0;
        }
        uint256 numerator = elapsed * monthlyPrice + account.accrualRemainder;
        charged = numerator / MONTH;
        uint256 newRemainder = numerator % MONTH;

        if (charged >= account.balance) {
            charged = account.balance;
            account.balance = 0;
            account.accrualRemainder = 0;
            account.active = false;
            account.plan = PLAN_NONE;
        } else {
            account.balance -= charged;
            account.accrualRemainder = newRemainder;
        }

        account.lastAccruedAt = block.timestamp;
        providerBalance += charged;

        emit Settled(customer, charged, account.balance);
    }

    function _status(address customer) private view returns (AccountStatus memory status) {
        Account storage account = accounts[customer];
        status.plan = account.plan;
        status.active = account.active;
        status.escrowBalance = account.balance;
        status.remainingBalance = account.balance;

        if (!account.active || account.balance == 0 || account.plan == PLAN_NONE) {
            return status;
        }

        uint256 monthlyPrice = _planPriceUnchecked(account.plan);
        if (monthlyPrice == 0) {
            return status;
        }
        uint256 elapsed = block.timestamp - account.lastAccruedAt;
        uint256 numerator = elapsed * monthlyPrice + account.accrualRemainder;
        status.pendingCharge = numerator / MONTH;

        if (status.pendingCharge >= account.balance) {
            status.remainingBalance = 0;
            status.subscribed = false;
            status.paidThrough = _paidThrough(account.lastAccruedAt, account.balance, monthlyPrice, account.accrualRemainder);
        } else {
            status.remainingBalance = account.balance - status.pendingCharge;
            status.subscribed = true;
            status.paidThrough = _paidThrough(account.lastAccruedAt, account.balance, monthlyPrice, account.accrualRemainder);
        }
    }

    function _paidThrough(
        uint256 lastAccruedAt,
        uint256 balance,
        uint256 monthlyPrice,
        uint256 accrualRemainder
    ) private pure returns (uint256) {
        if (balance == 0) return lastAccruedAt;

        uint256 prepaidNumerator = balance * MONTH;
        if (prepaidNumerator <= accrualRemainder) return lastAccruedAt;

        return lastAccruedAt + _ceilDiv(prepaidNumerator - accrualRemainder, monthlyPrice);
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : ((a - 1) / b) + 1;
    }

    function _planPriceUnchecked(uint8 plan) private pure returns (uint256) {
        if (plan == PLAN_HOBBY) return HOBBY_MONTHLY_USDC;
        if (plan == PLAN_PRO) return PRO_MONTHLY_USDC;
        return 0;
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
