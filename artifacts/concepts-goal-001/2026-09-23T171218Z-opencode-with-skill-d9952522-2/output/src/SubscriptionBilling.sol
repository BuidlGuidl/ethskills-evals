// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface. USDC on every major chain returns bool, so the
///         return value is checked. This contract is USDC-only by construction.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SubscriptionBilling
/// @notice Prepaid USDC subscription billing. Customers top up a balance, pick a plan,
///         and are charged continuously at the plan's monthly rate. There is no scheduled
///         job anywhere: fees accrue from timestamps and are settled lazily whenever the
///         customer (or anyone) next touches the account. The backend checks access with
///         a free eth_call to `isSubscribed`.
///
///         Operator powers are deliberately minimal: the owner can withdraw fees that
///         have already accrued and transfer ownership. The owner cannot touch customer
///         balances, cannot pause, cannot upgrade, cannot change prices.
contract SubscriptionBilling {
    IERC20 public immutable usdc;
    address public owner;

    /// @notice Billing period the plan prices are quoted against.
    uint256 public constant PERIOD = 30 days;
    /// @notice Plan prices per PERIOD, in USDC's 6 decimals.
    uint256 public constant HOBBY_PRICE = 5e6; // $5 / 30 days
    uint256 public constant PRO_PRICE = 20e6; //  $20 / 30 days

    enum Plan {
        None,
        Hobby,
        Pro
    }

    struct Account {
        Plan plan;
        uint256 balance; // prepaid USDC not yet consumed by fees
        uint256 lastSettled; // timestamp up to which fees have been charged
    }

    mapping(address => Account) public accounts;

    /// @notice Fees already charged to customers, withdrawable by the owner via `collect`.
    uint256 public accruedFees;

    event Deposited(address indexed account, uint256 amount);
    event Subscribed(address indexed account, Plan plan);
    event Cancelled(address indexed account, uint256 refunded);
    event Withdrawn(address indexed account, uint256 amount);
    event Collected(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error InvalidPlan();
    error BalanceBelowPlanPrice();
    error AmountExceedsBalance();
    error AmountExceedsAccrued();
    error TransferFailed();
    error ZeroAddress();

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        owner = msg.sender;
    }

    /// @notice Price per PERIOD for a plan.
    function priceOf(Plan plan) public pure returns (uint256) {
        if (plan == Plan.Hobby) return HOBBY_PRICE;
        if (plan == Plan.Pro) return PRO_PRICE;
        return 0;
    }

    /// @notice Top up the caller's prepaid balance. Requires a USDC allowance.
    function deposit(uint256 amount) external {
        _settle(msg.sender);
        accounts[msg.sender].balance += amount;
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Deposited(msg.sender, amount);
    }

    /// @notice Activate (or switch to) a plan. Charging starts from this moment.
    ///         Requires at least one full period prepaid, so a subscription never
    ///         starts already lapsed.
    function subscribe(Plan plan) external {
        if (plan == Plan.None) revert InvalidPlan();
        _settle(msg.sender);
        if (accounts[msg.sender].balance < priceOf(plan)) revert BalanceBelowPlanPrice();
        accounts[msg.sender].plan = plan;
        emit Subscribed(msg.sender, plan);
    }

    /// @notice Cancel the subscription and refund everything not yet consumed.
    function cancel() external {
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        a.plan = Plan.None;
        uint256 refund = a.balance;
        a.balance = 0;
        if (refund > 0 && !usdc.transfer(msg.sender, refund)) revert TransferFailed();
        emit Cancelled(msg.sender, refund);
    }

    /// @notice Withdraw part of the unused balance without cancelling. If the balance
    ///         is drained to zero the subscription lapses.
    function withdraw(uint256 amount) external {
        _settle(msg.sender);
        Account storage a = accounts[msg.sender];
        if (amount > a.balance) revert AmountExceedsBalance();
        a.balance -= amount;
        if (a.balance == 0) a.plan = Plan.None;
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice The per-request check for the backend. Free to call (eth_call), no gas.
    ///         True while the account has a plan and its balance still covers the fees
    ///         accrued up to this second.
    function isSubscribed(address account) public view returns (bool) {
        Account memory a = accounts[account];
        if (a.plan == Plan.None) return false;
        return a.balance >= _owed(a);
    }

    /// @notice Seconds until the account's balance is exhausted at its current plan's
    ///         rate. 0 if not currently subscribed. Useful for "top up soon" warnings.
    function timeUntilLapse(address account) external view returns (uint256) {
        Account memory a = accounts[account];
        if (a.plan == Plan.None) return 0;
        uint256 owed = _owed(a);
        if (a.balance <= owed) return 0;
        return (a.balance - owed) * PERIOD / priceOf(a.plan);
    }

    /// @notice Withdraw accrued fees. This is the owner's revenue; collecting it is the
    ///         only maintenance the system ever needs, and the owner is paid to do it.
    function collect(uint256 amount, address to) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount > accruedFees) revert AmountExceedsAccrued();
        accruedFees -= amount;
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit Collected(to, amount);
    }

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert NotOwner();
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @dev Charge fees accrued since lastSettled. If the balance can't cover them, the
    ///      customer is charged only what remains (never driven into debt) and the
    ///      subscription lapses. A lapsed account accrues nothing further, so topping
    ///      up later is safe — no back-debt is ever sprung on a returning customer.
    function _settle(address account) internal {
        Account storage a = accounts[account];
        if (a.plan != Plan.None) {
            uint256 owed = _owed(a);
            if (owed <= a.balance) {
                a.balance -= owed;
                accruedFees += owed;
            } else {
                accruedFees += a.balance;
                a.balance = 0;
                a.plan = Plan.None;
            }
        }
        a.lastSettled = block.timestamp;
    }

    function _owed(Account memory a) internal view returns (uint256) {
        // Rounds down, fractionally in the customer's favour. Dust-level, by design.
        return priceOf(a.plan) * (block.timestamp - a.lastSettled) / PERIOD;
    }
}
