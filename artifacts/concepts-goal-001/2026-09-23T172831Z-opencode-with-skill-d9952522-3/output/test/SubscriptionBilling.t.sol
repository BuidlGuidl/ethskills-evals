// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling, IERC20} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    MockUSDC usdc;
    SubscriptionBilling billing;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint128 constant HOBBY = 5e6; // $5 / 30 days
    uint128 constant PRO = 20e6; // $20 / 30 days
    uint256 hobbyId;
    uint256 proId;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner);
        vm.startPrank(owner);
        hobbyId = billing.createPlan(HOBBY);
        proId = billing.createPlan(PRO);
        vm.stopPrank();

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(billing), type(uint256).max);
    }

    // -- plan setup ----------------------------------------------------

    function test_planIdsStartAtOne() public view {
        assertEq(hobbyId, 1);
        assertEq(proId, 2);
        assertEq(billing.plansCount(), 3);
    }

    function test_onlyOwnerCreatesPlans() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.OnlyOwner.selector);
        billing.createPlan(1e6);
    }

    // -- deposit / subscribe -------------------------------------------

    function test_depositAndSubscribe() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.effectiveBalance(alice), 100e6);
        (uint256 balance, uint256 planId,) = billing.accounts(alice);
        assertEq(balance, 100e6);
        assertEq(planId, hobbyId);
    }

    function test_subscribeRequiresBalance() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NoBalance.selector);
        billing.subscribe(hobbyId);
    }

    function test_subscribeRejectsInactivePlan() public {
        vm.prank(owner);
        billing.setPlanActive(hobbyId, false);
        vm.startPrank(alice);
        billing.deposit(10e6);
        vm.expectRevert(SubscriptionBilling.PlanNotActive.selector);
        billing.subscribe(hobbyId);
        vm.stopPrank();
    }

    // -- accrual ---------------------------------------------------------

    function test_accruesOneMonth() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        vm.stopPrank();

        skip(30 days);

        // $5 consumed, $95 left; still subscribed by a hair is false only past 600 days
        assertEq(billing.effectiveBalance(alice), 95e6);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_proAccruesFaster() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(proId);
        vm.stopPrank();

        skip(30 days);
        assertEq(billing.effectiveBalance(alice), 80e6);
    }

    function test_subscriptionLapsesWhenBalanceRunsOut() public {
        vm.startPrank(alice);
        billing.deposit(5e6); // exactly one hobby month
        billing.subscribe(hobbyId);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(alice));
        skip(30 days + 1);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.effectiveBalance(alice), 0);
    }

    function test_owedNeverExceedsBalance() public {
        vm.startPrank(alice);
        billing.deposit(5e6);
        billing.subscribe(hobbyId);
        vm.stopPrank();

        skip(365 days);
        billing.settle(alice);
        (uint256 balance,,) = billing.accounts(alice);
        assertEq(balance, 0); // clamped at zero, not negative
        assertEq(billing.accrued(), 5e6); // operator got exactly what was deposited
    }

    // -- settle ---------------------------------------------------------

    function test_anyoneCanSettle() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        vm.stopPrank();

        skip(30 days);
        vm.prank(bob); // a stranger
        billing.settle(alice);

        (uint256 balance,, uint40 lastSettled) = billing.accounts(alice);
        assertEq(balance, 95e6);
        assertEq(lastSettled, uint40(block.timestamp));
        assertEq(billing.accrued(), 5e6);
    }

    // -- cancel / withdraw ------------------------------------------------

    function test_cancelRefundsUnused() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        skip(15 days); // half a month: $2.50 used
        billing.cancel();
        vm.stopPrank();

        assertFalse(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(alice), 900e6 + 97.5e6);
        assertEq(billing.accrued(), 2.5e6);
    }

    function test_cancelWithoutSubscriptionReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_partialWithdraw() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        billing.withdraw(60e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 960e6);
        assertTrue(billing.isSubscribed(alice)); // 40e6 still covers ~8 months
    }

    function test_switchPlans() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        skip(30 days); // $5 used
        billing.subscribe(proId);
        vm.stopPrank();

        skip(30 days); // $20 more
        assertEq(billing.effectiveBalance(alice), 75e6);
    }

    // -- revenue -----------------------------------------------------------

    function test_ownerWithdrawsOnlyAccrued() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        vm.stopPrank();

        // Nothing accrued yet: owner cannot touch user funds.
        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.withdrawRevenue(owner, 1);

        skip(30 days);
        billing.settle(alice);

        vm.prank(owner);
        billing.withdrawRevenue(owner, 5e6);
        assertEq(usdc.balanceOf(owner), 5e6);

        // And not a cent more.
        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.withdrawRevenue(owner, 1);
    }

    function test_onlyOwnerWithdrawsRevenue() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.OnlyOwner.selector);
        billing.withdrawRevenue(alice, 1);
    }

    // -- plan immutability ---------------------------------------------------

    function test_deactivatingPlanKeepsExistingSubscribers() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        vm.stopPrank();

        vm.prank(owner);
        billing.setPlanActive(hobbyId, false);

        // Alice keeps accruing at the original rate.
        skip(30 days);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.effectiveBalance(alice), 95e6);

        // Bob cannot join the deactivated plan.
        vm.startPrank(bob);
        billing.deposit(100e6);
        vm.expectRevert(SubscriptionBilling.PlanNotActive.selector);
        billing.subscribe(hobbyId);
        vm.stopPrank();
    }

    function test_plansAreImmutable() public view {
        // There is no function to edit a plan's rate; deactivation is the only lever.
        (uint128 rate, bool active) = billing.plans(hobbyId);
        assertEq(rate, HOBBY);
        assertTrue(active);
    }

    // -- subscribedUntil ------------------------------------------------------

    function test_subscribedUntil() public {
        vm.startPrank(alice);
        billing.deposit(10e6); // two hobby months
        billing.subscribe(hobbyId);
        vm.stopPrank();

        assertEq(billing.subscribedUntil(alice), block.timestamp + 60 days);
        assertEq(billing.subscribedUntil(bob), type(uint256).max);
    }

    // -- rounding favors the user ----------------------------------------------

    function test_subSecondRoundingIsInUsersFavor() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(hobbyId);
        vm.stopPrank();

        skip(1); // one second: 5e6 * 1 / 2592000 = 1.92... -> 1 unit
        assertEq(billing.effectiveBalance(alice), 100e6 - 1);
    }
}
