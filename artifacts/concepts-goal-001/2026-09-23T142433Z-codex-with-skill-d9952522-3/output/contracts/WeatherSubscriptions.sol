// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
}

/// @title Weather API prepaid USDC subscriptions
/// @notice Customers deposit USDC, choose a plan, and consume prepaid credit over time.
contract WeatherSubscriptions {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        Plan plan;
        bool active;
        uint256 settledAt;
        uint256 balance;
    }

    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant SECONDS_PER_MONTH = 30 days;
    uint256 public constant HOBBY_MONTHLY_PRICE = 5 * USDC_SCALE;
    uint256 public constant PRO_MONTHLY_PRICE = 20 * USDC_SCALE;

    address public immutable usdc;
    address public owner;
    address public treasury;
    uint256 public totalCustomerBalance;
    uint256 public withdrawableRevenue;
    uint256 private locked = 1;

    mapping(address customer => Account account) private accounts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ToppedUp(address indexed payer, address indexed customer, uint256 amount);
    event PlanSelected(address indexed customer, Plan indexed plan);
    event Settled(address indexed customer, uint256 amountCharged, uint256 remainingBalance);
    event Canceled(address indexed customer, uint256 refunded);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event ExcessTokenRecovered(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPlan();
    error InsufficientCredit(uint256 required, uint256 available);
    error NothingToCancel();
    error NotOwner();
    error TransferFailed();
    error AmountExceedsAvailable(uint256 available);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        require(locked == 1, "REENTRANCY");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address usdc_, address treasury_) {
        if (usdc_ == address(0) || treasury_ == address(0)) revert ZeroAddress();

        usdc = usdc_;
        owner = msg.sender;
        treasury = treasury_;

        emit OwnershipTransferred(address(0), msg.sender);
        emit TreasuryUpdated(address(0), treasury_);
    }

    /// @notice Deposit USDC into the caller's prepaid account.
    function topUp(uint256 amount) external {
        _topUpFor(msg.sender, amount);
    }

    /// @notice Deposit USDC into another customer's prepaid account.
    function topUpFor(address customer, uint256 amount) external {
        _topUpFor(customer, amount);
    }

    /// @notice Start or switch to a plan. The account must have at least one month prepaid.
    function selectPlan(Plan plan) external {
        uint256 monthlyPrice = monthlyPriceOf(plan);
        if (monthlyPrice == 0) revert InvalidPlan();

        Account storage account = accounts[msg.sender];
        _settle(msg.sender);

        if (account.balance < monthlyPrice) {
            revert InsufficientCredit(monthlyPrice, account.balance);
        }

        account.plan = plan;
        account.active = true;
        account.settledAt = block.timestamp;

        emit PlanSelected(msg.sender, plan);
    }

    /// @notice Settle accrued charges for a customer. Anyone can call this.
    function settle(address customer) external returns (uint256 charged) {
        charged = _settle(customer);
    }

    /// @notice Batch version of settle for offchain jobs that want to collect earned revenue.
    function settleMany(address[] calldata customers) external returns (uint256 chargedTotal) {
        for (uint256 i = 0; i < customers.length; i++) {
            chargedTotal += _settle(customers[i]);
        }
    }

    /// @notice Cancel the current plan and return all unused prepaid credit.
    function cancel() external nonReentrant returns (uint256 refund) {
        Account storage account = accounts[msg.sender];
        _settle(msg.sender);

        refund = account.balance;
        if (!account.active && account.plan == Plan.None && refund == 0) revert NothingToCancel();

        if (refund != 0) {
            totalCustomerBalance -= refund;
        }

        delete accounts[msg.sender];

        if (refund != 0) {
            _safeTransfer(usdc, msg.sender, refund);
        }

        emit Canceled(msg.sender, refund);
    }

    /// @notice Withdraw settled revenue to the treasury.
    function withdrawRevenue(uint256 amount) external nonReentrant onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > withdrawableRevenue) revert AmountExceedsAvailable(withdrawableRevenue);

        withdrawableRevenue -= amount;
        _safeTransfer(usdc, treasury, amount);

        emit RevenueWithdrawn(treasury, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address previousTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    /// @notice Recover tokens not reserved for customer balances or settled revenue.
    function recoverExcessToken(address token, address to, uint256 amount) external nonReentrant onlyOwner {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        if (token == usdc) {
            uint256 reserved = totalCustomerBalance + withdrawableRevenue;
            uint256 current = IERC20Like(usdc).balanceOf(address(this));
            uint256 excess = current > reserved ? current - reserved : 0;
            if (amount > excess) revert AmountExceedsAvailable(excess);
        }

        _safeTransfer(token, to, amount);
        emit ExcessTokenRecovered(token, to, amount);
    }

    function accountOf(address customer)
        external
        view
        returns (
            Plan plan,
            bool active,
            uint256 storedBalance,
            uint256 currentBalance,
            uint256 settledAt,
            uint256 paidThrough,
            bool subscribed
        )
    {
        Account memory account = accounts[customer];
        plan = account.plan;
        active = account.active;
        storedBalance = account.balance;
        currentBalance = balanceOf(customer);
        settledAt = account.settledAt;
        paidThrough = paidThroughOf(customer);
        subscribed = _isSubscribed(account);
    }

    function balanceOf(address customer) public view returns (uint256) {
        Account memory account = accounts[customer];
        if (!account.active) return account.balance;

        uint256 accrued = _accrued(account);
        return accrued >= account.balance ? 0 : account.balance - accrued;
    }

    function isSubscribed(address customer) external view returns (bool) {
        return _isSubscribed(accounts[customer]);
    }

    function paidThroughOf(address customer) public view returns (uint256) {
        Account memory account = accounts[customer];
        if (!account.active) return account.settledAt;

        uint256 monthlyPrice = monthlyPriceOf(account.plan);
        if (monthlyPrice == 0) return account.settledAt;

        return uint256(account.settledAt) + (account.balance * SECONDS_PER_MONTH) / monthlyPrice;
    }

    function monthlyPriceOf(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_MONTHLY_PRICE;
        if (plan == Plan.Pro) return PRO_MONTHLY_PRICE;
        return 0;
    }

    function _isSubscribed(Account memory account) private view returns (bool) {
        if (!account.active || account.plan == Plan.None || account.balance == 0) return false;
        return block.timestamp
            < uint256(account.settledAt) + (account.balance * SECONDS_PER_MONTH) / monthlyPriceOf(account.plan);
    }

    function _settle(address customer) private returns (uint256 charged) {
        Account storage account = accounts[customer];
        if (!account.active) return 0;

        uint256 monthlyPrice = monthlyPriceOf(account.plan);
        if (monthlyPrice == 0) return 0;

        uint256 accrued = _accrued(account);
        if (accrued == 0) return 0;

        if (accrued >= account.balance) {
            charged = account.balance;
            uint256 coveredSeconds = (account.balance * SECONDS_PER_MONTH) / monthlyPrice;
            account.balance = 0;
            account.active = false;
            account.settledAt = account.settledAt + coveredSeconds;
        } else {
            charged = accrued;
            account.balance -= charged;
            account.settledAt = block.timestamp;
        }

        if (charged != 0) {
            totalCustomerBalance -= charged;
            withdrawableRevenue += charged;
            emit Settled(customer, charged, account.balance);
        }
    }

    function _accrued(Account memory account) private view returns (uint256) {
        if (!account.active || block.timestamp <= account.settledAt) return 0;
        return ((block.timestamp - account.settledAt) * monthlyPriceOf(account.plan)) / SECONDS_PER_MONTH;
    }

    function _topUpFor(address customer, uint256 amount) private nonReentrant {
        if (customer == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _settle(customer);
        _safeTransferFrom(usdc, msg.sender, address(this), amount);

        accounts[customer].balance += amount;
        totalCustomerBalance += amount;

        emit ToppedUp(msg.sender, customer, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
