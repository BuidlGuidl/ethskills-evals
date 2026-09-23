// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract WeatherSubscriptionBilling {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        uint128 credit;
        uint128 unearned;
        uint40 lastSettled;
        uint40 paidThrough;
        Plan plan;
    }

    uint256 public constant BILLING_PERIOD = 30 days;
    uint256 public constant HOBBY_PRICE = 5_000_000;
    uint256 public constant PRO_PRICE = 20_000_000;

    IERC20 public immutable usdc;
    address public owner;
    address public treasury;
    uint256 public withdrawableRevenue;

    mapping(address => Account) public accounts;

    event ToppedUp(address indexed payer, address indexed customer, uint256 amount);
    event Subscribed(address indexed customer, Plan indexed plan, uint256 paidThrough);
    event PlanChanged(address indexed customer, Plan indexed oldPlan, Plan indexed newPlan, uint256 paidThrough);
    event Settled(address indexed customer, bool active, uint256 paidThrough);
    event Canceled(address indexed customer, uint256 refund);
    event CreditWithdrawn(address indexed customer, uint256 amount);
    event RevenueWithdrawn(address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error AmountZero();
    error BadPlan();
    error InsufficientCredit(uint256 available, uint256 required);
    error NotOwner();
    error TransferFailed();
    error BadAddress();

    constructor(address usdc_, address treasury_) {
        if (usdc_ == address(0) || treasury_ == address(0)) revert BadAddress();
        usdc = IERC20(usdc_);
        owner = msg.sender;
        treasury = treasury_;

        emit OwnershipTransferred(address(0), msg.sender);
        emit TreasuryUpdated(address(0), treasury_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function topUp(uint256 amount) external {
        topUpFor(msg.sender, amount);
    }

    function topUpFor(address customer, uint256 amount) public {
        if (customer == address(0)) revert BadAddress();
        if (amount == 0) revert AmountZero();
        _safeTransferFrom(msg.sender, address(this), amount);
        _addCredit(customer, amount);
        emit ToppedUp(msg.sender, customer, amount);
    }

    function topUpAndSubscribe(Plan plan, uint256 amount) external {
        topUpFor(msg.sender, amount);
        subscribe(plan);
    }

    function subscribe(Plan plan) public {
        _validatePlan(plan);
        Account storage account = accounts[msg.sender];
        Plan oldPlan = account.plan;

        _settle(msg.sender);

        if (account.unearned > 0) {
            account.credit += account.unearned;
            account.unearned = 0;
        }

        uint256 price = planPrice(plan);
        if (account.credit < price) revert InsufficientCredit(account.credit, price);

        account.credit -= uint128(price);
        account.unearned = uint128(price);
        account.lastSettled = uint40(block.timestamp);
        account.paidThrough = uint40(block.timestamp + BILLING_PERIOD);
        account.plan = plan;

        if (oldPlan == Plan.None) {
            emit Subscribed(msg.sender, plan, account.paidThrough);
        } else {
            emit PlanChanged(msg.sender, oldPlan, plan, account.paidThrough);
        }
    }

    function cancel() external {
        _settle(msg.sender);

        Account storage account = accounts[msg.sender];
        uint256 refund = uint256(account.credit) + uint256(account.unearned);
        delete accounts[msg.sender];

        if (refund > 0) {
            _safeTransfer(msg.sender, refund);
        }

        emit Canceled(msg.sender, refund);
    }

    function withdrawCredit(uint256 amount) external {
        if (amount == 0) revert AmountZero();
        _settle(msg.sender);

        Account storage account = accounts[msg.sender];
        if (account.credit < amount) revert InsufficientCredit(account.credit, amount);
        account.credit -= uint128(amount);
        _safeTransfer(msg.sender, amount);

        emit CreditWithdrawn(msg.sender, amount);
    }

    function settle(address customer) external returns (bool active) {
        active = _settle(customer);
        emit Settled(customer, active, accounts[customer].paidThrough);
    }

    function isSubscribed(address customer) external view returns (bool active) {
        (active,,,,) = subscriptionStatus(customer);
    }

    function subscriptionStatus(address customer)
        public
        view
        returns (bool active, Plan plan, uint256 refundable, uint256 credit, uint256 activeUntil)
    {
        Account memory account = accounts[customer];
        plan = account.plan;
        (active, refundable, credit, activeUntil) = _preview(account, block.timestamp);
    }

    function planPrice(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_PRICE;
        if (plan == Plan.Pro) return PRO_PRICE;
        revert BadPlan();
    }

    function withdrawRevenue(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountZero();
        if (withdrawableRevenue < amount) revert InsufficientCredit(withdrawableRevenue, amount);

        withdrawableRevenue -= amount;
        _safeTransfer(treasury, amount);
        emit RevenueWithdrawn(treasury, amount);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert BadAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert BadAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function _settle(address customer) internal returns (bool active) {
        Account storage account = accounts[customer];
        if (account.plan == Plan.None) return false;

        uint256 price = planPrice(account.plan);
        uint256 timestamp = block.timestamp;

        _earnCurrentPeriod(account, price, timestamp);
        if (timestamp < account.paidThrough) return true;

        uint256 fullPeriods = (timestamp - account.paidThrough) / BILLING_PERIOD;
        uint256 affordablePeriods = uint256(account.credit) / price;
        uint256 periodsToSettle = fullPeriods < affordablePeriods ? fullPeriods : affordablePeriods;

        if (periodsToSettle > 0) {
            uint256 charged = periodsToSettle * price;
            account.credit -= uint128(charged);
            withdrawableRevenue += charged;
            account.lastSettled = uint40(uint256(account.lastSettled) + periodsToSettle * BILLING_PERIOD);
            account.paidThrough = uint40(uint256(account.paidThrough) + periodsToSettle * BILLING_PERIOD);
        }

        if (timestamp < account.paidThrough) return true;

        if (account.credit < price) {
            account.plan = Plan.None;
            account.unearned = 0;
            account.lastSettled = account.paidThrough;
            return false;
        }

        account.credit -= uint128(price);
        account.unearned = uint128(price);
        account.lastSettled = account.paidThrough;
        account.paidThrough = uint40(uint256(account.paidThrough) + BILLING_PERIOD);

        _earnCurrentPeriod(account, price, timestamp);
        return true;
    }

    function _earnCurrentPeriod(Account storage account, uint256 price, uint256 timestamp) internal {
        uint256 cappedTimestamp = timestamp < account.paidThrough ? timestamp : account.paidThrough;
        if (cappedTimestamp <= account.lastSettled) return;

        uint256 earned;
        if (cappedTimestamp == account.paidThrough) {
            earned = account.unearned;
        } else {
            earned = (price * (cappedTimestamp - account.lastSettled)) / BILLING_PERIOD;
            if (earned > account.unearned) earned = account.unearned;
        }

        account.unearned -= uint128(earned);
        account.lastSettled = uint40(cappedTimestamp);
        withdrawableRevenue += earned;
    }

    function _preview(Account memory account, uint256 timestamp)
        internal
        pure
        returns (bool active, uint256 refundable, uint256 credit, uint256 activeUntil)
    {
        credit = account.credit;
        activeUntil = account.paidThrough;

        if (account.plan == Plan.None) {
            return (false, credit, credit, activeUntil);
        }

        uint256 price = planPrice(account.plan);

        if (timestamp < account.paidThrough) {
            uint256 earned;
            if (timestamp > account.lastSettled) {
                earned = (price * (timestamp - account.lastSettled)) / BILLING_PERIOD;
                if (earned > account.unearned) earned = account.unearned;
            }
            refundable = credit + uint256(account.unearned) - earned;
            return (true, refundable, credit, activeUntil);
        }

        uint256 fullPeriods = (timestamp - account.paidThrough) / BILLING_PERIOD;
        uint256 affordablePeriods = credit / price;

        if (affordablePeriods < fullPeriods) {
            uint256 charged = affordablePeriods * price;
            credit -= charged;
            activeUntil = uint256(account.paidThrough) + affordablePeriods * BILLING_PERIOD;
            return (false, credit, credit, activeUntil);
        }

        credit -= fullPeriods * price;
        uint256 nextPeriodStart = uint256(account.paidThrough) + fullPeriods * BILLING_PERIOD;

        if (credit < price) {
            return (false, credit, credit, nextPeriodStart);
        }

        credit -= price;
        uint256 elapsed = timestamp - nextPeriodStart;
        uint256 earnedInCurrent = (price * elapsed) / BILLING_PERIOD;
        refundable = credit + price - earnedInCurrent;
        activeUntil = nextPeriodStart + BILLING_PERIOD;

        return (true, refundable, credit, activeUntil);
    }

    function _validatePlan(Plan plan) internal pure {
        if (plan == Plan.None) revert BadPlan();
        planPrice(plan);
    }

    function _addCredit(address customer, uint256 amount) internal {
        if (amount > type(uint128).max) revert AmountZero();
        Account storage account = accounts[customer];
        uint256 nextCredit = uint256(account.credit) + amount;
        if (nextCredit > type(uint128).max) revert AmountZero();
        account.credit = uint128(nextCredit);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool success, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
