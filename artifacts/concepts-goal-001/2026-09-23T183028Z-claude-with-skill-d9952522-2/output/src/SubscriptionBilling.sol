// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SubscriptionBilling
/// @notice Prepaid, per-second subscription billing in a fixed ERC20 (USDC).
///
/// @dev Design note: nothing in here needs a cron job, a keeper, or a monthly
/// "charge everyone" transaction. A subscriber's cost accrues from a timestamp
/// and is evaluated at read time, so:
///
///   - `isSubscribed` is correct the instant a subscriber runs out of money,
///     with no transaction having been sent by anyone.
///   - A cancellation refund is just "balance minus what accrued until now",
///     so unused time comes back automatically and exactly.
///   - The only recurring transaction is the operator moving their own already
///     -earned revenue out (`settle` + `withdrawRevenue`). It can be deferred
///     for months without affecting a single user, because the money is
///     already in the contract and already earmarked.
///
/// A "month" here is a fixed 30 days (`MONTH`), not a calendar month, so that
/// the accrual rate is a constant.
contract SubscriptionBilling is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Billing period used to convert a monthly price into a per-second rate.
    uint256 public constant MONTH = 30 days;

    /// @notice Fixed-point scale for `ratePerSecond`, to avoid truncating sub-unit rates.
    /// @dev $5/month at 6 decimals is 1.929… token units per second; without scaling,
    /// integer truncation would bill 1 unit/second and undercharge by ~48%.
    uint256 public constant RATE_SCALE = 1e12;

    /// @notice Largest monthly price a plan may carry, so `ratePerSecond` fits in uint64.
    uint256 public constant MAX_MONTHLY_PRICE = type(uint64).max / RATE_SCALE * MONTH;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    struct Account {
        uint128 balance; // unspent prepaid tokens belonging to the subscriber
        uint64 ratePerSecond; // scaled by RATE_SCALE; snapshot taken at subscribe time
        uint48 lastSettled; // timestamp accrual was last converted into revenue
        uint16 planId; // 0 == not subscribed
    }

    struct Plan {
        uint128 monthlyPrice; // in token units, e.g. 5_000_000 for $5 USDC
        bool open; // false == no new subscriptions; existing ones keep running
    }

    /// @notice The billing token. Immutable: a new token means a new deployment.
    IERC20 public immutable token;

    mapping(address => Account) private _accounts;
    mapping(uint16 => Plan) public plans;

    /// @notice Revenue that has accrued out of subscriber balances and is the operator's.
    /// @dev The operator can never withdraw more than this, so subscriber balances are
    /// not reachable by the owner key under any code path.
    uint256 public collectedRevenue;

    /// @notice Sum of all subscriber balances. Kept so solvency is checkable onchain.
    uint256 public totalSubscriberBalance;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PlanSet(uint16 indexed planId, uint128 monthlyPrice, bool open);
    event Deposited(address indexed account, address indexed payer, uint256 amount, uint256 balance);
    event Withdrawn(address indexed account, address indexed to, uint256 amount, uint256 balance);
    event Subscribed(address indexed account, uint16 indexed planId, uint64 ratePerSecond, uint256 activeUntil);
    event Canceled(address indexed account, uint16 indexed planId, uint256 refundable);
    event Settled(address indexed account, uint256 amountCharged, uint256 balance);
    event Lapsed(address indexed account, uint16 indexed planId);
    event RevenueWithdrawn(address indexed to, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error ZeroAmount();
    error PlanClosed(uint16 planId);
    error PriceTooHigh();
    error InvalidPlanId();
    error InsufficientBalance(uint256 requested, uint256 available);
    error InsufficientPrepayment(uint256 required, uint256 available);
    error NotSubscribed();
    error CannotRescueBillingToken();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTION
    //////////////////////////////////////////////////////////////*/

    constructor(IERC20 billingToken, address initialOwner) Ownable(initialOwner) {
        if (address(billingToken) == address(0)) revert ZeroAddress();
        token = billingToken;
    }

    /*//////////////////////////////////////////////////////////////
                          OPERATOR: PLAN CONFIG
    //////////////////////////////////////////////////////////////*/

    /// @notice Create or update a plan.
    /// @dev A price change applies only to subscriptions started after it. Existing
    /// subscribers keep the rate they signed up at until they cancel or switch plans,
    /// so the owner key cannot raise the price on money already deposited.
    /// Setting `open = false` retires a plan without disturbing its current subscribers.
    function setPlan(uint16 planId, uint128 monthlyPrice, bool open) external onlyOwner {
        if (planId == 0) revert InvalidPlanId();
        if (monthlyPrice == 0) revert ZeroAmount();
        if (monthlyPrice > MAX_MONTHLY_PRICE) revert PriceTooHigh();
        plans[planId] = Plan({monthlyPrice: monthlyPrice, open: open});
        emit PlanSet(planId, monthlyPrice, open);
    }

    /*//////////////////////////////////////////////////////////////
                           SUBSCRIBER: FUNDING
    //////////////////////////////////////////////////////////////*/

    /// @notice Top up your own account.
    function deposit(uint256 amount) external nonReentrant {
        _deposit(msg.sender, amount);
    }

    /// @notice Top up someone else's account (a teammate, a grant, a faucet).
    function depositFor(address account, uint256 amount) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        _deposit(account, amount);
    }

    /// @notice Top up and subscribe in one transaction.
    function depositAndSubscribe(uint256 amount, uint16 planId) external nonReentrant {
        if (amount > 0) _deposit(msg.sender, amount);
        _subscribe(msg.sender, planId);
    }

    /// @notice Withdraw unspent balance. Everything not yet accrued is yours.
    /// @dev Withdrawing while subscribed is allowed and simply shortens `activeUntil`.
    /// Withdrawing the whole balance ends the subscription.
    function withdraw(uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _settle(msg.sender);
        Account storage acct = _accounts[msg.sender];
        uint256 available = acct.balance;
        if (amount > available) revert InsufficientBalance(amount, available);

        acct.balance = uint128(available - amount);
        totalSubscriberBalance -= amount;
        if (acct.balance == 0 && acct.planId != 0) _lapse(msg.sender, acct);

        emit Withdrawn(msg.sender, to, amount, acct.balance);
        token.safeTransfer(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        SUBSCRIBER: SUBSCRIPTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Start a subscription, or switch to a different plan.
    /// @dev Requires at least one month prepaid so a subscription cannot be opened
    /// with dust that expires minutes later.
    function subscribe(uint16 planId) external nonReentrant {
        _subscribe(msg.sender, planId);
    }

    /// @notice Cancel. Stops the meter immediately; the remainder stays withdrawable.
    function cancel() external nonReentrant {
        _settle(msg.sender);
        Account storage acct = _accounts[msg.sender];
        uint16 planId = acct.planId;
        if (planId == 0) revert NotSubscribed();

        acct.planId = 0;
        acct.ratePerSecond = 0;
        emit Canceled(msg.sender, planId, acct.balance);
    }

    /// @notice Cancel and pull the unused remainder back out, in one transaction.
    /// @return refunded Amount sent back to the caller.
    function cancelAndWithdraw(address to) external nonReentrant returns (uint256 refunded) {
        if (to == address(0)) revert ZeroAddress();

        _settle(msg.sender);
        Account storage acct = _accounts[msg.sender];
        uint16 planId = acct.planId;
        if (planId == 0) revert NotSubscribed();

        acct.planId = 0;
        acct.ratePerSecond = 0;
        refunded = acct.balance;
        emit Canceled(msg.sender, planId, refunded);

        if (refunded > 0) {
            acct.balance = 0;
            totalSubscriberBalance -= refunded;
            emit Withdrawn(msg.sender, to, refunded, 0);
            token.safeTransfer(to, refunded);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          PERMISSIONLESS: SETTLE
    //////////////////////////////////////////////////////////////*/

    /// @notice Convert everything accrued so far on these accounts into operator revenue.
    /// @dev Permissionless, and deliberately inert: it moves money the operator has
    /// already earned out of a subscriber bucket and into the revenue bucket. It changes
    /// no subscriber's `activeUntil` and cannot be used to grief anyone. Not calling it
    /// costs nobody anything; it exists so the operator can batch-harvest on their own
    /// schedule, and so a lapsed account's stale plan flag gets cleared.
    function settle(address[] calldata accounts) external nonReentrant {
        for (uint256 i; i < accounts.length; ++i) {
            _settle(accounts[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                         OPERATOR: TAKE REVENUE
    //////////////////////////////////////////////////////////////*/

    /// @notice Withdraw settled revenue. Call `settle` first to sweep in newer accruals.
    function withdrawRevenue(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 available = collectedRevenue;
        if (amount == 0) amount = available;
        if (amount > available) revert InsufficientBalance(amount, available);

        collectedRevenue = available - amount;
        emit RevenueWithdrawn(to, amount);
        token.safeTransfer(to, amount);
    }

    /// @notice Recover tokens sent here by mistake that are not the billing token.
    /// @dev Cannot touch the billing token, so this is not a back door into subscriber funds.
    function rescueToken(IERC20 stray, address to) external onlyOwner nonReentrant {
        if (address(stray) == address(token)) revert CannotRescueBillingToken();
        if (to == address(0)) revert ZeroAddress();
        stray.safeTransfer(to, stray.balanceOf(address(this)));
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice The one call a request-path API gate needs.
    function isSubscribed(address account) external view returns (bool) {
        return block.timestamp < activeUntil(account);
    }

    /// @notice Timestamp the subscription runs dry at, assuming no further deposits.
    /// @dev 0 when not subscribed. A value in the past means the account has lapsed:
    /// it is already false for `isSubscribed` whether or not anyone has settled it.
    /// Cache the gate result until this timestamp — see backend/subscription-gate.mjs.
    function activeUntil(address account) public view returns (uint256) {
        Account memory acct = _accounts[account];
        if (acct.planId == 0 || acct.ratePerSecond == 0) return 0;
        return uint256(acct.lastSettled) + (uint256(acct.balance) * RATE_SCALE) / acct.ratePerSecond;
    }

    /// @notice Everything a dashboard needs about one account, in one call.
    /// @param planId 0 if not subscribed (or lapsed and already settled).
    /// @param remaining Balance after deducting what has accrued but not yet been settled.
    /// @param accrued What the operator has earned from this account since the last settle.
    /// @param until Same as `activeUntil`.
    /// @param active Same as `isSubscribed`.
    function accountOf(address account)
        external
        view
        returns (uint16 planId, uint256 remaining, uint256 accrued, uint256 until, bool active, uint64 ratePerSecond)
    {
        Account memory acct = _accounts[account];
        accrued = _accrued(acct);
        until = activeUntil(account);
        return (acct.planId, acct.balance - accrued, accrued, until, block.timestamp < until, acct.ratePerSecond);
    }

    /// @notice Withdrawable-right-now balance for an account.
    function refundableOf(address account) external view returns (uint256) {
        Account memory acct = _accounts[account];
        return acct.balance - _accrued(acct);
    }

    /// @notice Revenue withdrawable right now if every listed account were settled first.
    function revenueIncluding(address[] calldata accounts) external view returns (uint256 total) {
        total = collectedRevenue;
        for (uint256 i; i < accounts.length; ++i) {
            total += _accrued(_accounts[accounts[i]]);
        }
    }

    /// @notice Token units this contract holds beyond everything it owes. Should be >= 0
    /// at all times; a nonzero value is just donated or rounding dust.
    function solvencySurplus() external view returns (uint256) {
        return token.balanceOf(address(this)) - (totalSubscriberBalance + collectedRevenue);
    }

    /// @notice Per-second rate a plan would charge a new subscriber, scaled by RATE_SCALE.
    function ratePerSecondOf(uint16 planId) public view returns (uint64) {
        return uint64(uint256(plans[planId].monthlyPrice) * RATE_SCALE / MONTH);
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _deposit(address account, uint256 amount) private {
        if (amount == 0) revert ZeroAmount();

        // Settle before crediting: otherwise a top-up on an account that ran dry
        // some time ago would be retroactively eaten by the dead period.
        _settle(account);

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        Account storage acct = _accounts[account];
        uint256 newBalance = uint256(acct.balance) + received;
        acct.balance = uint128(newBalance); // reverts on overflow (>3.4e38 units)
        totalSubscriberBalance += received;

        emit Deposited(account, msg.sender, received, newBalance);
    }

    function _subscribe(address account, uint16 planId) private {
        Plan memory plan = plans[planId];
        if (planId == 0 || plan.monthlyPrice == 0 || !plan.open) revert PlanClosed(planId);

        _settle(account);
        Account storage acct = _accounts[account];
        if (acct.balance < plan.monthlyPrice) {
            revert InsufficientPrepayment(plan.monthlyPrice, acct.balance);
        }

        uint64 rate = ratePerSecondOf(planId);
        acct.planId = planId;
        acct.ratePerSecond = rate;
        acct.lastSettled = uint48(block.timestamp);

        emit Subscribed(account, planId, rate, activeUntil(account));
    }

    /// @dev Moves accrued cost from the subscriber bucket into the revenue bucket.
    /// Charging is capped at the balance, so an account that ran out is charged only
    /// for the time it was actually funded, never for the dead period after.
    function _settle(address account) private {
        Account storage acct = _accounts[account];
        if (acct.planId == 0) {
            // Nothing accruing; keep the clock fresh so a later subscribe starts clean.
            acct.lastSettled = uint48(block.timestamp);
            return;
        }

        uint256 charge = _accrued(acct);
        if (charge > 0) {
            acct.balance = uint128(uint256(acct.balance) - charge);
            totalSubscriberBalance -= charge;
            collectedRevenue += charge;
            emit Settled(account, charge, acct.balance);
        }
        acct.lastSettled = uint48(block.timestamp);

        if (acct.balance == 0) _lapse(account, acct);
    }

    function _lapse(address account, Account storage acct) private {
        emit Lapsed(account, acct.planId);
        acct.planId = 0;
        acct.ratePerSecond = 0;
    }

    function _accrued(Account memory acct) private view returns (uint256) {
        if (acct.planId == 0 || acct.ratePerSecond == 0) return 0;
        uint256 elapsed = block.timestamp - acct.lastSettled;
        uint256 owed = elapsed * acct.ratePerSecond / RATE_SCALE;
        return owed > acct.balance ? acct.balance : owed;
    }
}
