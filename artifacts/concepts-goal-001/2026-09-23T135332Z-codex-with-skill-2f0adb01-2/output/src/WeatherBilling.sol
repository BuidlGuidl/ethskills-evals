// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Prepaid USDC billing for a weather API subscription.
/// @dev Balances accrue toward the provider only when accounts are settled.
contract WeatherBilling {
    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        uint256 balance;
        uint256 lastSettledAt;
        Plan plan;
        bool active;
    }

    uint256 public constant BILLING_PERIOD = 30 days;
    uint256 public constant HOBBY_PRICE = 5_000_000;
    uint256 public constant PRO_PRICE = 20_000_000;

    IERC20 public immutable usdc;
    address public immutable provider;

    uint256 public providerWithdrawable;
    uint256 private locked = 1;

    mapping(address => Account) private accounts;

    event ToppedUp(address indexed payer, address indexed account, uint256 amount);
    event SubscriptionStarted(address indexed account, Plan indexed plan);
    event PlanChanged(address indexed account, Plan indexed oldPlan, Plan indexed newPlan);
    event Settled(address indexed account, uint256 charged, uint256 remainingBalance, bool active);
    event Cancelled(address indexed account, uint256 refunded);
    event ProviderWithdrawal(address indexed recipient, uint256 amount);

    error AmountZero();
    error InvalidPlan();
    error NoCredit();
    error NotProvider();
    error ReentrantCall();
    error TransferFailed();

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address usdc_, address provider_) {
        require(usdc_ != address(0), "USDC_ZERO");
        require(provider_ != address(0), "PROVIDER_ZERO");
        usdc = IERC20(usdc_);
        provider = provider_;
    }

    function topUp(uint256 amount) external nonReentrant {
        _topUpFor(msg.sender, amount);
    }

    function topUpFor(address account, uint256 amount) external nonReentrant {
        _topUpFor(account, amount);
    }

    function _topUpFor(address account, uint256 amount) private {
        if (amount == 0) revert AmountZero();
        require(account != address(0), "ACCOUNT_ZERO");

        _settle(account, accounts[account]);
        _safeTransferFrom(msg.sender, address(this), amount);
        accounts[account].balance += amount;

        emit ToppedUp(msg.sender, account, amount);
    }

    function startSubscription(Plan plan) external {
        if (!_isPaidPlan(plan)) revert InvalidPlan();

        Account storage account = accounts[msg.sender];
        _settle(msg.sender, account);
        if (account.balance == 0) revert NoCredit();

        Plan oldPlan = account.plan;
        account.plan = plan;
        account.active = true;
        account.lastSettledAt = block.timestamp;

        if (oldPlan == Plan.None) {
            emit SubscriptionStarted(msg.sender, plan);
        } else if (oldPlan != plan) {
            emit PlanChanged(msg.sender, oldPlan, plan);
        }
    }

    function cancel() external nonReentrant {
        Account storage account = accounts[msg.sender];
        _settle(msg.sender, account);

        uint256 refund = account.balance;
        account.balance = 0;
        account.plan = Plan.None;
        account.active = false;
        account.lastSettledAt = block.timestamp;

        if (refund > 0) {
            _safeTransfer(msg.sender, refund);
        }

        emit Cancelled(msg.sender, refund);
    }

    function settle(address accountAddress) external {
        _settle(accountAddress, accounts[accountAddress]);
    }

    function withdrawProviderRevenue(address recipient, uint256 amount) external nonReentrant {
        if (msg.sender != provider) revert NotProvider();
        require(recipient != address(0), "RECIPIENT_ZERO");
        if (amount == 0) revert AmountZero();

        providerWithdrawable -= amount;
        _safeTransfer(recipient, amount);

        emit ProviderWithdrawal(recipient, amount);
    }

    function getAccount(address accountAddress)
        external
        view
        returns (
            uint256 storedBalance,
            uint256 availableBalance,
            uint256 paidUntilTimestamp,
            Plan plan,
            bool active,
            bool subscribed
        )
    {
        Account storage account = accounts[accountAddress];
        storedBalance = account.balance;
        availableBalance = availableBalanceOf(accountAddress);
        paidUntilTimestamp = paidUntil(accountAddress);
        plan = account.plan;
        active = account.active;
        subscribed = isSubscribed(accountAddress);
    }

    function availableBalanceOf(address accountAddress) public view returns (uint256) {
        Account storage account = accounts[accountAddress];
        uint256 accrued = _accrued(account);
        if (accrued >= account.balance) {
            return 0;
        }
        return account.balance - accrued;
    }

    function paidUntil(address accountAddress) public view returns (uint256) {
        Account storage account = accounts[accountAddress];
        uint256 price = priceOf(account.plan);
        if (!account.active || price == 0 || account.balance == 0) {
            return account.lastSettledAt;
        }

        return account.lastSettledAt + (account.balance * BILLING_PERIOD) / price;
    }

    function isSubscribed(address accountAddress) public view returns (bool) {
        Account storage account = accounts[accountAddress];
        return account.active && block.timestamp < paidUntil(accountAddress);
    }

    function priceOf(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_PRICE;
        if (plan == Plan.Pro) return PRO_PRICE;
        return 0;
    }

    function _settle(address accountAddress, Account storage account) private {
        uint256 accrued = _accrued(account);
        if (accrued == 0) {
            return;
        }

        uint256 charged = accrued;
        if (charged >= account.balance) {
            uint256 runOutAt = _runOutAt(account);
            charged = account.balance;
            account.balance = 0;
            account.active = false;
            account.lastSettledAt = runOutAt;
        } else {
            account.balance -= charged;
            account.lastSettledAt = block.timestamp;
        }

        providerWithdrawable += charged;

        emit Settled(accountAddress, charged, account.balance, account.active);
    }

    function _accrued(Account storage account) private view returns (uint256) {
        if (!account.active) {
            return 0;
        }

        uint256 price = priceOf(account.plan);
        if (price == 0 || account.lastSettledAt >= block.timestamp) {
            return 0;
        }

        uint256 elapsed = block.timestamp - account.lastSettledAt;
        return (elapsed * price) / BILLING_PERIOD;
    }

    function _runOutAt(Account storage account) private view returns (uint256) {
        uint256 price = priceOf(account.plan);
        if (price == 0) {
            return account.lastSettledAt;
        }
        return account.lastSettledAt + (account.balance * BILLING_PERIOD) / price;
    }

    function _isPaidPlan(Plan plan) private pure returns (bool) {
        return plan == Plan.Hobby || plan == Plan.Pro;
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool success, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool success, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
