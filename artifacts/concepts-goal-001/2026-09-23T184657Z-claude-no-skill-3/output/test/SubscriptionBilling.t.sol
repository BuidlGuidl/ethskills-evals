// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    uint256 constant HOBBY = 5e6; // $5.00
    uint256 constant PRO = 20e6; // $20.00
    uint8 constant HOBBY_ID = 1;
    uint8 constant PRO_ID = 2;
    uint64 constant PERIOD = 30 days;

    MockUSDC usdc;
    SubscriptionBilling billing;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.warp(1_700_000_000); // avoid timestamp 0 edge cases
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), merchant, HOBBY, PRO);
        _fund(alice, 1000e6);
        _fund(bob, 1000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _subscribed(address who, uint256 topUp, uint8 planId) internal {
        vm.prank(who);
        billing.depositAndSubscribe(topUp, planId);
    }

    /// @dev The contract must always hold at least what it owes customers plus booked revenue.
    function _assertSolvent() internal view {
        assertGe(
            usdc.balanceOf(address(billing)), billing.customerFunds() + billing.accruedRevenue(), "insolvent"
        );
    }

    // ------------------------------------------------------------------
    // Deposits and withdrawals
    // ------------------------------------------------------------------

    function test_depositCreditsBalanceAndIsWithdrawable() public {
        vm.prank(alice);
        billing.deposit(60e6);

        (,,, uint256 balance,) = billing.statusOf(alice);
        assertEq(balance, 60e6);
        assertEq(billing.customerFunds(), 60e6);

        vm.prank(alice);
        billing.withdraw(60e6);
        assertEq(usdc.balanceOf(alice), 1000e6);
        assertEq(billing.customerFunds(), 0);
        _assertSolvent();
    }

    function test_depositForCreditsTheBeneficiaryNotThePayer() public {
        vm.prank(alice);
        billing.depositFor(bob, 25e6);

        (,,, uint256 aliceBal,) = billing.statusOf(alice);
        (,,, uint256 bobBal,) = billing.statusOf(bob);
        assertEq(aliceBal, 0);
        assertEq(bobBal, 25e6);
        assertEq(usdc.balanceOf(alice), 975e6);
    }

    function test_withdrawCannotTouchEscrowOrOthersFunds() public {
        _subscribed(alice, 60e6, HOBBY_ID); // 5 escrowed, 55 free

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 55e6, 56e6));
        billing.withdraw(56e6);

        vm.prank(alice);
        billing.withdraw(55e6);
        assertTrue(billing.isSubscribed(alice), "still subscribed after emptying balance");
        _assertSolvent();
    }

    // ------------------------------------------------------------------
    // Subscribing
    // ------------------------------------------------------------------

    function test_subscribeChargesFirstPeriodUpFront() public {
        _subscribed(alice, 60e6, HOBBY_ID);

        (bool active, uint8 planId, uint64 until, uint256 balance, uint256 escrow) = billing.statusOf(alice);
        assertTrue(active);
        assertEq(planId, HOBBY_ID);
        assertEq(until, block.timestamp + PERIOD);
        assertEq(balance, 55e6);
        assertEq(escrow, HOBBY);
        assertEq(billing.accruedRevenue(), 0, "nothing earned before the period elapses");
    }

    function test_subscribeRevertsWithoutEnoughCredit() public {
        vm.startPrank(alice);
        billing.deposit(4e6);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 4e6, HOBBY));
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();
    }

    function test_subscribeRevertsOnUnknownPlan() public {
        vm.startPrank(alice);
        billing.deposit(60e6);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, uint8(7)));
        billing.subscribe(7);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, uint8(0)));
        billing.subscribe(0);
        vm.stopPrank();
    }

    function test_cannotDoubleSubscribe() public {
        _subscribed(alice, 60e6, HOBBY_ID);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.AlreadySubscribed.selector, HOBBY_ID));
        billing.subscribe(PRO_ID);
    }

    // ------------------------------------------------------------------
    // Renewals
    // ------------------------------------------------------------------

    function test_renewsAutomaticallyWhileFundsLast() public {
        _subscribed(alice, 20e6, HOBBY_ID); // 4 periods of headroom in total

        for (uint256 i = 1; i <= 3; i++) {
            vm.warp(block.timestamp + PERIOD);
            assertTrue(billing.isSubscribed(alice), "renewal should be automatic");
            (,,, uint256 balance, uint256 escrow) = billing.statusOf(alice);
            assertEq(balance, 20e6 - (i + 1) * HOBBY);
            assertEq(escrow, HOBBY);
        }

        // Fourth period ends with nothing left to renew with.
        vm.warp(block.timestamp + PERIOD);
        assertFalse(billing.isSubscribed(alice), "should lapse when credit runs out");
    }

    function test_viewsAreCorrectWithoutAnyoneSettling() public {
        _subscribed(alice, 20e6, HOBBY_ID);
        uint64 start = uint64(block.timestamp);

        vm.warp(start + PERIOD * 2 + 1 days);

        // Storage is stale...
        SubscriptionBilling.Subscription memory raw = billing.rawSubscription(alice);
        assertEq(raw.renewsAt, start + PERIOD);
        // ...but the view projects forward.
        (bool active,, uint64 until, uint256 balance,) = billing.statusOf(alice);
        assertTrue(active);
        assertEq(until, start + PERIOD * 3);
        assertEq(balance, 20e6 - 3 * HOBBY);

        // Settling writes exactly what the view already reported, and books the revenue.
        billing.settle(alice);
        raw = billing.rawSubscription(alice);
        assertEq(raw.renewsAt, until);
        assertEq(raw.balance, balance);
        assertEq(billing.accruedRevenue(), 2 * HOBBY, "two elapsed periods earned");
        _assertSolvent();
    }

    function test_settleIsIdempotentAndPermissionless() public {
        _subscribed(alice, 20e6, HOBBY_ID);
        vm.warp(block.timestamp + PERIOD + 1);

        vm.prank(bob);
        billing.settle(alice);
        uint256 revenue = billing.accruedRevenue();
        SubscriptionBilling.Subscription memory a = billing.rawSubscription(alice);

        vm.prank(bob);
        billing.settle(alice);
        SubscriptionBilling.Subscription memory b = billing.rawSubscription(alice);

        assertEq(billing.accruedRevenue(), revenue);
        assertEq(abi.encode(a), abi.encode(b));
    }

    function test_settleOfLongDormantAccountCostsConstantGas() public {
        _subscribed(alice, 20e6, HOBBY_ID);
        _subscribed(bob, 20e6, HOBBY_ID);

        vm.warp(block.timestamp + PERIOD + 1);
        uint256 g0 = gasleft();
        billing.settle(alice);
        uint256 shortGap = g0 - gasleft();

        vm.warp(block.timestamp + 3650 days);
        g0 = gasleft();
        billing.settle(bob);
        uint256 longGap = g0 - gasleft();

        assertLt(longGap, shortGap + 5000, "projection must be closed-form, not a loop");
    }

    function test_lapsedSubscriptionIsNotResurrectedByALaterTopUp() public {
        _subscribed(alice, 5e6, HOBBY_ID); // exactly one period
        uint64 lapseAt = uint64(block.timestamp) + PERIOD;

        vm.warp(lapseAt + 60 days);
        assertFalse(billing.isSubscribed(alice));

        vm.prank(alice);
        billing.deposit(50e6);

        // The top-up must not be eaten by the two months of downtime.
        (bool active,,, uint256 balance,) = billing.statusOf(alice);
        assertFalse(active, "top-up alone must not restart a lapsed subscription");
        assertEq(balance, 50e6, "no retroactive charges");

        vm.prank(alice);
        billing.subscribe(HOBBY_ID);
        (,, uint64 until,,) = billing.statusOf(alice);
        assertEq(until, block.timestamp + PERIOD, "new period starts now, not in the past");
    }

    function test_lapseBooksOnlyWhatWasCovered() public {
        _subscribed(alice, 12e6, HOBBY_ID); // pays for 2 periods, 2 USDC left over
        vm.warp(block.timestamp + PERIOD * 5);

        billing.settle(alice);
        assertEq(billing.accruedRevenue(), 2 * HOBBY);
        (bool active,,, uint256 balance,) = billing.statusOf(alice);
        assertFalse(active);
        assertEq(balance, 2e6, "remainder stays the customer's");

        vm.prank(alice);
        billing.withdraw(2e6);
        _assertSolvent();
    }

    // ------------------------------------------------------------------
    // Cancellation and refunds
    // ------------------------------------------------------------------

    function test_cancelRefundsUnusedTime() public {
        _subscribed(alice, 60e6, PRO_ID); // 20 escrowed, 40 free
        vm.warp(block.timestamp + 9 days); // 30% of the period used

        uint256 preview = billing.previewCancelRefund(alice);
        vm.prank(alice);
        uint256 refund = billing.cancel();

        assertEq(refund, preview, "preview must match reality");
        assertEq(refund, (PRO * 21) / 30, "21 of 30 days unused");
        assertEq(billing.accruedRevenue(), PRO - refund);
        assertFalse(billing.isSubscribed(alice));

        (,,, uint256 balance,) = billing.statusOf(alice);
        assertEq(balance, 40e6 + refund);
        _assertSolvent();
    }

    function test_cancelImmediatelyAfterSubscribingRefundsNearlyEverything() public {
        _subscribed(alice, 5e6, HOBBY_ID);
        vm.prank(alice);
        uint256 refund = billing.cancel();
        assertEq(refund, HOBBY, "no time used, nothing charged");
        assertEq(billing.accruedRevenue(), 0);
    }

    function test_cancelSettlesElapsedPeriodsFirst() public {
        _subscribed(alice, 20e6, HOBBY_ID);
        vm.warp(block.timestamp + PERIOD + 15 days); // one full period, then half of the next

        vm.prank(alice);
        uint256 refund = billing.cancel();

        assertEq(refund, HOBBY / 2, "half of the period in progress");
        assertEq(billing.accruedRevenue(), HOBBY + HOBBY / 2);
        _assertSolvent();
    }

    function test_cancelRevertsWhenNotSubscribed() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_cancelAndWithdrawAllReturnsEverythingOwed() public {
        _subscribed(alice, 60e6, PRO_ID);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.cancelAndWithdrawAll();

        assertEq(usdc.balanceOf(alice), 1000e6 - PRO / 2, "only the half-month used is kept");
        assertEq(billing.customerFunds(), 0);
        _assertSolvent();
    }

    function test_switchPlanRefundsOldAndStartsNew() public {
        _subscribed(alice, 60e6, HOBBY_ID);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.switchPlan(PRO_ID);

        (bool active, uint8 planId, uint64 until, uint256 balance, uint256 escrow) = billing.statusOf(alice);
        assertTrue(active);
        assertEq(planId, PRO_ID);
        assertEq(until, block.timestamp + PERIOD, "fresh period");
        assertEq(escrow, PRO);
        assertEq(balance, 55e6 + HOBBY / 2 - PRO);
        assertEq(billing.accruedRevenue(), HOBBY / 2);
        _assertSolvent();
    }

    // ------------------------------------------------------------------
    // Pricing
    // ------------------------------------------------------------------

    function test_priceChangeDoesNotAffectExistingSubscribers() public {
        _subscribed(alice, 60e6, HOBBY_ID);

        vm.prank(merchant);
        billing.setPlanPrice(HOBBY_ID, 9e6);

        vm.warp(block.timestamp + PERIOD);
        billing.settle(alice);
        (,,, uint256 balance, uint256 escrow) = billing.statusOf(alice);
        assertEq(escrow, HOBBY, "grandfathered at the old price");
        assertEq(balance, 60e6 - 2 * HOBBY);

        // New subscribers pay the new price.
        _subscribed(bob, 60e6, HOBBY_ID);
        (,,,, uint256 bobEscrow) = billing.statusOf(bob);
        assertEq(bobEscrow, 9e6);
    }

    function test_priceZeroClosesPlanToNewSignupsOnly() public {
        _subscribed(alice, 60e6, HOBBY_ID);
        vm.prank(merchant);
        billing.setPlanPrice(HOBBY_ID, 0);

        vm.prank(bob);
        billing.deposit(60e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, HOBBY_ID));
        billing.subscribe(HOBBY_ID);

        vm.warp(block.timestamp + PERIOD);
        assertTrue(billing.isSubscribed(alice), "existing subscriber keeps renewing");
    }

    // ------------------------------------------------------------------
    // Merchant controls
    // ------------------------------------------------------------------

    function test_merchantCanOnlyWithdrawEarnedRevenue() public {
        _subscribed(alice, 60e6, HOBBY_ID);

        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 0, 1));
        billing.withdrawRevenue(merchant, 1);

        vm.warp(block.timestamp + PERIOD);
        billing.settle(alice);

        vm.prank(merchant);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, HOBBY, HOBBY + 1)
        );
        billing.withdrawRevenue(merchant, HOBBY + 1);

        vm.prank(merchant);
        billing.withdrawRevenue(merchant, HOBBY);
        assertEq(usdc.balanceOf(merchant), HOBBY);
        _assertSolvent();
    }

    function test_onlyOwnerCanAdminister() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.withdrawRevenue(alice, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.setPlanPrice(HOBBY_ID, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.setSignupsPaused(true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.rescue(IERC20(address(usdc)), alice, 1);
        vm.stopPrank();
    }

    function test_pauseStopsSignupsButNeverExits() public {
        _subscribed(alice, 60e6, HOBBY_ID);
        vm.prank(merchant);
        billing.setSignupsPaused(true);

        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.SignupsArePaused.selector);
        billing.deposit(10e6);

        // Renewals keep working, and the existing customer can always get out.
        vm.warp(block.timestamp + PERIOD);
        assertTrue(billing.isSubscribed(alice));
        vm.prank(alice);
        billing.cancelAndWithdrawAll();
        _assertSolvent();
    }

    function test_rescueCannotTouchCustomerFundsOrRevenue() public {
        _subscribed(alice, 60e6, HOBBY_ID);
        vm.warp(block.timestamp + PERIOD);
        billing.settle(alice); // 5 revenue, 55 customer funds

        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 0, 1));
        billing.rescue(IERC20(address(usdc)), merchant, 1);

        // A stray transfer in is recoverable.
        usdc.mint(address(billing), 7e6);
        vm.prank(merchant);
        billing.rescue(IERC20(address(usdc)), merchant, 7e6);
        assertEq(usdc.balanceOf(merchant), 7e6);
        _assertSolvent();
    }

    function test_blockedCustomerCannotStallOtherAccounts() public {
        _subscribed(alice, 60e6, HOBBY_ID);
        _subscribed(bob, 60e6, HOBBY_ID);
        usdc.setBlocked(alice, true);

        vm.prank(alice);
        vm.expectRevert(); // alice's own withdrawal fails, as USDC intends
        billing.withdraw(1e6);

        // Everyone else is unaffected, including settlement of the blocked account.
        billing.settle(alice);
        vm.prank(bob);
        billing.cancelAndWithdrawAll();
        _assertSolvent();
    }

    // ------------------------------------------------------------------
    // Fuzz
    // ------------------------------------------------------------------

    function testFuzz_cancelNeverReturnsMoreThanWasPaid(uint256 topUp, uint256 elapsed, bool pro) public {
        uint8 planId = pro ? PRO_ID : HOBBY_ID;
        uint256 price = pro ? PRO : HOBBY;
        topUp = bound(topUp, price, 1000e6);
        elapsed = bound(elapsed, 0, PERIOD * 4);

        _subscribed(alice, topUp, planId);
        vm.warp(block.timestamp + elapsed);

        uint256 spentBefore = topUp;
        if (billing.isSubscribed(alice)) {
            vm.prank(alice);
            billing.cancel();
        }
        vm.prank(alice);
        uint256 out = billing.rawSubscription(alice).balance;
        if (out > 0) billing.settle(alice);

        assertLe(out, spentBefore, "cannot withdraw more than deposited");
        _assertSolvent();
    }

    function testFuzz_customerNeverPaysForUnusedTime(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, PERIOD - 1);
        _subscribed(alice, 100e6, PRO_ID);
        vm.warp(block.timestamp + elapsed);

        vm.prank(alice);
        billing.cancelAndWithdrawAll();

        uint256 paid = 1000e6 - usdc.balanceOf(alice);
        uint256 fairPrice = (PRO * elapsed) / PERIOD;
        assertApproxEqAbs(paid, fairPrice, 1, "charged for time used, +/- rounding dust");
    }

    function testFuzz_solvencyUnderArbitraryTimeTravel(uint96 topUp, uint32[5] calldata jumps) public {
        uint256 amount = bound(uint256(topUp), PRO, 500e6);
        _subscribed(alice, amount, PRO_ID);

        for (uint256 i; i < jumps.length; i++) {
            vm.warp(block.timestamp + bound(uint256(jumps[i]), 0, 400 days));
            billing.settle(alice);
            _assertSolvent();
        }

        uint256 owed = billing.rawSubscription(alice).balance;
        if (billing.isSubscribed(alice)) {
            vm.prank(alice);
            billing.cancelAndWithdrawAll();
        } else if (owed > 0) {
            vm.prank(alice);
            billing.withdraw(owed);
        }

        uint256 revenue = billing.accruedRevenue();
        if (revenue > 0) {
            vm.prank(merchant);
            billing.withdrawRevenue(merchant, revenue);
        }
        assertEq(usdc.balanceOf(address(billing)), 0, "contract fully drains to its rightful owners");
    }
}
