// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {WeatherBilling, IERC20} from "../src/WeatherBilling.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract WeatherBillingTest is Test {
    MockUSDC usdc;
    WeatherBilling billing;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob"); // used as "anyone else"
    address treasury = makeAddr("treasury");

    uint256 constant HOBBY = 5e6;
    uint256 constant PRO = 20e6;
    uint256 constant MONTH = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new WeatherBilling(usdc, treasury, HOBBY, PRO);
    }

    function _fund(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _topUp(address user, uint256 amount) internal {
        vm.prank(user);
        billing.topUp(amount);
    }

    function _subscribe(address user, WeatherBilling.Plan plan, uint256 fund) internal {
        _fund(user, fund);
        _topUp(user, fund);
        vm.prank(user);
        billing.subscribe(plan);
    }

    // ------------------------------------------------------------------
    // Topping up
    // ------------------------------------------------------------------

    function test_topUp_creditsBalance() public {
        _fund(alice, 50e6);
        _topUp(alice, 50e6);

        assertEq(billing.credit(alice), 50e6);
        assertEq(usdc.balanceOf(address(billing)), 50e6);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(usdc.allowance(alice, address(billing)), type(uint256).max - 50e6);
    }

    function test_topUp_revertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.ZeroAmount.selector);
        billing.topUp(0);
    }

    // ------------------------------------------------------------------
    // Subscribing
    // ------------------------------------------------------------------

    function test_subscribe_buysFirstMonth() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);

        assertEq(uint8(billing.plan(alice)), uint8(WeatherBilling.Plan.Hobby));
        assertEq(billing.paidUntil(alice), block.timestamp + MONTH);
        assertEq(billing.credit(alice), 0);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_subscribe_buysAsManyMonthsAsCreditAllows() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, 3 * HOBBY);

        assertEq(billing.paidUntil(alice), block.timestamp + 3 * MONTH);
        assertEq(billing.credit(alice), 0);
    }

    function test_subscribe_capsAtTwelveMonthsAhead() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, 100 * HOBBY);

        assertEq(billing.paidUntil(alice), block.timestamp + 12 * MONTH);
        assertEq(billing.credit(alice), 88 * HOBBY);

        // further touches do not push past the cap
        vm.prank(alice);
        billing.settle(alice);
        assertEq(billing.paidUntil(alice), block.timestamp + 12 * MONTH);
    }

    function test_subscribe_revertsOnNone() public {
        _fund(alice, HOBBY);
        _topUp(alice, HOBBY);
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.InvalidPlan.selector);
        billing.subscribe(WeatherBilling.Plan.None);
    }

    function test_subscribe_samePlanWhileActiveReverts() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        _fund(alice, HOBBY);
        _topUp(alice, HOBBY);

        vm.prank(alice);
        vm.expectRevert(WeatherBilling.AlreadyOnPlan.selector);
        billing.subscribe(WeatherBilling.Plan.Hobby);
    }

    function test_subscribe_withoutCreditKeepsPlanForLater() public {
        // choosing a plan before funding: nothing charged, not subscribed yet
        vm.prank(alice);
        billing.subscribe(WeatherBilling.Plan.Pro);

        assertEq(uint8(billing.plan(alice)), uint8(WeatherBilling.Plan.Pro));
        assertFalse(billing.isSubscribed(alice));

        // funding it later starts the subscription
        _fund(alice, PRO);
        _topUp(alice, PRO);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.paidUntil(alice), block.timestamp + MONTH);
    }

    // ------------------------------------------------------------------
    // The no-cron property: time alone lapses a subscription
    // ------------------------------------------------------------------

    function test_subscription_lapsesByTimeWithoutAnyTransaction() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);

        vm.warp(block.timestamp + MONTH + 1);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_isSubscribed_falseExactlyAtPaidUntil() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);

        vm.warp(billing.paidUntil(alice));
        assertFalse(billing.isSubscribed(alice));
    }

    function test_topUp_autoRenewsBeforeExpiry() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, 6e6); // 1 month + 1 credit

        vm.warp(block.timestamp + 29 days);
        assertTrue(billing.isSubscribed(alice));

        uint256 paidUntilBefore = billing.paidUntil(alice);
        _fund(alice, 5e6);
        _topUp(alice, 5e6); // any touch buys the due month seamlessly

        assertEq(billing.paidUntil(alice), paidUntilBefore + MONTH);
        assertEq(billing.credit(alice), 1e6);
        assertTrue(billing.isSubscribed(alice));
    }

    // ------------------------------------------------------------------
    // Lapse and restart: never back-bill
    // ------------------------------------------------------------------

    function test_lapse_restartsFromNowWithoutBackBilling() public {
        uint256 start = block.timestamp;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);

        vm.warp(start + 100 days); // 70 days past expiry, idle, no credit
        assertFalse(billing.isSubscribed(alice));

        _fund(alice, HOBBY);
        _topUp(alice, HOBBY);

        // the new month starts now, not 70 days of arrears
        assertEq(billing.paidUntil(alice), block.timestamp + MONTH);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_settle_isPermissionlessAndCannotActWithoutUserChoice() public {
        // credit but no plan chosen: a stranger's settle must be a no-op
        _fund(alice, 5e6);
        _topUp(alice, 5e6);

        vm.prank(bob);
        billing.settle(alice);

        assertEq(billing.credit(alice), 5e6);
        assertEq(billing.paidUntil(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_settle_byStrangerExtendsWithUsersOwnCredit() public {
        // prepay to the cap, then leave fresh credit that only becomes spendable
        // as the cap recedes - a stranger can trigger that renewal
        _subscribe(alice, WeatherBilling.Plan.Hobby, 60e6); // 12 months, cap reached
        _fund(alice, HOBBY);
        _topUp(alice, HOBBY); // parked: cap blocks the purchase
        assertEq(billing.credit(alice), HOBBY);

        vm.warp(block.timestamp + 350 days); // 10 days of cover left
        vm.prank(bob);
        billing.settle(alice); // buys the next month from alice's credit

        assertEq(billing.paidUntil(alice), block.timestamp + 40 days);
        assertEq(billing.credit(alice), 0);
        assertTrue(billing.isSubscribed(alice));
    }

    // ------------------------------------------------------------------
    // Cancelling and proration
    // ------------------------------------------------------------------

    function test_cancel_midMonthRefundsProratedPlusCredit() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, 10e6); // 2 months prepaid

        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), 7.5e6); // 1.5 unused months back
        assertEq(usdc.balanceOf(address(billing)), 2.5e6); // the consumed half stays as revenue
        assertEq(billing.earnedPot(), 2.5e6);
        assertEq(uint8(billing.plan(alice)), uint8(WeatherBilling.Plan.None));
        assertEq(billing.paidUntil(alice), 0);
        assertEq(billing.credit(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancel_afterFullMonthsRefundsOnlyCredit() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, 12e6); // 2 months + 2 credit

        vm.warp(block.timestamp + 65 days); // 5 days past the last paid month
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), 2e6); // only the leftover credit
        assertEq(billing.earnedPot(), 10e6); // both months fully consumed
        assertEq(usdc.balanceOf(address(billing)), 10e6);
    }

    function test_cancel_withOnlyCreditIsAPlainWithdrawal() public {
        _fund(alice, 7e6);
        _topUp(alice, 7e6);

        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 7e6);
    }

    function test_cancel_withNothingReverts() public {
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NothingToCancel.selector);
        billing.cancel();
    }

    function testFuzz_cancelConservesValue(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, MONTH);
        uint256 start = block.timestamp;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);

        vm.warp(start + elapsed);
        vm.prank(alice);
        billing.cancel();

        uint256 returned = usdc.balanceOf(alice);
        uint256 recognized = billing.earnedPot();
        // proration floors on both sides: at most 1 wei-USDC of rounding dust
        // stays behind in the contract per settled span
        assertLe(returned + recognized, HOBBY);
        assertGe(returned + recognized + 1, HOBBY);
        assertGe(usdc.balanceOf(address(billing)), recognized);
        assertLe(usdc.balanceOf(address(billing)), recognized + 1);
    }

    // ------------------------------------------------------------------
    // Plan changes
    // ------------------------------------------------------------------

    function test_planChange_creditsUnusedAndStartsImmediately() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, 30e6); // 1 month + 25 credit
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.subscribe(WeatherBilling.Plan.Pro);

        // 2.5 (unused half month) + 25 credit - 20 pro month
        assertEq(billing.credit(alice), 7.5e6);
        assertEq(billing.paidUntil(alice), block.timestamp + MONTH);
        assertEq(uint8(billing.plan(alice)), uint8(WeatherBilling.Plan.Pro));
        assertTrue(billing.isSubscribed(alice));
    }

    function test_planChange_withoutFundsKeepsPlanUnsubscribed() public {
        _subscribe(alice, WeatherBilling.Plan.Pro, PRO); // 1 month, no credit
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.subscribe(WeatherBilling.Plan.Hobby); // 10 credit < ... credit = 10, hobby needs 5 -> buys

        // unused half of pro month = 10 credited, then buys 2 hobby months
        assertEq(billing.credit(alice), 0);
        assertEq(billing.paidUntil(alice), block.timestamp + 2 * MONTH);
        assertEq(uint8(billing.plan(alice)), uint8(WeatherBilling.Plan.Hobby));
    }

    // ------------------------------------------------------------------
    // Revenue accounting and collection
    // ------------------------------------------------------------------

    function test_collect_paysOnlyEarnedRevenue() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.warp(block.timestamp + 15 days);

        // earnedPot lags until the user (or anyone) touches the account
        vm.prank(bob);
        billing.settle(alice);
        assertEq(billing.pendingCollect(), 2.5e6);

        vm.prank(bob); // permissionless
        billing.collect();

        assertEq(usdc.balanceOf(treasury), 2.5e6);
        assertEq(billing.collectedTotal(), 2.5e6);

        // the remaining half is still fully refundable to the customer
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 2.5e6);
        assertEq(usdc.balanceOf(address(billing)), 0);
    }

    function test_collect_recognisesLapsedRevenueOnSettle() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.warp(block.timestamp + MONTH + 5 days);

        // earnedPot lags until someone touches alice
        assertEq(billing.earnedPot(), 0);

        vm.prank(bob);
        billing.settle(alice);
        assertEq(billing.earnedPot(), HOBBY);

        vm.prank(treasury);
        billing.collect();
        assertEq(usdc.balanceOf(treasury), HOBBY);
    }

    function test_collect_zeroIsHarmlessNoOp() public {
        vm.prank(bob);
        billing.collect();
        assertEq(billing.collectedTotal(), 0);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_topUpAfterLapse_keepsEarnedPotWhole() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.warp(block.timestamp + 100 days);

        // the touch that restarts the sub must not lose the old month's revenue
        _fund(alice, HOBBY);
        _topUp(alice, HOBBY);

        assertEq(billing.earnedPot(), HOBBY);
        assertTrue(billing.isSubscribed(alice));
    }

    // ------------------------------------------------------------------
    // Read helpers
    // ------------------------------------------------------------------

    function test_getAccount() public {
        _subscribe(alice, WeatherBilling.Plan.Pro, 25e6); // 1 month + 5 credit
        vm.warp(block.timestamp + 10 days);

        (WeatherBilling.Plan p, uint256 until, uint256 cred, uint256 price) = billing.getAccount(alice);
        assertEq(uint8(p), uint8(WeatherBilling.Plan.Pro));
        assertEq(until, block.timestamp + 20 days);
        assertEq(cred, 5e6);
        assertEq(price, PRO);
    }
}
