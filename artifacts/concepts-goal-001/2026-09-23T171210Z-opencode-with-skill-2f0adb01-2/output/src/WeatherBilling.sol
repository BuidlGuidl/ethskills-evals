// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WeatherBilling
/// @notice Prepaid, streaming billing for the weather API. A customer deposits
///         USDC into a prepaid credit balance and picks a plan; the plan drains
///         that balance continuously at monthlyPrice / MONTH per second.
///
/// @dev There is no cron job and no keeper in this design. Charging happens
///      lazily whenever a customer's state is touched (deposit, subscribe,
///      cancel, or the permissionless `settle`), and expiry is computed on the
///      fly by `isSubscribed` without any transaction. A balance that runs out
///      lapses the subscription passively, whenever it is next observed.
contract WeatherBilling is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Billing months are fixed 30-day periods so the math stays exact.
    uint256 public constant MONTH = 30 days;

    struct Plan {
        string name; // e.g. "hobby", "pro"
        uint256 monthlyPrice; // in payment-token units (USDC: 6 decimals)
    }

    IERC20 public immutable paymentToken;

    /// @dev Plans are fixed at deployment. Changing prices means deploying a
    ///      new contract; customers migrate by cancelling (full refund of
    ///      unused credit) and re-subscribing against the new one.
    Plan[] public plans;

    /// @notice Prepaid credit remaining, in token units.
    mapping(address => uint256) public credits;
    /// @notice 1-based active plan id, 0 = none. Cleared when credit runs out.
    mapping(address => uint8) public planOf;
    /// @notice Timestamp up to which charges have been settled for the user.
    mapping(address => uint64) public lastAccrued;

    /// @notice Accrued but unclaimed revenue, in token units.
    uint256 public totalRevenue;

    error ZeroAmount();
    error InvalidPlan(uint8 planId);
    error NoCredit();

    event Deposited(address indexed user, uint256 amount, uint256 newCredits);
    event Subscribed(address indexed user, uint8 indexed planId);
    event Cancelled(address indexed user, uint8 indexed planId, uint256 refund);
    event Lapsed(address indexed user, uint8 indexed planId, uint256 charged, uint64 exhaustedAt);
    event RevenueClaimed(address indexed to, uint256 amount);

    /// @param token Payment token (USDC). Fixed for the life of the contract.
    /// @param owner Recipient of accrued revenue. Can never touch customer credit.
    /// @param planNames Plan labels, e.g. ["hobby", "pro"].
    /// @param planPrices Monthly prices in token units, e.g. [5e6, 20e6] for USDC.
    constructor(
        IERC20 token,
        address owner,
        string[] memory planNames,
        uint256[] memory planPrices
    ) Ownable(owner) {
        if (planNames.length == 0 || planNames.length != planPrices.length) revert InvalidPlan(0);
        paymentToken = token;
        for (uint256 i = 0; i < planNames.length; i++) {
            plans.push(Plan(planNames[i], planPrices[i]));
        }
    }

    // ------------------------------------------------------------------
    // Customer actions
    // ------------------------------------------------------------------

    /// @notice Top up prepaid credit. Requires the caller to have approved
    ///         this contract for `amount` beforehand. The contract only ever
    ///         pulls exact amounts — no need for an unlimited approval.
    function deposit(uint256 amount) external nonReentrant {
        _settle(msg.sender);
        if (amount == 0) revert ZeroAmount();
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 newCredits = credits[msg.sender] + amount;
        credits[msg.sender] = newCredits;
        emit Deposited(msg.sender, amount, newCredits);
    }

    /// @notice Top up and pick a plan in one transaction.
    function depositAndSubscribe(uint256 amount, uint8 planId) external nonReentrant {
        _settle(msg.sender);
        if (planId == 0 || planId > plans.length) revert InvalidPlan(planId);
        if (amount == 0) revert ZeroAmount();
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        credits[msg.sender] += amount;
        emit Deposited(msg.sender, amount, credits[msg.sender]);
        _activate(planId);
    }

    /// @notice Pick or switch plans. Switching settles the old plan's accrued
    ///         charges first, then bills at the new rate from now on.
    function subscribe(uint8 planId) external nonReentrant {
        _settle(msg.sender);
        _activate(planId);
    }

    /// @notice Cancel and get back every unused cent of prepaid credit.
    ///         Works whether or not a plan is active.
    function cancel() external nonReentrant {
        _settle(msg.sender);
        uint8 planId = planOf[msg.sender];
        uint256 refund = credits[msg.sender];
        planOf[msg.sender] = 0;
        credits[msg.sender] = 0;
        if (refund > 0) paymentToken.safeTransfer(msg.sender, refund);
        emit Cancelled(msg.sender, planId, refund);
    }

    /// @notice Permissionless housekeeping: settle accrued charges for `user`.
    ///         Nobody is required to call this — deposits, plan switches and
    ///         cancels all settle internally, and `isSubscribed` is correct
    ///         without it. It exists to keep storage tidy and to surface
    ///         `Lapsed` events promptly.
    function settle(address user) external nonReentrant {
        _settle(user);
    }

    // ------------------------------------------------------------------
    // Views (free — no transaction needed)
    // ------------------------------------------------------------------

    /// @notice Whether `user` currently has an active, funded subscription.
    ///         Correct without any prior settlement, so a backend can simply
    ///         eth_call this per request.
    function isSubscribed(address user) public view returns (bool) {
        uint8 planId = planOf[user];
        if (planId == 0) return false;
        uint256 bal = credits[user];
        if (bal == 0) return false;
        uint256 price = plans[planId - 1].monthlyPrice;
        uint256 charge = price * (block.timestamp - lastAccrued[user]) / MONTH;
        return charge < bal;
    }

    /// @notice How many more seconds the current credit balance covers.
    ///         Useful for "top up soon" warnings.
    function secondsRemaining(address user) external view returns (uint256) {
        uint8 planId = planOf[user];
        if (planId == 0) return 0;
        uint256 bal = credits[user];
        if (bal == 0) return 0;
        uint256 covered = bal * MONTH / plans[planId - 1].monthlyPrice;
        uint256 elapsed = block.timestamp - lastAccrued[user];
        return covered > elapsed ? covered - elapsed : 0;
    }

    function planCount() external view returns (uint256) {
        return plans.length;
    }

    // ------------------------------------------------------------------
    // Owner
    // ------------------------------------------------------------------

    /// @notice Claim accrued revenue. The only privileged function in the
    ///         contract, and it can only reach `totalRevenue` — customer
    ///         credit is refundable only to the customer.
    function claimRevenue() external onlyOwner nonReentrant {
        uint256 amount = totalRevenue;
        if (amount == 0) revert ZeroAmount();
        totalRevenue = 0;
        paymentToken.safeTransfer(owner(), amount);
        emit RevenueClaimed(owner(), amount);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _activate(uint8 planId) internal {
        if (planId == 0 || planId > plans.length) revert InvalidPlan(planId);
        if (credits[msg.sender] == 0) revert NoCredit();
        planOf[msg.sender] = planId;
        lastAccrued[msg.sender] = uint64(block.timestamp);
        emit Subscribed(msg.sender, planId);
    }

    /// @dev Lazily charge for elapsed time. If credit runs out mid-window,
    ///      the whole remaining balance is charged and the plan is cleared.
    ///      `exhaustedAt` pins the moment the balance hit zero, so no free
    ///      time is granted and no overcharge occurs (both sides lose at
    ///      most one second's worth of accrual, i.e. < 3 micro-dollars).
    function _settle(address user) internal {
        uint8 planId = planOf[user];
        if (planId == 0) return;
        uint256 bal = credits[user];
        uint256 elapsed = block.timestamp - lastAccrued[user];
        uint256 price = plans[planId - 1].monthlyPrice;
        uint256 charge = price * elapsed / MONTH;
        if (charge < bal) {
            credits[user] = bal - charge;
            totalRevenue += charge;
            lastAccrued[user] = uint64(block.timestamp);
        } else {
            uint64 exhaustedAt = lastAccrued[user] + uint64(bal * MONTH / price);
            credits[user] = 0;
            totalRevenue += bal;
            planOf[user] = 0;
            lastAccrued[user] = uint64(block.timestamp);
            emit Lapsed(user, planId, bal, exhaustedAt);
        }
    }
}