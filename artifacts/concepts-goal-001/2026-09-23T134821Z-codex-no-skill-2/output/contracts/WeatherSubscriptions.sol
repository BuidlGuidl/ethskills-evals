// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(token.transfer.selector, to, amount));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, amount));
    }

    function _call(IERC20 token, bytes memory data) private {
        (bool ok, bytes memory result) = address(token).call(data);
        require(ok, "TOKEN_CALL_FAILED");
        require(result.length == 0 || abi.decode(result, (bool)), "TOKEN_OPERATION_FAILED");
    }
}

contract WeatherSubscriptions {
    using SafeERC20 for IERC20;

    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        Plan plan;
        uint64 lastSettledAt;
        uint256 prepaid;
    }

    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant BILLING_PERIOD = 30 days;
    uint256 public constant HOBBY_PRICE = 5 * USDC_SCALE;
    uint256 public constant PRO_PRICE = 20 * USDC_SCALE;

    IERC20 public immutable usdc;
    address public owner;
    uint256 public serviceBalance;

    mapping(address => Account) private accounts;

    uint256 private locked = 1;

    event Deposited(address indexed customer, uint256 amount);
    event Subscribed(address indexed customer, Plan indexed plan);
    event Settled(address indexed customer, uint256 earned, uint256 remainingPrepaid);
    event Canceled(address indexed customer, uint256 refund);
    event ServiceWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier nonReentrant() {
        require(locked == 1, "REENTRANT");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(IERC20 usdc_, address owner_) {
        require(address(usdc_) != address(0), "USDC_REQUIRED");
        require(owner_ != address(0), "OWNER_REQUIRED");

        usdc = usdc_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OWNER_REQUIRED");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function deposit(uint256 amount) external nonReentrant {
        _deposit(msg.sender, amount);
    }

    function depositAndSubscribe(uint256 amount, Plan plan) external nonReentrant {
        _deposit(msg.sender, amount);
        _subscribe(msg.sender, plan);
    }

    function subscribe(Plan plan) external nonReentrant {
        _subscribe(msg.sender, plan);
    }

    function cancel() external nonReentrant returns (uint256 refund) {
        Account storage account = accounts[msg.sender];
        require(account.plan != Plan.None, "NO_SUBSCRIPTION");

        _settle(msg.sender);

        refund = account.prepaid;
        account.plan = Plan.None;
        account.lastSettledAt = uint64(block.timestamp);
        account.prepaid = 0;

        if (refund != 0) {
            usdc.safeTransfer(msg.sender, refund);
        }

        emit Canceled(msg.sender, refund);
    }

    function settleAccount(address customer) external returns (uint256 earned) {
        earned = _settle(customer);
    }

    function settleAccounts(address[] calldata customers) external {
        for (uint256 i = 0; i < customers.length; i++) {
            _settle(customers[i]);
        }
    }

    function withdrawServiceBalance(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "TO_REQUIRED");
        require(amount <= serviceBalance, "INSUFFICIENT_SERVICE_BALANCE");

        serviceBalance -= amount;
        usdc.safeTransfer(to, amount);

        emit ServiceWithdrawn(to, amount);
    }

    function accountOf(address customer)
        external
        view
        returns (Plan plan, uint256 prepaid, uint256 settledThrough, uint256 currentPaidThrough, bool subscribed)
    {
        Account memory account = accounts[customer];
        plan = account.plan;
        prepaid = account.prepaid;
        settledThrough = account.lastSettledAt;
        currentPaidThrough = _paidThrough(account);
        subscribed = _isSubscribed(account);
    }

    function paidThrough(address customer) external view returns (uint256) {
        return _paidThrough(accounts[customer]);
    }

    function isSubscribed(address customer) external view returns (bool) {
        return _isSubscribed(accounts[customer]);
    }

    function planPrice(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_PRICE;
        if (plan == Plan.Pro) return PRO_PRICE;
        return 0;
    }

    function _deposit(address customer, uint256 amount) private {
        require(amount != 0, "ZERO_AMOUNT");

        _settle(customer);

        uint256 beforeBalance = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(customer, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - beforeBalance;
        require(received != 0, "ZERO_RECEIVED");

        accounts[customer].prepaid += received;

        emit Deposited(customer, received);
    }

    function _subscribe(address customer, Plan plan) private {
        require(plan == Plan.Hobby || plan == Plan.Pro, "INVALID_PLAN");

        _settle(customer);

        Account storage account = accounts[customer];
        account.plan = plan;
        account.lastSettledAt = uint64(block.timestamp);

        require(_paidThrough(account) > block.timestamp, "NO_PREPAID_BALANCE");

        emit Subscribed(customer, plan);
    }

    function _settle(address customer) private returns (uint256 earned) {
        Account storage account = accounts[customer];

        if (account.plan == Plan.None || account.lastSettledAt == 0) {
            return 0;
        }

        if (account.prepaid == 0) {
            account.lastSettledAt = uint64(block.timestamp);
            return 0;
        }

        uint256 elapsed = block.timestamp - account.lastSettledAt;
        if (elapsed == 0) {
            return 0;
        }

        uint256 owed = (elapsed * planPrice(account.plan)) / BILLING_PERIOD;
        if (owed >= account.prepaid) {
            earned = account.prepaid;
            account.prepaid = 0;
        } else {
            earned = owed;
            account.prepaid -= owed;
        }

        account.lastSettledAt = uint64(block.timestamp);
        serviceBalance += earned;

        emit Settled(customer, earned, account.prepaid);
    }

    function _paidThrough(Account memory account) private pure returns (uint256) {
        if (account.plan == Plan.None || account.lastSettledAt == 0 || account.prepaid == 0) {
            return account.lastSettledAt;
        }

        return account.lastSettledAt + ((account.prepaid * BILLING_PERIOD) / planPrice(account.plan));
    }

    function _isSubscribed(Account memory account) private view returns (bool) {
        return account.plan != Plan.None && _paidThrough(account) > block.timestamp;
    }
}
