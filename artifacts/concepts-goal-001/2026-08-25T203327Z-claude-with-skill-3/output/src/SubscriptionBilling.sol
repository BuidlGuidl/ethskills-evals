// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, self-metering subscriptions denominated in an ERC-20 stablecoin (USDC).
///
/// @dev Design note, and the whole point of this contract:
///
///      A contract has no clock and no cron. "Charge every subscriber on the 1st of the month"
///      would be a transaction that somebody has to send, for every subscriber, forever, paying
///      gas each time. If that somebody is the operator, billing stops the day the operator's
///      key or server goes away; if it is a paid keeper, the fee for pushing a $5 charge eats the
///      charge. So nothing is pushed here.
///
///      Instead the charge *accrues from a timestamp* and is only ever computed when someone
///      already has a reason to touch the contract:
///
///        - the subscriber tops up, switches plan, cancels or withdraws;
///        - the operator sweeps revenue they are owed (`settleMany`, permissionless);
///        - anyone calls the `view` functions, which apply accrual in memory and cost no gas.
///
///      Between those moments the state is stale and that is fine, because every read applies
///      accrual before answering. `isSubscribed` goes false on its own at the exact second the
///      prepaid balance runs out, with no transaction from anyone.
///
///      The plan price is quoted per 30-day period but drains per second, which is what makes
///      "cancel any time, get back what you have not used" exact to the second rather than
///      rounded to a whole month.
contract SubscriptionBilling {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice A billing "month". Prices are quoted per PERIOD and accrue linearly across it.
    uint256 public constant PERIOD = 30 days;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    struct Plan {
        /// @dev Price per PERIOD, in token units (6 decimals for USDC, so 5_000_000 == $5).
        ///      Immutable once created: see `createPlan`.
        uint128 pricePerPeriod;
        /// @dev Whether new subscribers may pick this plan. Existing subscribers are unaffected.
        bool open;
        bool exists;
    }

    struct Account {
        /// @dev Prepaid balance not yet consumed at the last settlement. Always withdrawable.
        uint128 balance;
        /// @dev Timestamp accrual was last applied. Accrual since then is owed but unbooked.
        uint64 lastSettled;
        /// @dev 0 means "not subscribed". Plan ids start at 1.
        uint32 planId;
    }

    /// @notice The billing token. USDC on the target chain. Immutable: a fresh deployment is the
    ///         only way to change it, which is deliberate — subscribers' balances are denominated
    ///         in it and the operator should not be able to redenominate them.
    IERC20 public immutable token;

    address public owner;
    address public pendingOwner;

    mapping(address account => Account) private _accounts;
    mapping(uint32 planId => Plan) private _plans;
    uint32 public planCount;

    /// @notice Sum of all subscriber balances. Operator funds are never part of this.
    uint256 public totalPrepaid;
    /// @notice Consumed subscription time already booked to the operator and withdrawable.
    uint256 public accruedRevenue;

    /// @dev Everyone with a plan selected, so the operator can settle revenue without running an
    ///      indexer. Entries are added on subscribe and removed on cancel.
    EnumerableSet.AddressSet private _subscribers;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PlanCreated(uint32 indexed planId, uint128 pricePerPeriod, bool open);
    event PlanOpenSet(uint32 indexed planId, bool open);
    event Deposited(address indexed account, uint256 amount, uint256 balance, uint256 expiresAt);
    event Withdrawn(address indexed account, address indexed to, uint256 amount, uint256 balance, uint256 expiresAt);
    event Subscribed(address indexed account, uint32 indexed planId, uint32 previousPlanId, uint256 expiresAt);
    event Canceled(address indexed account, uint32 indexed planId, uint256 refundable);
    event Settled(address indexed account, uint32 indexed planId, uint256 amount);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event StraySwept(address indexed erc20, address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroPrice();
    error NoSuchPlan();
    error PlanClosed();
    error AlreadyOnPlan();
    error NotSubscribed();
    error InsufficientPrepaid(uint256 have, uint256 need);
    error InsufficientBalance(uint256 have, uint256 want);
    error BalanceOverflow();
    error NothingToSweep();

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param token_ ERC-20 used for billing. Must be a plain, non-rebasing, non-fee-on-transfer
    ///               token with no transfer callbacks — USDC is the intended one. Accounting
    ///               assumes `transferFrom(x)` credits exactly `x`.
    /// @param owner_ Operator address. See `withdrawRevenue` for the only power it has over money.
    /// @param prices Initial plan prices per PERIOD, in token units. Plan ids are assigned in order
    ///               starting at 1, so passing [5e6, 20e6] gives plan 1 = $5/mo, plan 2 = $20/mo.
    constructor(IERC20 token_, address owner_, uint128[] memory prices) {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = token_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
        for (uint256 i = 0; i < prices.length; i++) {
            _createPlan(prices[i], true);
        }
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    /*//////////////////////////////////////////////////////////////
                          READS — THE API GATE
    //////////////////////////////////////////////////////////////*/

    /// @notice The one call a backend needs per request: is this address paid up right now?
    /// @dev Pure `view`, so it costs nothing and needs no transaction. Flips to false on its own
    ///      the second the prepaid balance is exhausted — no renewal transaction exists.
    function isSubscribed(address account) external view returns (bool) {
        return block.timestamp < expiresAt(account);
    }

    /// @notice The timestamp this account's prepaid balance runs out at the current plan rate.
    ///         0 if they hold no plan. A past value means they have already lapsed.
    function expiresAt(address account) public view returns (uint256) {
        Account memory a = _accounts[account];
        if (a.planId == 0) return 0;
        uint256 price = _plans[a.planId].pricePerPeriod;
        return uint256(a.lastSettled) + (uint256(a.balance) * PERIOD) / price;
    }

    /// @notice Amount consumed since the last settlement but not yet booked to the operator.
    ///         Capped at the account balance: a subscriber can never go into debt.
    function pendingCharge(address account) public view returns (uint256) {
        return _pendingCharge(_accounts[account]);
    }

    /// @notice What this account would get back if it cancelled and withdrew right now.
    function refundable(address account) public view returns (uint256) {
        Account memory a = _accounts[account];
        return a.balance - _pendingCharge(a);
    }

    /// @notice Everything a frontend or backend needs about one account, accrual already applied.
    /// @return planId 0 if unsubscribed.
    /// @return balance_ Prepaid balance net of accrual so far — the refundable amount.
    /// @return expiresAt_ Lapse timestamp; compare against `block.timestamp`.
    /// @return subscribed Convenience flag, same as `isSubscribed`.
    function accountOf(address account)
        external
        view
        returns (uint32 planId, uint256 balance_, uint256 expiresAt_, bool subscribed)
    {
        Account memory a = _accounts[account];
        planId = a.planId;
        balance_ = a.balance - _pendingCharge(a);
        expiresAt_ = expiresAt(account);
        subscribed = block.timestamp < expiresAt_;
    }

    /// @notice Revenue the operator could withdraw if every subscriber were settled first.
    /// @dev Loops over every subscriber. Fine as an `eth_call` into the thousands; past that, page
    ///      with `subscribers()` and sum `pendingCharge` offchain instead.
    function claimableRevenue() external view returns (uint256) {
        uint256 total = accruedRevenue;
        uint256 n = _subscribers.length();
        for (uint256 i = 0; i < n; i++) {
            total += _pendingCharge(_accounts[_subscribers.at(i)]);
        }
        return total;
    }

    function plan(uint32 planId) external view returns (Plan memory) {
        return _plans[planId];
    }

    function subscriberCount() external view returns (uint256) {
        return _subscribers.length();
    }

    /// @notice Page through subscribers. Lets the operator settle revenue from onchain state alone,
    ///         with no indexer in the loop.
    function subscribers(uint256 start, uint256 count) external view returns (address[] memory page) {
        uint256 n = _subscribers.length();
        if (start >= n) return new address[](0);
        uint256 end = start + count;
        if (end > n) end = n;
        page = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            page[i - start] = _subscribers.at(i);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          SUBSCRIBER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Top up prepaid balance. Requires an ERC-20 approval for `amount` first.
    /// @dev Anyone may top up any account, so a company can fund an employee's key.
    function deposit(address account, uint256 amount) public {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        Account memory a = _settle(account);

        if (uint256(a.balance) + amount > type(uint128).max) revert BalanceOverflow();
        // safe: `amount` was just bounded against type(uint128).max above
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance += uint128(amount);
        _accounts[account].balance = a.balance;
        totalPrepaid += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(account, amount, a.balance, expiresAt(account));
    }

    /// @notice Pick a plan, optionally topping up in the same transaction.
    /// @dev Requires at least one full period of prepaid balance, so a subscription always starts
    ///      with a real month behind it. Switching plans settles the old rate first, so the
    ///      changeover is exact to the second.
    function subscribe(uint32 planId, uint256 topUp) external {
        Plan memory p = _plans[planId];
        if (!p.exists) revert NoSuchPlan();
        if (!p.open) revert PlanClosed();
        if (_accounts[msg.sender].planId == planId) revert AlreadyOnPlan();

        if (topUp > 0) deposit(msg.sender, topUp);

        Account memory a = _settle(msg.sender);
        if (a.balance < p.pricePerPeriod) revert InsufficientPrepaid(a.balance, p.pricePerPeriod);

        uint32 previous = a.planId;
        _accounts[msg.sender].planId = planId;
        _subscribers.add(msg.sender);

        emit Subscribed(msg.sender, planId, previous, expiresAt(msg.sender));
    }

    /// @notice Stop the meter. Unused balance stays credited and is withdrawable immediately.
    /// @dev No operator involvement, no notice period, no timelock. This is what makes the
    ///      "we can leave any time" promise real rather than a policy.
    function cancel() public {
        Account memory a = _settle(msg.sender);
        if (a.planId == 0) revert NotSubscribed();

        _accounts[msg.sender].planId = 0;
        _subscribers.remove(msg.sender);

        emit Canceled(msg.sender, a.planId, a.balance);
    }

    /// @notice Withdraw unused prepaid balance.
    /// @dev Allowed while subscribed: it simply brings the lapse date forward, possibly to now.
    ///      Trapping a subscriber's money to protect their own uptime would be the worse trade.
    function withdraw(address to, uint256 amount) public {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        Account memory a = _settle(msg.sender);
        if (amount > a.balance) revert InsufficientBalance(a.balance, amount);

        // safe: `amount <= a.balance`, and a.balance is a uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance -= uint128(amount);
        _accounts[msg.sender].balance = a.balance;
        totalPrepaid -= amount;

        token.safeTransfer(to, amount);
        emit Withdrawn(msg.sender, to, amount, a.balance, expiresAt(msg.sender));
    }

    /// @notice Cancel and take everything unused back, in one transaction.
    function cancelAndWithdraw(address to) external returns (uint256 amount) {
        cancel();
        amount = _accounts[msg.sender].balance;
        if (amount > 0) withdraw(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                              SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Book consumed subscription time as operator revenue for one account.
    /// @dev Permissionless and reward-free by design: it moves no money in or out of the contract
    ///      and changes nobody's balance-minus-accrual, so there is nothing to grief and no fee to
    ///      pay a stranger. The party with a reason to call it is the operator, before withdrawing
    ///      revenue that is already theirs. Nothing breaks if it is never called — accrual keeps
    ///      running from the stored timestamp and every read already accounts for it.
    function settle(address account) external {
        _settle(account);
    }

    /// @notice Settle a batch. Pair with `subscribers(start, count)` to sweep everyone.
    function settleMany(address[] calldata accounts) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            _settle(accounts[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                            OPERATOR ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add a plan. Prices are immutable once created — there is no `setPrice`, on purpose:
    ///         repricing a live plan would silently re-rate the balances people already paid in.
    ///         To change pricing, open a new plan and close the old one; existing subscribers keep
    ///         their rate until they choose to switch.
    function createPlan(uint128 pricePerPeriod, bool open) external onlyOwner returns (uint32 planId) {
        return _createPlan(pricePerPeriod, open);
    }

    /// @notice Open or close a plan to *new* subscribers. Closing never touches existing ones:
    ///         their meter keeps running at the price they signed up at.
    function setPlanOpen(uint32 planId, bool open) external onlyOwner {
        if (!_plans[planId].exists) revert NoSuchPlan();
        _plans[planId].open = open;
        emit PlanOpenSet(planId, open);
    }

    /// @notice Withdraw revenue already consumed by subscribers.
    /// @dev Can only ever draw from `accruedRevenue`. Unconsumed subscriber balances are tracked
    ///      separately in `totalPrepaid` and are unreachable from here — the operator cannot take
    ///      a prepayment before the service time behind it has actually elapsed.
    function withdrawRevenue(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount > accruedRevenue) revert InsufficientBalance(accruedRevenue, amount);
        accruedRevenue -= amount;
        token.safeTransfer(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    /// @notice Recover tokens sent here by mistake. For the billing token this is strictly the
    ///         surplus over `totalPrepaid + accruedRevenue`, so subscriber funds stay untouchable.
    function sweepStray(IERC20 erc20, address to) external onlyOwner returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        amount = erc20.balanceOf(address(this));
        if (erc20 == token) {
            uint256 accounted = totalPrepaid + accruedRevenue;
            amount = amount > accounted ? amount - accounted : 0;
        }
        if (amount == 0) revert NothingToSweep();
        erc20.safeTransfer(to, amount);
        emit StraySwept(address(erc20), to, amount);
    }

    /// @notice Two-step handover, so a typo cannot park ownership on an address nobody holds.
    function transferOwnership(address to) external onlyOwner {
        pendingOwner = to;
        emit OwnershipTransferStarted(msg.sender, to);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _createPlan(uint128 pricePerPeriod, bool open) internal returns (uint32 planId) {
        if (pricePerPeriod == 0) revert ZeroPrice();
        planId = ++planCount;
        _plans[planId] = Plan({pricePerPeriod: pricePerPeriod, open: open, exists: true});
        emit PlanCreated(planId, pricePerPeriod, open);
    }

    /// @dev Consumption since `lastSettled`, capped at the balance. The cap is what makes lapsing
    ///      free: once the balance hits zero the meter stops, so a subscriber who ran dry months
    ///      ago owes nothing for the gap and can restart by topping up.
    ///      Integer division truncates in the subscriber's favour by under one token unit
    ///      (1e-6 USDC) per settlement — far below the gas cost of provoking one.
    function _pendingCharge(Account memory a) internal view returns (uint256) {
        if (a.planId == 0) return 0;
        uint256 elapsed = block.timestamp - a.lastSettled;
        if (elapsed == 0) return 0;
        uint256 owed = (elapsed * _plans[a.planId].pricePerPeriod) / PERIOD;
        return owed > a.balance ? a.balance : owed;
    }

    /// @dev Applies accrual and returns the fresh account. Every state-changing entry point calls
    ///      this first, which is the whole billing cycle: no scheduler, just "settle on touch".
    function _settle(address account) internal returns (Account memory a) {
        a = _accounts[account];
        uint256 owed = _pendingCharge(a);

        if (owed > 0) {
            // safe: `_pendingCharge` caps `owed` at `a.balance`, itself a uint128
            // forge-lint: disable-next-line(unsafe-typecast)
            a.balance -= uint128(owed);
            totalPrepaid -= owed;
            accruedRevenue += owed;
            emit Settled(account, a.planId, owed);
        }
        if (a.lastSettled != uint64(block.timestamp)) {
            a.lastSettled = uint64(block.timestamp);
        }
        _accounts[account] = a;
    }
}
