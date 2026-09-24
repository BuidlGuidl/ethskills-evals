// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PrepaidSubscriptions {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        Plan plan;
        uint128 balance;
        uint64 lastChargedAt;
    }

    uint256 public constant MONTH = 30 days;
    uint256 public constant HOBBY_PRICE = 5_000_000;
    uint256 public constant PRO_PRICE = 20_000_000;

    IERC20 public immutable usdc;
    address public owner;
    uint256 public merchantAccrued;

    mapping(address => Account) private accounts;

    bool private locked;

    event Deposited(address indexed account, address indexed payer, uint256 amount);
    event Subscribed(address indexed account, Plan indexed plan);
    event PlanChanged(address indexed account, Plan indexed oldPlan, Plan indexed newPlan);
    event Settled(address indexed account, Plan indexed plan, uint256 charged, uint256 remainingBalance);
    event SubscriptionLapsed(address indexed account, Plan indexed plan);
    event Cancelled(address indexed account, uint256 refund);
    event MerchantWithdrawal(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error AmountZero();
    error BadOwner();
    error BadPlan();
    error BadToken();
    error InsufficientPrepaidBalance(uint256 required, uint256 available);
    error NotOwner();
    error Reentrancy();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    constructor(address usdc_, address owner_) {
        if (usdc_ == address(0)) revert BadToken();
        if (owner_ == address(0)) revert BadOwner();

        usdc = IERC20(usdc_);
        owner = owner_;

        emit OwnershipTransferred(address(0), owner_);
    }

    function deposit(uint256 amount) external {
        depositFor(msg.sender, amount);
    }

    function depositFor(address account, uint256 amount) public nonReentrant {
        if (account == address(0)) revert BadOwner();
        if (amount == 0) revert AmountZero();

        _settle(account);
        _safeTransferFrom(msg.sender, address(this), amount);

        Account storage user = accounts[account];
        user.balance = _toUint128(uint256(user.balance) + amount);

        emit Deposited(account, msg.sender, amount);
    }

    function subscribe(Plan plan) external {
        if (plan != Plan.Hobby && plan != Plan.Pro) revert BadPlan();

        _settle(msg.sender);

        Account storage user = accounts[msg.sender];
        uint256 price = monthlyPrice(plan);
        if (user.balance < price) {
            revert InsufficientPrepaidBalance(price, user.balance);
        }

        Plan oldPlan = user.plan;
        user.plan = plan;
        user.lastChargedAt = uint64(block.timestamp);

        if (oldPlan == Plan.None) {
            emit Subscribed(msg.sender, plan);
        } else if (oldPlan != plan) {
            emit PlanChanged(msg.sender, oldPlan, plan);
        }
    }

    function settle(address account) external {
        _settle(account);
    }

    function settleBatch(address[] calldata accountList) external {
        for (uint256 i = 0; i < accountList.length; i++) {
            _settle(accountList[i]);
        }
    }

    function cancel() external nonReentrant {
        _settle(msg.sender);

        Account storage user = accounts[msg.sender];
        uint256 refund = user.balance;

        user.plan = Plan.None;
        user.balance = 0;
        user.lastChargedAt = 0;

        if (refund != 0) {
            _safeTransfer(msg.sender, refund);
        }

        emit Cancelled(msg.sender, refund);
    }

    function withdrawMerchantRevenue(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert BadOwner();
        if (amount == 0) revert AmountZero();
        if (amount > merchantAccrued) revert InsufficientPrepaidBalance(amount, merchantAccrued);

        merchantAccrued -= amount;
        _safeTransfer(to, amount);

        emit MerchantWithdrawal(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert BadOwner();

        address oldOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function isSubscribed(address account) external view returns (bool) {
        (bool active,,,,,) = accountStatus(account);
        return active;
    }

    function accountStatus(address account)
        public
        view
        returns (
            bool active,
            Plan plan,
            uint256 prepaidBalance,
            uint256 accruedCharge,
            uint256 availableBalance,
            uint256 creditUntil
        )
    {
        Account memory user = accounts[account];
        plan = user.plan;
        prepaidBalance = user.balance;

        if (plan == Plan.None) {
            return (false, plan, prepaidBalance, 0, prepaidBalance, 0);
        }

        uint256 elapsed = block.timestamp - user.lastChargedAt;
        uint256 rawAccrued = (elapsed * monthlyPrice(plan)) / MONTH;
        accruedCharge = rawAccrued > prepaidBalance ? prepaidBalance : rawAccrued;
        availableBalance = prepaidBalance - accruedCharge;
        active = availableBalance > 0;
        creditUntil = user.lastChargedAt + ((prepaidBalance * MONTH) / monthlyPrice(plan));
    }

    function accountOf(address account) external view returns (Plan plan, uint256 balance, uint256 lastChargedAt) {
        Account memory user = accounts[account];
        return (user.plan, user.balance, user.lastChargedAt);
    }

    function monthlyPrice(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_PRICE;
        if (plan == Plan.Pro) return PRO_PRICE;
        revert BadPlan();
    }

    function _settle(address account) private {
        Account storage user = accounts[account];
        if (user.plan == Plan.None) return;

        Plan plan = user.plan;
        uint256 elapsed = block.timestamp - user.lastChargedAt;
        if (elapsed == 0) return;

        uint256 rawCharge = (elapsed * monthlyPrice(plan)) / MONTH;
        if (rawCharge == 0) return;

        uint256 charge = rawCharge > user.balance ? user.balance : rawCharge;
        user.balance = uint128(uint256(user.balance) - charge);
        merchantAccrued += charge;

        if (user.balance == 0 && rawCharge >= charge) {
            user.plan = Plan.None;
            user.lastChargedAt = 0;
            emit Settled(account, plan, charge, 0);
            emit SubscriptionLapsed(account, plan);
            return;
        }

        user.lastChargedAt = uint64(block.timestamp);
        emit Settled(account, plan, charge, user.balance);
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _toUint128(uint256 value) private pure returns (uint128) {
        if (value > type(uint128).max) revert InsufficientPrepaidBalance(type(uint128).max, value);
        return uint128(value);
    }
}

