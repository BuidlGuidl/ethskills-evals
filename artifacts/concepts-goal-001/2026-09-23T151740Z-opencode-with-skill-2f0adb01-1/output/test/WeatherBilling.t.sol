// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract WeatherBillingTest is Test {
    uint96 constant HOBBY = 5e6; // $5 / 30 days
    uint96 constant PRO = 20e6;  // $20 / 30 days
    uint32 constant PERIOD = 30 days;

    MockUSDC usdc;
    WeatherBilling billing;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockUSDC();
        billing = new WeatherBilling(address(usdc), address(this)); // test contract = owner
        billing.addPlan(HOBBY, PERIOD); // plan 1
        billing.addPlan(PRO, PERIOD);   // plan 2
    }

    /// Mints USDC to `user` and approves the billing contract for `amount`.
    function _fund(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(billing), amount);
    }

    function _start(uint256 fund, uint16 planId) internal {
        _fund(alice, fund);
        vm.startPrank(alice);
        billing.topUp(fund);
        billing.subscribe(planId);
        vm.stopPrank();
    }

    // ------------------------------------------------------------- happy path

    function test_TopUpAndSubscribeGrantsOnePeriodOfCoverage() public {
        _start(5e6, 1);
        uint256 t0 = block.timestamp;

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.coveredUntil(alice), t0 + 30 days);
        (uint176 bal,,) = billing.account(alice);
        assertEq(bal, 5e6);
        assertEq(usdc.balanceOf(address(billing)), 5e6);
    }

    function test_ViewIsTruthfulWithoutAnyTransaction() public {
        _start(5e6, 1);
        // Nobody calls anything; the view must still track time correctly.
        vm.warp(block.timestamp + 30 days - 1 seconds);
        assertTrue(billing.isSubscribed(alice)); // last covered second
        vm.warp(block.timestamp + 1 seconds);
        assertFalse(billing.isSubscribed(alice)); // coverage is [T0, T0+30d)
    }

    function test_CancelImmediatelyRefundsEverything() public {
        _start(5e6, 1);

        vm.prank(alice);
        billing.cancel();

        assertFalse(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(alice), 5e6);
        assertEq(usdc.balanceOf(address(billing)), 0);
    }

    // ------------------------------------------------------- charging by time

    function test_ChargesAccrueLazilyAndCancelRefundsUnspent() public {
        _start(5e6, 1);
        vm.warp(block.timestamp + 10 days);

        assertTrue(billing.isSubscribed(alice));
        vm.prank(alice);
        billing.cancel();

        // 10 of 30 days used: owed = 864000 * 5e6 / 2592000 = 1666666 (floor)
        assertEq(usdc.balanceOf(alice), 5e6 - 1666666);
        // one micro-cent of rounding, in the customer's favor
        assertEq(billing.revenue(), 1666666);
    }

    function test_RoundingIsFlooredAndTiny() public {
        _start(5e6, 1);
        vm.warp(block.timestamp + 1 seconds);

        vm.prank(alice);
        billing.cancel();

        // owed = floor(1 * 5e6 / 2592000) = 1 unit = $0.000001
        assertEq(usdc.balanceOf(alice), 5e6 - 1);
    }

    function test_TopupMidstreamExtendsCoverage() public {
        _start(5e6, 1);
        uint256 t0 = block.timestamp;
        vm.warp(t0 + 15 days);

        _fund(alice, 5e6);
        vm.startPrank(alice);
        billing.topUp(5e6);
        vm.stopPrank();

        // 15 days charged at hobby rate, remaining 2.5e6 (15 days) + fresh 5e6
        // (30 days) = 45 more days from the topup moment.
        assertEq(billing.coveredUntil(alice), t0 + 60 days);
        assertTrue(billing.isSubscribed(alice));
    }

    // --------------------------------------------------------------- lapsing

    function test_LapseIsSilentAndDryAccountRefundsNothing() public {
        _start(5e6, 1);
        vm.warp(block.timestamp + 45 days);

        assertFalse(billing.isSubscribed(alice)); // lapsed 15 days ago, no tx needed
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), 0); // the month was fully used
        assertEq(billing.revenue(), 5e6);
    }

    function test_LapsedGapIsNeverCharged() public {
        _start(5e6, 1); // covered through T0 + 30 days
        vm.warp(block.timestamp + 45 days); // 15 days of gap

        _fund(alice, 1e6);
        vm.startPrank(alice);
        billing.topUp(1e6); // must restart from now, not charge the gap
        vm.stopPrank();

        assertTrue(billing.isSubscribed(alice));
        (uint176 bal,,) = billing.account(alice);
        assertEq(bal, 1e6); // gap charged nothing

        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        billing.cancel();
        // 3 days of hobby = 259200 * 5e6 / 2592000 = 500000
        assertEq(usdc.balanceOf(alice), 500000);
    }

    // ------------------------------------------------------------ plan changes

    function test_PlanSwitchProratesBothDirections() public {
        _start(5e6, 1); // plan 1, hobby
        vm.warp(block.timestamp + 15 days); // consumed exactly 2.5e6

        vm.prank(alice);
        billing.subscribe(2); // switch to pro

        // 15 days charged at hobby rate, then 2.5e6 buys 324000s at pro rate
        assertEq(billing.revenue(), 2.5e6);
        assertEq(billing.coveredUntil(alice), block.timestamp + uint256(2.5e6) * PERIOD / PRO);

        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 2.5e6);
    }

    function test_SubscribeWithZeroBalanceGrantsNoCoverage() public {
        vm.prank(alice);
        billing.subscribe(1);
        // plan set, balance zero: coveredUntil == lastSettle == now, so no coverage
        assertFalse(billing.isSubscribed(alice));
        vm.warp(block.timestamp + 1 seconds);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_DisabledPlanBlocksNewSubsOnly() public {
        billing.setPlanEnabled(1, false);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(WeatherBilling.PlanDisabled.selector, 1));
        billing.subscribe(1);

        // an existing subscriber is unaffected by the flag
        billing.setPlanEnabled(1, true); // re-offer so alice can subscribe
        _start(5e6, 1);
        billing.setPlanEnabled(1, false);
        vm.warp(block.timestamp + 10 days);
        assertTrue(billing.isSubscribed(alice));
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 5e6 - 1666666);
    }

    function test_InvalidPlanSelectorsRevert() public {
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.InvalidPlan.selector);
        billing.subscribe(0);

        vm.prank(alice);
        vm.expectRevert(WeatherBilling.InvalidPlan.selector);
        billing.subscribe(3);

        vm.expectRevert(WeatherBilling.InvalidPlan.selector);
        billing.setPlanEnabled(3, true);
    }

    // ----------------------------------------------------------------- revenue

    function test_RevenueIsLazyAndOwnerCanOnlyTakeWhatStreamsConsumed() public {
        _start(5e6, 1);
        vm.warp(block.timestamp + 10 days);

        // 10 days passed, but nobody touched alice's account:
        // nothing has been *realized* into the revenue counter yet.
        billing.collectRevenue(treasury);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(usdc.balanceOf(address(billing)), 5e6); // deposits still there

        // the touch happens — cancel settles, revenue is realized
        vm.prank(alice);
        billing.cancel();
        assertEq(billing.revenue(), 1666666);

        uint256 got = billing.collectRevenue(treasury);
        assertEq(got, 1666666);
        assertEq(usdc.balanceOf(treasury), 1666666);
        // refund + revenue collection have emptied the contract
        assertEq(usdc.balanceOf(address(billing)), 0);
    }

    function test_PokeRealizesRevenueWithoutHarmingTheUser() public {
        _start(5e6, 1);
        vm.warp(block.timestamp + 10 days);

        billing.poke(alice); // anyone may call
        assertEq(billing.revenue(), 1666666);

        vm.warp(block.timestamp + 5 days);
        vm.prank(alice);
        billing.cancel();
        // 5 more days = 432000 * 5e6 / 2592000 = 833333
        assertEq(usdc.balanceOf(alice), 5e6 - 1666666 - 833333);
        assertEq(billing.revenue(), 1666666 + 833333);
    }

    function test_CollectBalanceInvariantHolds() public {
        // contract USDC == sum(user balances) + revenue, at all times
        _start(5e6, 1);
        _fund(bob, 20e6);
        vm.prank(bob);
        billing.topUp(20e6);

        vm.warp(block.timestamp + 10 days);
        billing.poke(alice);
        vm.prank(bob);
        billing.cancel();

        // contract USDC == sum(user balances) + uncollected revenue
        (uint176 aBal,,) = billing.account(alice);
        assertEq(usdc.balanceOf(address(billing)), uint256(aBal) + billing.revenue());

        billing.collectRevenue(treasury);
        assertEq(usdc.balanceOf(treasury), 1666666);
        assertEq(usdc.balanceOf(address(billing)), uint256(aBal) + billing.revenue());
    }

    // ------------------------------------------------------------ access rules

    function test_TopUpRequiresApproval() public {
        usdc.mint(alice, 5e6); // no approve
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.TransferFailed.selector);
        billing.topUp(5e6);
    }

    function test_TopUpZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.InvalidAmount.selector);
        billing.topUp(0);
    }

    function test_OwnerFunctionsRejectNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.addPlan(1e6, 30 days);

        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.collectRevenue(alice);

        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.setPlanEnabled(1, false);

        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.transferOwnership(alice);
    }

    function test_AddPlanValidation() public {
        vm.expectRevert(WeatherBilling.InvalidPrice.selector);
        billing.addPlan(0, 30 days);
        vm.expectRevert(WeatherBilling.InvalidPrice.selector);
        billing.addPlan(5e6, 0);

        uint16 id = billing.addPlan(10e6, 30 days);
        assertEq(id, 3);
        assertEq(billing.planCount(), 3);
    }

    function test_OwnershipTransfer() public {
        billing.transferOwnership(alice);
        vm.prank(alice);
        billing.addPlan(1e6, 7 days); // alice can now manage plans
        assertEq(billing.planCount(), 3);

        vm.prank(bob); // old owner lost power
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.addPlan(1e6, 7 days);
    }
}
