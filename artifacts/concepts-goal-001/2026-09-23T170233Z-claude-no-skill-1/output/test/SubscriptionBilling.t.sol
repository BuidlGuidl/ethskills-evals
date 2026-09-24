// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import {BillingTest} from "./Base.t.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {ISubscriptionBilling} from "../src/ISubscriptionBilling.sol";

contract SubscriptionBillingTest is BillingTest {
    uint256 internal PERIOD;

    function setUp() public override {
        super.setUp();
        PERIOD = billing.PERIOD();
    }

    // -- signing up ------------------------------------------------------

    function test_subscribe_chargesFirstPeriodUpFront() public {
        fund(alice, 30e6);

        vm.prank(alice);
        billing.subscribe(HOBBY);

        ISubscriptionBilling.Status memory st = billing.statusOf(alice);
        assertTrue(st.active);
        assertEq(st.plan, HOBBY);
        assertEq(st.credit, 25e6, "one period moved out of credit");
        assertEq(st.periodEnd, block.timestamp + PERIOD);
        // 25 USDC funds 5 more periods on top of the current one.
        assertEq(st.expiresAt, block.timestamp + 6 * PERIOD);
        assertSolvent();
    }

    function test_subscribe_revertsWithoutEnoughCreditForOnePeriod() public {
        fund(alice, 4.99e6);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientCredit.selector, HOBBY_PRICE, uint256(4.99e6))
        );
        billing.subscribe(HOBBY);
    }

    function test_subscribe_revertsOnUnknownOrClosedPlan() public {
        fund(alice, 100e6);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, uint8(7)));
        billing.subscribe(7);

        vm.prank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, false);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.PlanClosed.selector, HOBBY));
        billing.subscribe(HOBBY);
    }

    function test_depositAndSubscribe_inOneTransaction() public {
        usdc.mint(alice, 20e6);
        vm.startPrank(alice);
        usdc.approve(address(billing), 20e6);
        billing.depositAndSubscribe(20e6, PRO);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.statusOf(alice).credit, 0);
        assertSolvent();
    }

    function test_anyoneCanFundAnotherAccount() public {
        usdc.mint(bob, 50e6);
        vm.startPrank(bob);
        usdc.approve(address(billing), 50e6);
        billing.deposit(alice, 50e6);
        vm.stopPrank();

        assertEq(billing.statusOf(alice).credit, 50e6);
        assertEq(billing.statusOf(bob).credit, 0);
    }

    // -- renewal ---------------------------------------------------------

    function test_renewsLazilyWithoutAnyKeeperTransaction() public {
        fund(alice, 30e6); // 6 periods of hobby
        vm.prank(alice);
        billing.subscribe(HOBBY);

        // Nobody touches the contract for three months.
        vm.warp(block.timestamp + 3 * PERIOD + 1 days);

        assertTrue(billing.isSubscribed(alice), "still subscribed with no keeper");
        ISubscriptionBilling.Status memory st = billing.statusOf(alice);
        assertEq(st.credit, 10e6, "three renewals charged");
    }

    function test_settleMovesElapsedPeriodsIntoRevenue() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.warp(block.timestamp + 3 * PERIOD + 1 days);
        assertEq(billing.merchantAccrued(), 0, "unsettled revenue is not booked yet");
        assertEq(billing.accruedIncluding(_one(alice)), 15e6, "but it is visible");

        billing.settle(alice);
        // Three full periods elapsed; the fourth is current and still escrowed.
        assertEq(billing.merchantAccrued(), 15e6);
        assertSolvent();
    }

    function test_settleIsIdempotentAndPermissionless() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        vm.warp(block.timestamp + 2 * PERIOD);

        vm.prank(bob);
        billing.settle(alice);
        uint256 afterFirst = billing.merchantAccrued();

        vm.prank(bob);
        billing.settle(alice);
        assertEq(billing.merchantAccrued(), afterFirst, "second settle is a no-op");
    }

    function test_lapsesWhenCreditRunsOutAndKeepsTheDust() public {
        // 12 USDC buys the first period plus one renewal, with 2 USDC left over
        // that is too small to buy a third.
        fund(alice, 12e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        uint256 start = block.timestamp;

        vm.warp(start + PERIOD);
        assertTrue(billing.isSubscribed(alice), "renewal 1 is affordable");
        vm.warp(start + 2 * PERIOD);
        assertFalse(billing.isSubscribed(alice), "credit exhausted");

        // Discovered late: the lapse is still reported at the boundary it
        // actually happened, not at the time of settlement.
        vm.warp(start + 3 * PERIOD);
        vm.expectEmit(true, true, false, true, address(billing));
        emit SubscriptionBilling.Lapsed(alice, HOBBY, uint64(start + 2 * PERIOD), 2e6);
        billing.settle(alice);

        assertEq(billing.merchantAccrued(), 10e6, "two periods sold");
        assertEq(billing.statusOf(alice).credit, 2e6, "leftover stays the customer's");
        assertSolvent();

        // ...and the customer can take the remainder home.
        vm.prank(alice);
        billing.withdrawCredit(alice, 2e6);
        assertEq(usdc.balanceOf(alice), 2e6);
    }

    function test_lapsedAccountCanTopUpAndResubscribe() public {
        fund(alice, 5e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.warp(block.timestamp + 2 * PERIOD);
        assertFalse(billing.isSubscribed(alice));

        fund(alice, 5e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertTrue(billing.isSubscribed(alice));
        assertSolvent();
    }

    // -- cancelling ------------------------------------------------------

    function test_cancelRefundsUnusedTimeProRata() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        // Ten days into a thirty day period: two thirds unused.
        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        billing.cancelAndWithdraw(alice);

        assertEq(usdc.balanceOf(alice), 25e6 + (HOBBY_PRICE * 20 days) / PERIOD);
        assertEq(billing.merchantAccrued(), HOBBY_PRICE - (HOBBY_PRICE * 20 days) / PERIOD);
        assertFalse(billing.isSubscribed(alice), "access ends immediately");
        assertSolvent();
    }

    function test_cancelAfterUnsettledRenewalsRefundsOnlyTheCurrentPeriod() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.warp(block.timestamp + 2 * PERIOD + 15 days);
        vm.prank(alice);
        billing.cancelAndWithdraw(alice);

        // Sold: 2 full periods + half of the third. Refunded: the rest.
        uint256 sold = 2 * HOBBY_PRICE + (HOBBY_PRICE * 15 days) / PERIOD;
        assertEq(billing.merchantAccrued(), sold);
        assertEq(usdc.balanceOf(alice), 30e6 - sold);
        assertSolvent();
    }

    function test_cancelRevertsWhenNotSubscribed() public {
        fund(alice, 30e6);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_cancelWorksWhilePaused() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.prank(owner);
        billing.setPaused(true);

        vm.warp(block.timestamp + 5 days);
        vm.prank(alice);
        billing.cancelAndWithdraw(alice);
        assertGt(usdc.balanceOf(alice), 25e6, "exits are never blocked");
    }

    // -- plan changes ----------------------------------------------------

    function test_changePlan_creditsUnusedTimeAndStartsFresh() public {
        fund(alice, 60e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        billing.changePlan(PRO);

        uint256 refund = (HOBBY_PRICE * 15 days) / PERIOD;
        ISubscriptionBilling.Status memory st = billing.statusOf(alice);
        assertEq(st.plan, PRO);
        assertEq(st.rate, PRO_PRICE);
        assertEq(st.periodEnd, block.timestamp + PERIOD, "new period starts now");
        assertEq(st.credit, 60e6 - HOBBY_PRICE + refund - PRO_PRICE);
        assertSolvent();
    }

    function test_changePlan_revertsWhenUpgradeUnaffordable() public {
        fund(alice, 10e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.prank(alice);
        vm.expectRevert();
        billing.changePlan(PRO);
    }

    // -- pricing ---------------------------------------------------------

    function test_repricingDoesNotTouchExistingSubscribers() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        // Owner triples the hobby price while Alice is away for three months.
        vm.prank(owner);
        billing.setPlan(HOBBY, 15e6, true);
        vm.warp(block.timestamp + 3 * PERIOD);

        billing.settle(alice);
        assertEq(billing.merchantAccrued(), 15e6, "charged at the rate she signed up at");
        assertEq(billing.statusOf(alice).rate, HOBBY_PRICE);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_closedPlanStillRenewsForExistingSubscribers() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.prank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, false);

        vm.warp(block.timestamp + 2 * PERIOD);
        assertTrue(billing.isSubscribed(alice), "retiring a plan does not evict anyone");
    }

    // -- money out -------------------------------------------------------

    function test_ownerCannotWithdrawUnearnedEscrow() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        vm.warp(block.timestamp + 10 days);
        billing.settle(alice);

        // Mid-period: nothing is bookable yet, even though USDC is sitting here.
        assertEq(billing.merchantAccrued(), 0);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientRevenue.selector, uint256(1), uint256(0))
        );
        billing.withdrawRevenue(owner, 1);
    }

    function test_withdrawRevenue() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        vm.warp(block.timestamp + 2 * PERIOD);
        billing.settle(alice);

        vm.prank(owner);
        billing.withdrawRevenue(bob, 10e6);
        assertEq(usdc.balanceOf(bob), 10e6);
        assertEq(billing.merchantAccrued(), 0);
        assertSolvent();
    }

    function test_sweepOnlyTakesTheSurplus() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        usdc.mint(address(billing), 7e6); // someone transferred in by mistake

        vm.prank(owner);
        billing.sweep(IERC20(address(usdc)), owner);
        assertEq(usdc.balanceOf(owner), 7e6);
        assertSolvent();

        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.sweep(IERC20(address(usdc)), owner);
    }

    // -- access control --------------------------------------------------

    function test_onlyOwnerAdmin() public {
        vm.startPrank(alice);
        vm.expectRevert();
        billing.setPlan(3, 1e6, true);
        vm.expectRevert();
        billing.withdrawRevenue(alice, 0);
        vm.expectRevert();
        billing.setPaused(true);
        vm.expectRevert();
        billing.sweep(IERC20(address(usdc)), alice);
        vm.stopPrank();
    }

    function test_ownershipTransferIsTwoStep() public {
        vm.prank(owner);
        billing.transferOwnership(bob);
        assertEq(billing.owner(), owner, "not yet");

        vm.prank(bob);
        billing.acceptOwnership();
        assertEq(billing.owner(), bob);
    }

    // -- fuzz ------------------------------------------------------------

    /// @dev Whatever the timeline, a customer never loses money they did not
    /// spend on service, and the merchant never books more than the elapsed time.
    function testFuzz_refundPlusRevenueEqualsDeposit(uint96 depositAmount, uint32 elapsed, bool cancelIt) public {
        depositAmount = uint96(bound(depositAmount, HOBBY_PRICE, 1_000_000e6));
        elapsed = uint32(bound(elapsed, 0, 400 days));

        fund(alice, depositAmount);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        vm.warp(block.timestamp + elapsed);
        if (cancelIt && billing.isSubscribed(alice)) {
            vm.prank(alice);
            billing.cancel();
        }
        billing.settle(alice);

        // Drain the account completely so nothing is left mid-period: an active
        // subscription still holds one period in escrow, which belongs to
        // neither side until that period ends or is cancelled.
        if (billing.isSubscribed(alice)) {
            vm.prank(alice);
            billing.cancel();
        }

        uint256 credit = billing.statusOf(alice).credit;
        if (credit != 0) {
            vm.prank(alice);
            billing.withdrawCredit(alice, credit);
        }
        uint256 revenue = billing.merchantAccrued();
        if (revenue != 0) {
            vm.prank(owner);
            billing.withdrawRevenue(owner, revenue);
        }

        assertEq(usdc.balanceOf(alice) + usdc.balanceOf(owner), depositAmount, "no value created or destroyed");
        assertLe(usdc.balanceOf(owner), depositAmount);
        assertSolvent();
    }

    /// @dev `expiresAt` is the promise the gateway caches on: as long as nobody
    /// cancels, the account must still be active right up to it.
    function testFuzz_activeUntilExpiresAt(uint96 depositAmount, uint32 elapsed) public {
        depositAmount = uint96(bound(depositAmount, HOBBY_PRICE, 100_000e6));
        fund(alice, depositAmount);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        uint64 expiresAt = billing.statusOf(alice).expiresAt;
        elapsed = uint32(bound(elapsed, 0, expiresAt - block.timestamp - 1));

        vm.warp(block.timestamp + elapsed);
        assertTrue(billing.isSubscribed(alice), "active before expiry");

        vm.warp(expiresAt);
        assertFalse(billing.isSubscribed(alice), "inactive at expiry");
    }

    function _one(address a) internal pure returns (address[] memory out) {
        out = new address[](1);
        out[0] = a;
    }
}
