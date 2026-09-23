// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Minimal} from "./IERC20Minimal.sol";

/// @title WeatherBilling — prepaid USDC subscriptions for the weather API.
///
/// @dev How billing works, and why there is no monthly "charger":
///
///      A subscription is a stream, not a calendar event. A customer's USDC sits
///      in this contract as `balance` and is consumed at their plan's rate
///      (price / period). Consumption is accounted LAZILY: the ledger only
///      moves when the account is touched (topUp / subscribe / cancel / poke).
///      Nobody needs to call anything monthly — the amount owed at any moment
///      is a pure function of time:
///
///          coveredUntil = lastSettle + balance * period / price
///          isSubscribed = coveredUntil > block.timestamp
///
///      `coveredUntil` is the first second NOT covered (half-open interval):
///      paying for one period at T covers exactly [T, T + period).
///
///      `isSubscribed` is a view, so the API backend can check access on every
///      request with a free eth_call and no off-chain keeper. If the balance
///      runs dry the subscription lapses silently; topping up later restarts
///      coverage from that moment and the lapsed gap is never charged.
contract WeatherBilling {
    // ---------------------------------------------------------------- types

    /// @dev One slot: 96 + 32 + 8 + padding.
    struct Plan {
        uint96 price;   // USDC units per period. USDC has 6 decimals: $5 = 5_000_000.
        uint32 period;  // seconds per billing period. 30 days = 2_592_000.
        bool enabled;   // gates NEW subscriptions only; existing coverage is never touched
    }

    /// @dev One slot: 176 + 64 + 16.
    struct Account {
        uint176 balance;    // USDC held here, not yet consumed
        uint64 lastSettle;  // the stream is paid for through this moment
        uint16 planId;      // 1-indexed plan id; 0 = no plan
    }

    // -------------------------------------------------------------- storage

    IERC20Minimal public immutable usdc;
    address public owner;

    Plan[] public plans;
    mapping(address => Account) private _accounts;

    /// @dev Revenue realized by _settle, awaiting collection. This is the ONLY
    ///      pool of tokens the owner can ever move; customer balances are not in it.
    uint256 public revenue;

    // --------------------------------------------------------------- events

    event ToppedUp(address indexed user, uint256 amount);
    event Subscribed(address indexed user, uint16 indexed planId);
    event Cancelled(address indexed user, uint256 refund);
    event Settled(address indexed user, uint256 charged);
    event PlanAdded(uint16 indexed planId, uint96 price, uint32 period);
    event PlanEnabled(uint16 indexed planId, bool enabled);
    event RevenueCollected(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed from, address indexed to);

    // --------------------------------------------------------------- errors

    error NotOwner();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidPlan();
    error InvalidPrice();
    error PlanDisabled(uint16 planId);
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address owner_) {
        if (usdc_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        usdc = IERC20Minimal(usdc_);
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    // ------------------------------------------------------- customer side

    /// @notice Deposit USDC to fund the subscription. Requires a prior
    ///         `usdc.approve(billing, amount)` — the contract only ever pulls
    ///         exactly what is passed here, so exact-amount approvals are fine.
    function topUp(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        Account storage a = _accounts[msg.sender];
        _settle(a);
        a.balance += uint176(amount);
        // If the account lapsed (balance ran dry in the past), _settle parked
        // lastSettle at the moment coverage ended. Restart the clock now so
        // the unsubscribed gap is never charged. If it had not lapsed,
        // _settle already set lastSettle to now — this is a no-op.
        a.lastSettle = uint64(block.timestamp);
        emit ToppedUp(msg.sender, amount);
        _pull(amount);
    }

    /// @notice Choose (or switch to) a plan. Switching prorates automatically:
    ///         time since last touch is charged at the OLD plan's rate, the new
    ///         rate applies from this moment. A plan can be selected with zero
    ///         balance — it just grants no coverage until a topUp happens.
    function subscribe(uint16 planId) external {
        if (planId == 0 || planId > plans.length) revert InvalidPlan();
        if (!plans[planId - 1].enabled) revert PlanDisabled(planId);
        Account storage a = _accounts[msg.sender];
        _settle(a);
        a.planId = planId;
        a.lastSettle = uint64(block.timestamp);
        emit Subscribed(msg.sender, planId);
    }

    /// @notice End the subscription and get back every unspent cent. The refund
    ///         is the remaining balance — in this design prepayment and balance
    ///         are the same thing, so "unused time" is refunded exactly.
    function cancel() external {
        Account storage a = _accounts[msg.sender];
        _settle(a);
        uint256 refund = a.balance;
        a.balance = 0;
        a.planId = 0;
        a.lastSettle = uint64(block.timestamp);
        emit Cancelled(msg.sender, refund);
        if (refund != 0) _push(msg.sender, refund);
    }

    /// @notice Settle anyone's account. Optional: not needed for correctness
    ///         (the views are always truthful), it only realizes consumed
    ///         balance into the collectable `revenue` counter. Permissionless
    ///         so the operator — or anyone — can do it; it is always fair to
    ///         the customer.
    function poke(address user) external {
        _settle(_accounts[user]);
    }

    // ----------------------------------------------------------- backend views

    /// @notice The per-request access check. Pure view: free to call, no
    ///         keeper, no state change, truthful even if the account has not
    ///         been touched for months.
    function isSubscribed(address user) external view returns (bool) {
        return coveredUntil(user) > block.timestamp;
    }

    /// @notice First second NOT covered by payment: service is granted on
    ///         [lastSettle, coveredUntil). 0 when there is no plan.
    function coveredUntil(address user) public view returns (uint256) {
        Account storage a = _accounts[user];
        if (a.planId == 0) return 0;
        Plan storage p = plans[a.planId - 1];
        return a.lastSettle + uint256(a.balance) * p.period / p.price;
    }

    function account(address user) external view returns (uint176 balance, uint16 planId, uint64 lastSettle) {
        Account storage a = _accounts[user];
        return (a.balance, a.planId, a.lastSettle);
    }

    function planCount() external view returns (uint256) {
        return plans.length;
    }

    // ------------------------------------------------------------- owner side

    /// @notice Offer a new plan. Plans are append-only: prices can never be
    ///         edited afterwards, because coverage is derived from
    ///         price/period — editing one retroactively would shrink or inflate
    ///         every existing subscriber's paid-for time. To change pricing,
    ///         add a new plan and let customers switch; existing subscribers
    ///         keep their old terms forever.
    function addPlan(uint96 price, uint32 period) external onlyOwner returns (uint16 planId) {
        if (price == 0 || period == 0) revert InvalidPrice();
        if (plans.length >= type(uint16).max) revert InvalidPlan();
        plans.push(Plan({price: price, period: period, enabled: true}));
        planId = uint16(plans.length);
        emit PlanAdded(planId, price, period);
    }

    /// @notice Stop (or resume) offering a plan to NEW subscribers. Never
    ///         affects existing coverage.
    function setPlanEnabled(uint16 planId, bool enabled) external onlyOwner {
        if (planId == 0 || planId > plans.length) revert InvalidPlan();
        plans[planId - 1].enabled = enabled;
        emit PlanEnabled(planId, enabled);
    }

    /// @notice Collect revenue that customers' streams have actually consumed.
    ///         Deposits are unreachable: `revenue` only grows inside _settle,
    ///         by amounts taken against consumed time.
    function collectRevenue(address to) external onlyOwner returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        amount = revenue;
        revenue = 0;
        emit RevenueCollected(to, amount);
        if (amount != 0) _push(to, amount);
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        owner = next;
        emit OwnershipTransferred(msg.sender, next);
    }

    // ------------------------------------------------------------- internals

    /// @dev Charge for time elapsed since lastSettle, at the account's plan rate.
    ///
    ///      Invariant maintained: the account's stream is fully paid for every
    ///      second before `lastSettle`, and `balance` buys exactly
    ///      `balance * period / price` seconds of coverage after it. Between
    ///      settles nothing changes, so the views above stay truthful without
    ///      anyone calling anything.
    function _settle(Account storage a) private {
        if (a.planId == 0) return;
        uint64 last = a.lastSettle;
        if (block.timestamp <= last) return;

        Plan storage p = plans[a.planId - 1];
        uint256 balance = a.balance;
        uint256 elapsed = block.timestamp - last;
        // Seconds of coverage the current balance still buys at this rate.
        uint256 covered = uint256(balance) * p.period / p.price;

        if (elapsed >= covered) {
            // The balance ran dry at `last + covered`, in the past. Consume it
            // all as revenue and park the clock at the moment coverage ended,
            // so the unsubscribed gap is never charged later. (covered <=
            // elapsed here, so the uint64 cast is safe.)
            revenue += balance;
            a.balance = 0;
            a.lastSettle = last + uint64(covered);
            if (balance != 0) emit Settled(msg.sender, balance);
        } else {
            // Floor rounding undercharges the customer by less than one
            // micro-cent of USDC per settle; it never compounds.
            uint256 owed = elapsed * p.price / p.period;
            revenue += owed;
            a.balance = uint176(balance - owed);
            a.lastSettle = uint64(block.timestamp);
            if (owed != 0) emit Settled(msg.sender, owed);
        }
    }

    function _pull(uint256 amount) private {
        (bool ok, bytes memory ret) =
            address(usdc).call(abi.encodeCall(IERC20Minimal.transferFrom, (msg.sender, address(this), amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    function _push(address to, uint256 amount) private {
        (bool ok, bytes memory ret) = address(usdc).call(abi.encodeCall(IERC20Minimal.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
