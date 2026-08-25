// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./IERC20.sol";
import {SafeTransfer} from "./SafeTransfer.sol";

/// @title  SubscriptionBilling
/// @notice Prepaid, continuously-accruing subscriptions denominated in an ERC-20 (USDC).
///
/// @dev    THE ONE IDEA IN THIS CONTRACT
///
///         A contract has no clock and no cron. "Charge the customer on the 1st of every month"
///         is not something this contract can do to itself — it would need somebody to send a
///         transaction per customer per month and pay gas for it, forever.
///
///         So nothing is ever *charged*. A subscription is a rate (`ratePerPeriod`) running
///         against a prepaid `balance` from a timestamp (`lastSettled`). How much the customer
///         owes at any instant is arithmetic on `block.timestamp`, computable by anyone reading
///         the chain, with no transaction having been sent:
///
///             owed  = ratePerPeriod * (now - lastSettled) / PERIOD     (capped at balance)
///
///         Everything the product needs falls out of that one line:
///
///         - "charged monthly"   -> the balance drains at the monthly rate. Same money, no tx.
///         - "cancel any time,
///            refund the unused" -> the unused part was never spent. `cancel()` stops the clock
///                                 and `withdraw()` takes back what is left. No refund math,
///                                 no operator approval, no trust.
///         - "expires when the
///            money runs out"    -> the cap at `balance` means the subscription lapses on its
///                                 own at a knowable second. Nobody sends an "expire" tx.
///         - "is X subscribed?"  -> `isActive(X)` is a view. Your backend calls it and pays
///                                 nothing.
///
///         `settle()` moves accrued value from the customer's `balance` bucket to the operator's
///         `revenue` bucket. It changes who a number belongs to; it does not change *what anyone
///         is owed*. If it is never called, the accounting is still right — every view function
///         accrues on the fly. That is why there is no keeper here and no reward for one: the
///         only party with a reason to call it is the operator collecting revenue that is
///         already theirs, and they can do it whenever they like, in one batched transaction,
///         for as many customers as fit in a block.
///
/// @dev    PERIOD is a fixed 30 days, not a calendar month. "$5/month" here means $5 per 30
///         days — 12.17 charges a year, not 12. Chosen because calendar months onchain mean
///         a date library and a variable rate, for no benefit to anybody.
contract SubscriptionBilling {
    using SafeTransfer for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice One billing period. "Monthly" == every 30 days.
    uint256 public constant PERIOD = 30 days;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The billing token. Immutable: this contract is not a multi-currency processor.
    IERC20 public immutable token;

    /// @notice Receives collected revenue and configures plans. Cannot touch customer balances.
    address public owner;
    /// @notice Pending owner for the two-step handover. See {transferOwnership}.
    address public pendingOwner;

    struct Plan {
        /// @dev Price per PERIOD, in token units (USDC has 6 decimals, so $5 == 5_000_000).
        uint128 pricePerPeriod;
        /// @dev New subscriptions allowed. Closing a plan never affects existing subscribers.
        bool open;
    }

    /// @notice planId => plan. Plan 0 is permanently unused and means "no subscription".
    mapping(uint8 => Plan) public plans;

    struct Account {
        /// @dev Prepaid token units that are still the customer's. Drains at `ratePerPeriod`.
        uint128 balance;
        /// @dev Price per PERIOD, snapshotted when the customer subscribed. 0 == not subscribed.
        ///      Snapshotted on purpose: see {setPlan}. The operator cannot reprice you.
        uint128 ratePerPeriod;
        /// @dev Timestamp that `balance` is accurate as of. Accrual runs from here.
        uint64 lastSettled;
        /// @dev Which plan they picked. Informational — billing uses `ratePerPeriod`.
        uint8 planId;
    }

    mapping(address => Account) public accounts;

    /// @notice Sum of all `accounts[..].balance`. Customer money. The owner can never take it.
    uint128 public totalEscrowed;

    /// @notice Settled revenue awaiting {collectRevenue}. Already earned; safe to leave here.
    uint128 public revenue;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposited(address indexed account, address indexed payer, uint256 amount, uint128 balance);
    event Withdrawn(address indexed account, address indexed to, uint256 amount, uint128 balance);
    event Subscribed(address indexed account, uint8 indexed planId, uint128 ratePerPeriod);
    event Cancelled(address indexed account, uint8 indexed planId);
    event Settled(address indexed account, uint256 amount, uint128 balance);
    event PlanSet(uint8 indexed planId, uint128 pricePerPeriod, bool open);
    event RevenueCollected(address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);
    event Rescued(address indexed erc20, address indexed to, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error ZeroAmount();
    error AmountTooLarge();
    error NoSuchPlan();
    error PlanClosed();
    error NotSubscribed();
    error InsufficientBalance();
    error TooManyAccounts();

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    /// @param _token   Billing token. On Base mainnet, native USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    /// @param _owner   Address that collects revenue and manages plans.
    /// @param planIds  Plan ids to seed (e.g. [1, 2] for hobby and pro).
    /// @param prices   Matching prices per PERIOD in token units (e.g. [5e6, 20e6]).
    constructor(IERC20 _token, address _owner, uint8[] memory planIds, uint128[] memory prices) {
        if (address(_token) == address(0) || _owner == address(0)) revert ZeroAddress();
        require(planIds.length == prices.length, "length mismatch");
        token = _token;
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
        for (uint256 i; i < planIds.length; ++i) {
            _setPlan(planIds[i], prices[i], true);
        }
    }

    /*//////////////////////////////////////////////////////////////
                            CUSTOMER ACTIONS
              Every one of these is sent by the customer, about
              their own money. Nobody has to be paid to run them.
    //////////////////////////////////////////////////////////////*/

    /// @notice Top up your own account. Requires an ERC-20 approval first.
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's account — an employer funding a developer, a faucet, a gift.
    /// @dev    The recipient keeps full control of the funds, including withdrawing them. Only
    ///         send to accounts you are happy to hand money to.
    function depositFor(address account, uint256 amount) external {
        if (account == address(0)) revert ZeroAddress();
        _deposit(account, amount);
    }

    /// @notice Start (or switch) a subscription. Time already used is settled at the old rate first.
    /// @dev    The plan's current price is copied into your account and is yours for as long as you
    ///         stay subscribed. Later plan repricings do not reach you.
    function subscribe(uint8 planId) external {
        _subscribe(msg.sender, planId);
    }

    /// @notice Approve-once onboarding: top up and subscribe in a single transaction.
    function subscribeWithDeposit(uint8 planId, uint256 amount) external {
        _deposit(msg.sender, amount);
        _subscribe(msg.sender, planId);
    }

    /// @notice Stop the meter. Everything not yet used stays yours and is withdrawable at once.
    /// @dev    No notice period, no operator involvement, no end-of-period wait.
    function cancel() external {
        Account memory a = _settle(msg.sender);
        if (a.ratePerPeriod == 0) revert NotSubscribed();
        uint8 planId = a.planId;
        a.ratePerPeriod = 0;
        a.planId = 0;
        accounts[msg.sender] = a;
        emit Cancelled(msg.sender, planId);
    }

    /// @notice Withdraw unused prepaid funds.
    /// @dev    Allowed while still subscribed; it just shortens your runway. Withdrawing
    ///         everything makes the subscription lapse immediately, which is a valid way to quit.
    function withdraw(uint256 amount, address to) public {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        Account memory a = _settle(msg.sender);
        if (amount > a.balance) revert InsufficientBalance();
        // safe: checked against a.balance, itself a uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance -= uint128(amount);
        accounts[msg.sender] = a;
        // safe: amount <= a.balance <= totalEscrowed, all uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        totalEscrowed -= uint128(amount);
        emit Withdrawn(msg.sender, to, amount, a.balance);
        token.safeTransfer(to, amount);
    }

    /// @notice Cancel and take everything back, in one transaction. The exit door.
    /// @dev    Works with no cooperation from the operator whatsoever. If the owner key is lost
    ///         or the operator vanishes, this still works, forever.
    /// @return refunded Token units returned.
    function closeAccount(address to) external returns (uint256 refunded) {
        Account memory a = _settle(msg.sender);
        if (a.ratePerPeriod != 0) {
            uint8 planId = a.planId;
            a.ratePerPeriod = 0;
            a.planId = 0;
            accounts[msg.sender] = a;
            emit Cancelled(msg.sender, planId);
        }
        refunded = a.balance;
        if (refunded != 0) withdraw(refunded, to);
    }

    /*//////////////////////////////////////////////////////////////
                            REVENUE COLLECTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Move accrued charges from customer balances into `revenue`. Permissionless.
    /// @dev    Calling this is optional and never urgent. Skipping it for a year changes nothing
    ///         about who is owed what — the views accrue regardless, and unsettled time is not
    ///         lost, only unbooked. Batch it whenever gas is cheap.
    ///         Left permissionless because it can only ever move money in the direction both
    ///         parties already agreed to; there is no reward, and none is needed, because the
    ///         operator is always motivated to call it and nothing breaks if they do not.
    ///         The only cost of an extra call is that `owed` is floored, so settling very often
    ///         underbooks the operator by under one token unit per call. Nobody can grief this
    ///         profitably: a unit of USDC is $0.000001 and the call costs ~4,900 gas.
    function settle(address[] calldata who) external {
        if (who.length > 500) revert TooManyAccounts();
        for (uint256 i; i < who.length; ++i) {
            _settle(who[i]);
        }
    }

    /// @notice The operator's whole routine in one transaction: book elapsed time for a batch of
    ///         customers, then sweep everything booked.
    /// @dev    Convenience only — {settle} and {collectRevenue} do the same thing separately and
    ///         {settle} needs no permissions. Exists so the monthly chore is one tx, not two.
    function settleAndCollect(address[] calldata who, address to) external onlyOwner returns (uint256) {
        if (who.length > 500) revert TooManyAccounts();
        for (uint256 i; i < who.length; ++i) {
            _settle(who[i]);
        }
        // Nothing accrued is a normal outcome for a routine you run on a schedule, not an
        // error — returning 0 beats reverting the whole batch with `ZeroAmount`.
        if (revenue == 0) return 0;
        return _collectRevenue(to, 0);
    }

    /// @notice Owner sweeps earned revenue.
    /// @dev    Reaches only the `revenue` bucket. `totalEscrowed` is structurally out of reach:
    ///         value enters `revenue` only by elapsing against a rate the customer chose.
    function collectRevenue(address to, uint256 amount) external onlyOwner returns (uint256) {
        return _collectRevenue(to, amount);
    }

    function _collectRevenue(address to, uint256 amount) internal returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        uint256 available = revenue;
        if (amount == 0 || amount > available) amount = available;
        if (amount == 0) revert ZeroAmount();
        // safe: available is uint128 `revenue`, and amount <= available
        // forge-lint: disable-next-line(unsafe-typecast)
        revenue = uint128(available - amount);
        emit RevenueCollected(to, amount);
        token.safeTransfer(to, amount);
        return amount;
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
           What the backend reads. All free — no gas, no signer.
    //////////////////////////////////////////////////////////////*/

    /// @notice Charges accrued since `lastSettled` but not yet booked. Capped at the balance:
    ///         a customer who ran out of money 6 months ago owes nothing for those 6 months,
    ///         because they were not being served.
    function accrued(address account) public view returns (uint256) {
        Account memory a = accounts[account];
        if (a.ratePerPeriod == 0 || a.balance == 0) return 0;
        uint256 owed = (uint256(a.ratePerPeriod) * (block.timestamp - a.lastSettled)) / PERIOD;
        return owed > a.balance ? a.balance : owed;
    }

    /// @notice Funds the customer could withdraw right now.
    function withdrawable(address account) public view returns (uint256) {
        return accounts[account].balance - accrued(account);
    }

    /// @notice The second at which this subscription lapses on its own, with no transaction sent.
    /// @return 0 if not subscribed. Otherwise a unix timestamp, which moves later on top-up and
    ///         earlier on withdrawal, and is exact — the contract cannot change its mind.
    function activeUntil(address account) public view returns (uint64) {
        Account memory a = accounts[account];
        if (a.ratePerPeriod == 0) return 0;
        uint256 t = uint256(a.lastSettled) + (uint256(a.balance) * PERIOD) / a.ratePerPeriod;
        // safe: the ternary is the bounds check
        // forge-lint: disable-next-line(unsafe-typecast)
        return t > type(uint64).max ? type(uint64).max : uint64(t);
    }

    /// @notice The gate. True iff this address has an unlapsed, funded subscription.
    function isActive(address account) public view returns (bool) {
        return block.timestamp < activeUntil(account);
    }

    struct Status {
        address account;
        bool active;
        uint8 planId;
        uint128 ratePerPeriod;
        uint64 activeUntil;
        uint256 withdrawable;
    }

    /// @notice Everything the backend wants about one address, in one RPC round trip.
    function statusOf(address account) public view returns (Status memory) {
        Account memory a = accounts[account];
        return Status({
            account: account,
            active: isActive(account),
            planId: a.planId,
            ratePerPeriod: a.ratePerPeriod,
            activeUntil: activeUntil(account),
            withdrawable: withdrawable(account)
        });
    }

    /// @notice Batched {statusOf}, so a cache refresh is one request instead of N.
    function statusOfMany(address[] calldata who) external view returns (Status[] memory out) {
        out = new Status[](who.length);
        for (uint256 i; i < who.length; ++i) {
            out[i] = statusOf(who[i]);
        }
    }

    /// @notice Token units held here that belong to nobody — rounding dust and stray transfers.
    ///         Should be tiny. If it is large, something is wrong; see NOTES.md.
    function unaccountedBalance() external view returns (uint256) {
        uint256 held = token.balanceOf(address(this));
        uint256 owed = uint256(totalEscrowed) + revenue;
        return held > owed ? held - owed : 0;
    }

    /*//////////////////////////////////////////////////////////////
                             OWNER CONTROLS
      Everything the operator can do is in this section. It is short
      on purpose, and NOTES.md spells out each one in plain English.
    //////////////////////////////////////////////////////////////*/

    /// @notice Create, reprice or close a plan.
    /// @dev    Affects NEW subscriptions only. Existing subscribers keep the rate they signed up
    ///         at until they themselves call {subscribe} again — so this cannot be used to drain
    ///         anyone, and a price rise cannot be applied retroactively.
    function setPlan(uint8 planId, uint128 pricePerPeriod, bool open) external onlyOwner {
        _setPlan(planId, pricePerPeriod, open);
    }

    /// @notice Step 1 of 2 of handing over the owner role.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Step 2 of 2. The new owner must prove control of the key before it takes effect.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address old = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(old, msg.sender);
    }

    /// @notice Recover tokens sent here by mistake.
    /// @dev    For the billing token this is hard-limited to {unaccountedBalance} — the part that
    ///         is neither customer escrow nor booked revenue. There is no code path, here or
    ///         anywhere else, by which the owner can reach a customer's prepaid balance.
    function rescue(IERC20 erc20, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 max = erc20 == token
            ? token.balanceOf(address(this)) - uint256(totalEscrowed) - revenue
            : erc20.balanceOf(address(this));
        if (amount == 0 || amount > max) amount = max;
        if (amount == 0) revert ZeroAmount();
        emit Rescued(address(erc20), to, amount);
        erc20.safeTransfer(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _deposit(address account, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint128).max) revert AmountTooLarge();
        Account memory a = _settle(account);
        // safe: amount bounded by the AmountTooLarge check above
        // forge-lint: disable-next-line(unsafe-typecast)
        a.balance += uint128(amount);
        accounts[account] = a;
        // forge-lint: disable-next-line(unsafe-typecast)
        totalEscrowed += uint128(amount);
        emit Deposited(account, msg.sender, amount, a.balance);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function _subscribe(address account, uint8 planId) internal {
        Plan memory p = plans[planId];
        if (planId == 0 || p.pricePerPeriod == 0) revert NoSuchPlan();
        if (!p.open) revert PlanClosed();
        Account memory a = _settle(account);
        a.ratePerPeriod = p.pricePerPeriod;
        a.planId = planId;
        accounts[account] = a;
        emit Subscribed(account, planId, p.pricePerPeriod);
    }

    /// @dev Books elapsed time against the balance and moves `lastSettled` to now. Idempotent
    ///      within a block. Returns the updated account in memory so callers can keep mutating
    ///      it and write once.
    function _settle(address account) internal returns (Account memory a) {
        a = accounts[account];
        uint256 elapsed = block.timestamp - a.lastSettled;
        if (elapsed == 0) return a;

        if (a.ratePerPeriod != 0 && a.balance != 0) {
            uint256 owed = (uint256(a.ratePerPeriod) * elapsed) / PERIOD;
            if (owed > a.balance) owed = a.balance; // ran dry mid-period; the rest was never served
            if (owed != 0) {
                // safe: owed was just capped at a.balance, a uint128
                // forge-lint: disable-next-line(unsafe-typecast)
                a.balance -= uint128(owed);
                // forge-lint: disable-next-line(unsafe-typecast)
                totalEscrowed -= uint128(owed);
                // forge-lint: disable-next-line(unsafe-typecast)
                revenue += uint128(owed);
                emit Settled(account, owed, a.balance);
            }
        }
        // safe: uint64 seconds overflows in the year 584,942,417,355
        // forge-lint: disable-next-line(unsafe-typecast)
        a.lastSettled = uint64(block.timestamp);
        accounts[account] = a;
    }

    function _setPlan(uint8 planId, uint128 pricePerPeriod, bool open) internal {
        if (planId == 0) revert NoSuchPlan();
        plans[planId] = Plan({pricePerPeriod: pricePerPeriod, open: open});
        emit PlanSet(planId, pricePerPeriod, open);
    }
}
