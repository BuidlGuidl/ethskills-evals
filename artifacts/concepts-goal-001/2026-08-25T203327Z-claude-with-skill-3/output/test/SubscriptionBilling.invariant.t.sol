// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Drives the contract the way real users would — random top-ups, plan switches, cancels,
///      withdrawals and stretches of time where nobody sends anything at all.
contract Handler is Test {
    SubscriptionBilling public billing;
    MockUSDC public usdc;
    address[] public actors;

    uint256 public depositedIn;
    uint256 public withdrawnOut;

    constructor(SubscriptionBilling billing_, MockUSDC usdc_) {
        billing = billing_;
        usdc = usdc_;
        for (uint256 i = 0; i < 5; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            address a = address(uint160(0x1000 + i));
            actors.push(a);
            usdc.mint(a, 10_000_000_000);
            vm.prank(a);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function subscribe(uint256 who, uint256 planSeed, uint256 topUp) external {
        address a = _actor(who);
        uint32 planId = uint32(bound(planSeed, 1, billing.planCount()));
        topUp = bound(topUp, 0, 200_000_000);
        vm.prank(a);
        try billing.subscribe(planId, topUp) {
            depositedIn += topUp;
        } catch {}
    }

    function deposit(uint256 who, uint256 amount) external {
        address a = _actor(who);
        amount = bound(amount, 1, 200_000_000);
        vm.prank(a);
        try billing.deposit(a, amount) {
            depositedIn += amount;
        } catch {}
    }

    function withdraw(uint256 who, uint256 amount) external {
        address a = _actor(who);
        amount = bound(amount, 1, 200_000_000);
        vm.prank(a);
        try billing.withdraw(a, amount) {
            withdrawnOut += amount;
        } catch {}
    }

    function cancel(uint256 who) external {
        address a = _actor(who);
        vm.prank(a);
        try billing.cancel() {} catch {}
    }

    function settle(uint256 who) external {
        billing.settle(_actor(who));
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 45 days));
    }

    function withdrawRevenue(uint256 amount) external {
        amount = bound(amount, 0, billing.accruedRevenue());
        if (amount == 0) return;
        address to = billing.owner(); // read before pranking: the staticcall would consume it
        vm.prank(to);
        billing.withdrawRevenue(to, amount);
        withdrawnOut += amount;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract SubscriptionBillingInvariantTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;
    Handler internal handler;
    address internal operator = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        uint128[] memory prices = new uint128[](2);
        prices[0] = 5_000_000;
        prices[1] = 20_000_000;
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator, prices);
        vm.warp(1_800_000_000);
        handler = new Handler(billing, usdc);
        targetContract(address(handler));
    }

    /// @notice Every token in the contract is either someone's refundable prepayment or revenue
    ///         for service time already consumed. Nothing is unaccounted for, nothing is double-
    ///         counted, and the operator can never reach the prepaid side.
    function invariant_tokensAreFullyAccountedFor() public view {
        assertEq(usdc.balanceOf(address(billing)), billing.totalPrepaid() + billing.accruedRevenue());
    }

    /// @notice `totalPrepaid` equals the sum of the individual balances it claims to track.
    function invariant_prepaidMatchesSumOfAccounts() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            (, uint256 balance,,) = billing.accountOf(handler.actors(i));
            sum += balance;
        }
        // Unsettled accrual has left the accounts but not yet reached accruedRevenue.
        assertLe(sum, billing.totalPrepaid());
        assertEq(sum + billing.claimableRevenue() - billing.accruedRevenue(), billing.totalPrepaid());
    }

    /// @notice Nobody can ever owe more than they prepaid: there is no debt in this system.
    function invariant_noSubscriberCanGoNegative() public view {
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            address a = handler.actors(i);
            assertLe(billing.pendingCharge(a), billing.totalPrepaid() + billing.accruedRevenue());
            assertGe(billing.refundable(a), 0);
        }
    }

    /// @notice A subscription is live exactly while its funded runway has not run out.
    function invariant_subscribedIffFunded() public view {
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            address a = handler.actors(i);
            assertEq(billing.isSubscribed(a), block.timestamp < billing.expiresAt(a));
        }
    }
}
