// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Prepaid USDC subscriptions for a weather API.
/// @dev Prices assume a 6-decimal USDC-compatible token.
contract WeatherApiBilling {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        Plan plan;
        uint64 paidThrough;
        uint64 lastSettledAt;
        uint256 credit;
        uint256 chargeRemainder;
    }

    struct SubscriptionView {
        Plan plan;
        bool subscribed;
        uint64 paidThrough;
        uint256 unallocatedCredit;
        uint256 refundableNow;
        uint256 earnedSinceLastSettlement;
    }

    uint256 public constant USDC_DECIMALS = 1e6;
    uint256 public constant BILLING_MONTH = 30 days;
    uint256 public constant HOBBY_PRICE = 5 * USDC_DECIMALS;
    uint256 public constant PRO_PRICE = 20 * USDC_DECIMALS;

    IERC20 public immutable usdc;
    address public owner;
    uint256 public providerBalance;

    mapping(address account => Account subscription) private accounts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ToppedUp(address indexed account, uint256 amount, uint64 paidThrough);
    event Subscribed(address indexed account, Plan indexed plan, uint64 paidThrough);
    event Settled(address indexed account, uint256 amount, uint64 settledThrough);
    event Cancelled(address indexed account, uint256 refund);
    event ProviderWithdrawal(address indexed to, uint256 amount);

    error AmountZero();
    error InvalidPlan();
    error NotOwner();
    error TransferFailed();
    error AddressZero();
    error TimestampOverflow();
    error InsufficientProviderBalance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 usdc_, address owner_) {
        if (address(usdc_) == address(0) || owner_ == address(0)) revert AddressZero();
        usdc = usdc_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert AddressZero();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function topUp(uint256 amount) external {
        topUpFor(msg.sender, amount);
    }

    function topUpFor(address account, uint256 amount) public {
        if (account == address(0)) revert AddressZero();
        if (amount == 0) revert AmountZero();

        _safeTransferFrom(msg.sender, address(this), amount);

        Account storage sub = accounts[account];
        _settle(account, sub);
        sub.credit += amount;
        _convertCreditToTime(sub);

        emit ToppedUp(account, amount, sub.paidThrough);
    }

    function subscribe(Plan plan) external {
        if (plan != Plan.Hobby && plan != Plan.Pro) revert InvalidPlan();

        Account storage sub = accounts[msg.sender];
        _settle(msg.sender, sub);

        uint256 remainingValue = _unusedValue(sub, _now());
        if (remainingValue != 0) {
            sub.credit += remainingValue;
        }

        sub.plan = plan;
        sub.paidThrough = _now();
        sub.lastSettledAt = _now();
        sub.chargeRemainder = 0;
        _convertCreditToTime(sub);

        emit Subscribed(msg.sender, plan, sub.paidThrough);
    }

    function cancel() external returns (uint256 refund) {
        Account storage sub = accounts[msg.sender];
        _settle(msg.sender, sub);

        refund = sub.credit + _unusedValue(sub, _now());

        sub.plan = Plan.None;
        sub.paidThrough = 0;
        sub.lastSettledAt = _now();
        sub.credit = 0;
        sub.chargeRemainder = 0;

        if (refund != 0) {
            _safeTransfer(msg.sender, refund);
        }

        emit Cancelled(msg.sender, refund);
    }

    function collect(address account) external returns (uint256 amount) {
        Account storage sub = accounts[account];
        amount = _settle(account, sub);
    }

    function collectMany(address[] calldata accountList) external returns (uint256 amount) {
        for (uint256 i = 0; i < accountList.length; i++) {
            Account storage sub = accounts[accountList[i]];
            amount += _settle(accountList[i], sub);
        }
    }

    function withdrawProviderBalance(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert AddressZero();
        if (amount > providerBalance) revert InsufficientProviderBalance();

        providerBalance -= amount;
        _safeTransfer(to, amount);

        emit ProviderWithdrawal(to, amount);
    }

    function isSubscribed(address account) external view returns (bool) {
        Account storage sub = accounts[account];
        return sub.plan != Plan.None && sub.paidThrough > block.timestamp;
    }

    function subscriptionOf(address account)
        external
        view
        returns (SubscriptionView memory status)
    {
        Account storage sub = accounts[account];
        uint64 currentTime = _now();
        status.plan = sub.plan;
        status.subscribed = sub.plan != Plan.None && sub.paidThrough > currentTime;
        status.paidThrough = sub.paidThrough;
        status.unallocatedCredit = sub.credit;
        status.refundableNow = sub.credit + _unusedValue(sub, currentTime);
        status.earnedSinceLastSettlement = _previewEarned(sub, currentTime);
    }

    function monthlyPrice(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_PRICE;
        if (plan == Plan.Pro) return PRO_PRICE;
        revert InvalidPlan();
    }

    function _settle(address account, Account storage sub) private returns (uint256 amount) {
        uint64 currentTime = _now();
        if (sub.plan == Plan.None || sub.lastSettledAt >= currentTime) return 0;

        uint64 settledThrough = sub.paidThrough < currentTime ? sub.paidThrough : currentTime;
        if (settledThrough <= sub.lastSettledAt) return 0;

        uint256 gross = uint256(settledThrough - sub.lastSettledAt) * monthlyPrice(sub.plan)
            + sub.chargeRemainder;
        amount = gross / BILLING_MONTH;
        sub.chargeRemainder = gross % BILLING_MONTH;
        sub.lastSettledAt = settledThrough;

        if (amount != 0) {
            providerBalance += amount;
            emit Settled(account, amount, settledThrough);
        }
    }

    function _convertCreditToTime(Account storage sub) private {
        if (sub.plan == Plan.None || sub.credit == 0) return;

        uint64 currentTime = _now();
        uint64 start = sub.paidThrough > currentTime ? sub.paidThrough : currentTime;
        if (sub.paidThrough < start) {
            sub.paidThrough = start;
            sub.lastSettledAt = start;
            sub.chargeRemainder = 0;
        }

        uint256 price = monthlyPrice(sub.plan);
        uint256 secondsToAdd = (sub.credit * BILLING_MONTH) / price;
        if (secondsToAdd == 0) return;
        if (secondsToAdd > type(uint64).max - start) revert TimestampOverflow();

        uint256 cost = (secondsToAdd * price) / BILLING_MONTH;
        sub.credit -= cost;
        sub.paidThrough = start + uint64(secondsToAdd);
    }

    function _unusedValue(Account storage sub, uint64 currentTime) private view returns (uint256) {
        if (sub.plan == Plan.None || sub.paidThrough <= currentTime) return 0;
        return (uint256(sub.paidThrough - currentTime) * monthlyPrice(sub.plan)) / BILLING_MONTH;
    }

    function _previewEarned(Account storage sub, uint64 currentTime)
        private
        view
        returns (uint256)
    {
        if (sub.plan == Plan.None || sub.lastSettledAt >= currentTime) return 0;
        uint64 settledThrough = sub.paidThrough < currentTime ? sub.paidThrough : currentTime;
        if (settledThrough <= sub.lastSettledAt) return 0;
        uint256 gross = uint256(settledThrough - sub.lastSettledAt) * monthlyPrice(sub.plan)
            + sub.chargeRemainder;
        return gross / BILLING_MONTH;
    }

    function _now() private view returns (uint64) {
        if (block.timestamp > type(uint64).max) revert TimestampOverflow();
        return uint64(block.timestamp);
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
