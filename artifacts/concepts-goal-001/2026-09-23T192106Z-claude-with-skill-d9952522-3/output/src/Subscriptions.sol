// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {ISubscriptions} from "./ISubscriptions.sol";

/// @title  Prepaid subscriptions billed by the second
/// @notice A customer deposits USDC up front and picks a plan. The plan price is
///         quoted per period ("$5 per 30 days") but the balance is consumed
///         continuously, so at any instant the contract knows exactly how much has
///         been used and how much is still theirs.
///
///         Nothing here is on a schedule. There is no monthly charge transaction to
///         send and nothing to keep running: the charge is arithmetic over
///         `block.timestamp`, evaluated whenever someone reads or writes the account.
///         If every operator, server and keeper for this service vanished, existing
///         subscribers would keep being billed correctly and could still cancel and
///         take their unused balance home.
///
/// @dev    Invariant: token.balanceOf(this) >= totalDeposits + earned.
contract Subscriptions is ISubscriptions, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @param price  Cost of one `period`, in token units (USDC has 6 decimals, so $5 = 5_000_000).
    /// @param period Length of the quoted billing period in seconds.
    /// @param open   Whether new subscribers may select this plan. Never affects existing ones.
    struct Plan {
        uint128 price;
        uint64 period;
        bool open;
    }

    /// @param planId        0 = no subscription.
    /// @param lastSettledAt Timestamp up to which usage has already been moved to `earned`.
    /// @param balance       Prepaid, unspent, still refundable to the account.
    struct Account {
        uint32 planId;
        uint64 lastSettledAt;
        uint128 balance;
    }

    /// @notice The billing token. Immutable: this contract bills in one token forever.
    IERC20 public immutable token;

    /// @notice Plans by id. Id 0 is never a plan; it means "not subscribed".
    mapping(uint32 planId => Plan) public plans;
    uint32 public planCount;

    mapping(address => Account) internal accounts;

    /// @notice Sum of every account's refundable balance. The operator can never touch this.
    uint256 public totalDeposits;

    /// @notice Revenue already consumed by subscribers and withdrawable by the owner.
    uint256 public earned;

    event PlanAdded(uint32 indexed planId, uint128 price, uint64 period);
    event PlanOpenSet(uint32 indexed planId, bool open);
    event Subscribed(address indexed account, uint32 indexed planId, uint64 expiry);
    event ToppedUp(address indexed account, address indexed payer, uint256 amount, uint64 expiry);
    event Settled(address indexed account, uint256 amount, uint64 settledTo);
    event Withdrawn(address indexed account, address indexed to, uint256 amount, uint64 expiry);
    event Canceled(address indexed account, address indexed to, uint256 refund);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event Swept(address indexed token, address indexed to, uint256 amount);

    error NoSuchPlan();
    error PlanClosed();
    error NotSubscribed();
    error NothingToDeposit();
    error InsufficientBalance();
    error ZeroAddress();
    error InvalidPlan();

    constructor(IERC20 token_, address owner_) Ownable(owner_) {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = token_;
    }

    // ---------------------------------------------------------------------
    // Plans
    // ---------------------------------------------------------------------

    /// @notice Create a plan. Price and period are fixed at creation and can never be
    ///         changed, so the owner cannot raise the rate on someone already subscribed.
    ///         A price change means a new plan id, which a subscriber has to opt into.
    function addPlan(uint128 price, uint64 period) external onlyOwner returns (uint32 planId) {
        if (price == 0 || period == 0) revert InvalidPlan();
        planId = ++planCount;
        plans[planId] = Plan({price: price, period: period, open: true});
        emit PlanAdded(planId, price, period);
    }

    /// @notice Open or close a plan to *new* subscriptions. Closing a plan does not
    ///         cancel, reprice or interrupt anyone already on it.
    function setPlanOpen(uint32 planId, bool open) external onlyOwner {
        if (planId == 0 || planId > planCount) revert NoSuchPlan();
        plans[planId].open = open;
        emit PlanOpenSet(planId, open);
    }

    // ---------------------------------------------------------------------
    // Subscriber actions
    // ---------------------------------------------------------------------

    /// @notice Start a subscription, switch plans, or restart a lapsed one, optionally
    ///         depositing `amount` in the same transaction. Usage under the previous plan
    ///         is settled first, so switching mid-period is charged pro rata at each rate.
    /// @dev    Requires an ERC20 approval for `amount` on this contract.
    function subscribe(uint32 planId, uint256 amount) external nonReentrant {
        Plan memory plan = plans[planId];
        if (planId == 0 || planId > planCount) revert NoSuchPlan();
        if (!plan.open) revert PlanClosed();

        Account storage a = accounts[msg.sender];
        _settle(msg.sender, a);
        if (amount > 0) _pull(msg.sender, a, amount);
        if (a.balance == 0) revert NothingToDeposit();

        a.planId = planId;
        uint64 expiry = _expiry(a);
        emit Subscribed(msg.sender, planId, expiry);
        if (amount > 0) emit ToppedUp(msg.sender, msg.sender, amount, expiry);
    }

    /// @notice Add funds to any account's balance. Anyone may top up anyone — useful for
    ///         paying for a teammate, and it means a subscription never depends on one
    ///         person remembering to fund it.
    function topUp(address account, uint256 amount) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert NothingToDeposit();
        Account storage a = accounts[account];
        _settle(account, a);
        _pull(msg.sender, a, amount);
        emit ToppedUp(account, msg.sender, amount, _expiry(a));
    }

    /// @notice Take back part of your unused balance while staying subscribed.
    ///         This shortens your expiry.
    function withdraw(uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        Account storage a = accounts[msg.sender];
        _settle(msg.sender, a);
        if (amount > a.balance) revert InsufficientBalance();

        a.balance -= uint128(amount);
        totalDeposits -= amount;
        token.safeTransfer(to, amount);
        emit Withdrawn(msg.sender, to, amount, _expiry(a));
    }

    /// @notice Cancel and take back everything not yet used, to the second.
    ///         No notice period, no approval from the operator, no end-of-month wait.
    function cancel(address to) external nonReentrant returns (uint256 refund) {
        if (to == address(0)) revert ZeroAddress();
        Account storage a = accounts[msg.sender];
        if (a.planId == 0) revert NotSubscribed();

        _settle(msg.sender, a);
        refund = a.balance;
        a.planId = 0;
        a.balance = 0;

        if (refund > 0) {
            totalDeposits -= refund;
            token.safeTransfer(to, refund);
        }
        emit Canceled(msg.sender, to, refund);
    }

    // ---------------------------------------------------------------------
    // Settlement
    // ---------------------------------------------------------------------

    /// @notice Move consumed balance into withdrawable revenue for these accounts.
    ///         Permissionless, and the operator is the one with a reason to call it.
    ///         It is only ever a bookkeeping move: an account's consumed balance is
    ///         already unwithdrawable by the account, so settling late loses nothing
    ///         and can be batched whenever gas is cheap.
    function collect(address[] calldata accountList) external {
        for (uint256 i = 0; i < accountList.length; ++i) {
            _settle(accountList[i], accounts[accountList[i]]);
        }
    }

    /// @dev Settlement advances `lastSettledAt` by exactly the time the collected amount
    ///      paid for, not to `block.timestamp`. Integer division drops a fraction of a
    ///      second each time; carrying it means a thousand small settlements collect the
    ///      same total as one big one, and an account's expiry does not move when a
    ///      stranger settles it.
    ///
    ///      The exception is an account that has run out: its clock snaps forward to now,
    ///      so a later top-up buys a fresh period instead of silently paying off the
    ///      months it was switched off for.
    function _settle(address account, Account storage a) internal {
        uint64 nowTs = uint64(block.timestamp);
        uint32 planId = a.planId;

        if (planId == 0 || nowTs <= a.lastSettledAt) {
            a.lastSettledAt = nowTs;
            return;
        }

        Plan storage plan = plans[planId];
        uint256 balance = a.balance;
        uint256 due = (uint256(plan.price) * (nowTs - a.lastSettledAt)) / plan.period;

        if (due >= balance) {
            due = balance;
            a.lastSettledAt = nowTs;
        } else {
            a.lastSettledAt = a.lastSettledAt + uint64((due * plan.period) / plan.price);
        }

        if (due > 0) {
            a.balance = uint128(balance - due);
            totalDeposits -= due;
            earned += due;
            emit Settled(account, due, a.lastSettledAt);
        }
    }

    function _pull(address from, Account storage a, uint256 amount) internal {
        if (amount > type(uint128).max - a.balance) revert InsufficientBalance();
        token.safeTransferFrom(from, address(this), amount);
        a.balance += uint128(amount);
        totalDeposits += amount;
    }

    /// @dev Balance consumed since `lastSettledAt`, capped at what the account actually has.
    ///      Capping is what makes running out of money a lapse rather than a debt.
    function _accrued(Account storage a, uint64 nowTs) internal view returns (uint256) {
        if (a.planId == 0 || a.balance == 0 || nowTs <= a.lastSettledAt) return 0;
        Plan storage plan = plans[a.planId];
        uint256 due = (uint256(plan.price) * (nowTs - a.lastSettledAt)) / plan.period;
        return due > a.balance ? a.balance : due;
    }

    /// @dev The whole design in one line: the balance standing at `lastSettledAt` buys
    ///      exactly that much runway, so expiry is a pure function of stored state and
    ///      stays correct forever with nobody sending anything.
    function _expiry(Account storage a) internal view returns (uint64) {
        if (a.planId == 0) return 0;
        Plan storage plan = plans[a.planId];
        uint256 expiry = uint256(a.lastSettledAt) + (uint256(a.balance) * plan.period) / plan.price;
        return expiry > type(uint64).max ? type(uint64).max : uint64(expiry);
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    /// @notice Withdraw settled revenue. Bounded by `earned`, which by construction
    ///         only ever contains balance subscribers have already consumed.
    function withdrawRevenue(address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount > earned) revert InsufficientBalance();
        earned -= amount;
        token.safeTransfer(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    /// @notice Recover tokens that were sent here by mistake. For the billing token this
    ///         is strictly the surplus above subscriber deposits and settled revenue, so
    ///         it cannot reach anyone's balance.
    function sweep(IERC20 stray, address to) external nonReentrant onlyOwner returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        amount = stray.balanceOf(address(this));
        if (stray == token) {
            uint256 spokenFor = totalDeposits + earned;
            amount = amount > spokenFor ? amount - spokenFor : 0;
        }
        if (amount > 0) stray.safeTransfer(to, amount);
        emit Swept(address(stray), to, amount);
    }

    // ---------------------------------------------------------------------
    // Views — what the API backend calls
    // ---------------------------------------------------------------------

    /// @inheritdoc ISubscriptions
    function isSubscribed(address account) public view returns (bool) {
        Account storage a = accounts[account];
        return a.planId != 0 && block.timestamp < _expiry(a);
    }

    /// @inheritdoc ISubscriptions
    function expiryOf(address account) external view returns (uint64) {
        return _expiry(accounts[account]);
    }

    /// @notice Everything the backend needs in one call: whether to serve the request,
    ///         which tier to serve it at, and how long the answer stays valid.
    /// @return active   Serve this request.
    /// @return planId   Tier to serve it at.
    /// @return expiry   Unix seconds at which `active` flips false if nobody tops up.
    /// @return balance  Refundable balance, gross of `owed`.
    /// @return owed     Consumed since last settlement, included in `balance`.
    function statusOf(address account)
        public
        view
        returns (bool active, uint32 planId, uint64 expiry, uint256 balance, uint256 owed)
    {
        Account storage a = accounts[account];
        planId = a.planId;
        balance = a.balance;
        owed = _accrued(a, uint64(block.timestamp));
        expiry = _expiry(a);
        active = planId != 0 && block.timestamp < expiry;
    }

    /// @notice Batched `statusOf` for warming a cache or reconciling a customer list.
    function statusOfMany(address[] calldata accountList)
        external
        view
        returns (bool[] memory active, uint32[] memory planIds, uint64[] memory expiries)
    {
        active = new bool[](accountList.length);
        planIds = new uint32[](accountList.length);
        expiries = new uint64[](accountList.length);
        for (uint256 i = 0; i < accountList.length; ++i) {
            (active[i], planIds[i], expiries[i],,) = statusOf(accountList[i]);
        }
    }

    /// @notice Raw stored account row.
    function accountOf(address account) external view returns (Account memory) {
        return accounts[account];
    }

    /// @notice Revenue consumed but not yet moved into `earned` by `collect`, for these accounts.
    function pendingRevenue(address[] calldata accountList) external view returns (uint256 total) {
        for (uint256 i = 0; i < accountList.length; ++i) {
            total += _accrued(accounts[accountList[i]], uint64(block.timestamp));
        }
    }
}
