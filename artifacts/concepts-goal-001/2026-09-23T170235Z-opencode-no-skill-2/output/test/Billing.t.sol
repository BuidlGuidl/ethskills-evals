// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Billing} from "../src/Billing.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {MockUSDC18} from "./MockUSDC18.sol";

contract BillingTest is Test {
    MockUSDC internal usdc;
    Billing internal billing;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal owner = makeAddr("owner");

    uint8 internal constant HOBBY = 1;
    uint8 internal constant PRO = 2;
    uint256 internal constant HOBBY_PRICE = 5e6;
    uint256 internal constant PRO_PRICE = 20e6;
    uint256 internal constant MONTH = 30 days;

    function setUp() public {
        usdc = new MockUSDC(6);
        billing = new Billing(address(usdc), owner);
    }

    function _fund(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _subscribe(address user, uint8 plan, uint256 amount) internal {
        _fund(user, amount);
        vm.prank(user);
        billing.topUp(amount);
        vm.prank(user);
        billing.subscribe(plan);
    }

    function test_constructorSetsPlansAndToken() public view {
        assertEq(billing.planPrice(HOBBY), HOBBY_PRICE);
        assertEq(billing.planPrice(PRO), PRO_PRICE);
        assertEq(address(billing.usdc()), address(usdc));
        assertEq(billing.owner(), owner);
    }

    function test_constructorRejectsBadArgs() public {
        vm.expectRevert(Billing.ZeroAddress.selector);
        new Billing(address(0), owner);
        vm.expectRevert(Billing.ZeroAddress.selector);
        new Billing(address(usdc), address(0));

        MockUSDC18 usdc18 = new MockUSDC18();
        vm.expectRevert(Billing.UnsupportedToken.selector);
        new Billing(address(usdc18), owner);
    }

    function test_topUpPullsTokensAndCredits() public {
        _fund(alice, 10e6);
        vm.prank(alice);
        billing.topUp(10e6);

        (uint8 plan, uint256 credit, uint256 lastCharged) = billing.accounts(alice);
        assertEq(plan, 0);
        assertEq(credit, 10e6);
        assertEq(lastCharged, 0);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(address(billing)), 10e6);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_topUpZeroFails() public {
        vm.expectRevert(Billing.ZeroAmount.selector);
        billing.topUp(0);
    }

    function test_subscribeActivates() public {
        _subscribe(alice, HOBBY, 5e6);

        (uint8 plan, uint256 credit, uint256 lastCharged) = billing.accounts(alice);
        assertEq(plan, HOBBY);
        assertEq(credit, 5e6);
        assertEq(lastCharged, block.timestamp);
        assertTrue(billing.isSubscribed(alice));

        (uint8 planView, uint256 creditView, uint256 lastChargedView, uint256 priceView, uint256 paidUntil) =
            billing.getAccount(alice);
        assertEq(planView, HOBBY);
        assertEq(creditView, 5e6);
        assertEq(lastChargedView, block.timestamp);
        assertEq(priceView, HOBBY_PRICE);
        assertEq(paidUntil, block.timestamp + 30 days);
    }

    function test_subscribeEmitsEvent() public {
        _fund(alice, 5e6);
        vm.prank(alice);
        billing.topUp(5e6);

        vm.expectEmit(true, true, true, true);
        emit Billing.Subscribed(alice, HOBBY);
        vm.prank(alice);
        billing.subscribe(HOBBY);
    }

    function test_subscribeRequiresOneMonthCredit() public {
        _fund(alice, 5e6 - 1);
        vm.prank(alice);
        billing.topUp(5e6 - 1);
        vm.expectRevert(Billing.InsufficientCredit.selector);
        vm.prank(alice);
        billing.subscribe(HOBBY);
    }

    function test_subscribeWithoutTopUpFails() public {
        vm.expectRevert(Billing.InsufficientCredit.selector);
        billing.subscribe(PRO);
    }

    function test_subscribeBadPlanIds() public {
        _fund(alice, 100e6);
        vm.prank(alice);
        billing.topUp(100e6);

        vm.expectRevert(Billing.BadPlan.selector);
        vm.prank(alice);
        billing.subscribe(0);

        vm.expectRevert(Billing.BadPlan.selector);
        vm.prank(alice);
        billing.subscribe(3);
    }

    function test_isSubscribedBoundary() public {
        _subscribe(alice, HOBBY, 5e6);

        vm.warp(vm.getBlockTimestamp() + 30 days - 1);
        assertTrue(billing.isSubscribed(alice));

        vm.warp(vm.getBlockTimestamp() + 1);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_isSubscribedAcrossMultipleMonths() public {
        _subscribe(alice, HOBBY, 15e6);

        vm.warp(vm.getBlockTimestamp() + 60 days);
        assertTrue(billing.isSubscribed(alice));

        vm.warp(vm.getBlockTimestamp() + 29 days);
        assertTrue(billing.isSubscribed(alice));

        vm.warp(vm.getBlockTimestamp() + 1 days + 1);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_settleChargesMonthly() public {
        _subscribe(alice, PRO, 60e6);

        for (uint256 i = 1; i <= 3; i++) {
            vm.warp(vm.getBlockTimestamp() + 30 days);
            billing.settle(alice);
            assertEq(billing.pendingRevenue(), i * PRO_PRICE);

            (uint8 planLoop, uint256 creditLoop, uint256 chargedLoop) = billing.accounts(alice);
            assertEq(planLoop, i == 3 ? 0 : PRO);
            assertEq(creditLoop, 60e6 - i * PRO_PRICE);
            assertEq(chargedLoop, vm.getBlockTimestamp());
        }

        (uint8 plan, uint256 credit,) = billing.accounts(alice);
        assertEq(plan, 0);
        assertEq(credit, 0);
        assertFalse(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(address(billing)), 60e6);
    }

    function test_settleCallableByAnyone() public {
        _subscribe(alice, HOBBY, 10e6);
        vm.warp(vm.getBlockTimestamp() + 30 days);

        vm.prank(bob);
        billing.settle(alice);

        (uint8 plan, uint256 credit, uint256 lastCharged) = billing.accounts(alice);
        assertEq(plan, HOBBY);
        assertEq(credit, 5e6);
        assertEq(lastCharged, block.timestamp);
        assertEq(billing.pendingRevenue(), 5e6);
    }

    function test_lapseWhenCreditRunsOut() public {
        _subscribe(alice, HOBBY, 6e6);
        vm.warp(vm.getBlockTimestamp() + 40 days);

        vm.expectEmit(true, true, true, true);
        emit Billing.Lapsed(alice, HOBBY);
        billing.settle(alice);

        (uint8 plan, uint256 credit, uint256 lastCharged) = billing.accounts(alice);
        assertEq(plan, 0);
        assertEq(credit, 0);
        assertEq(lastCharged, block.timestamp);
        assertEq(billing.pendingRevenue(), 6e6);
        assertFalse(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(address(billing)), 6e6);
    }

    function test_cancelMidMonthRefundsProrated() public {
        _subscribe(alice, PRO, 20e6);
        vm.warp(vm.getBlockTimestamp() + 15 days);

        vm.expectEmit(true, true, true, true);
        emit Billing.Cancelled(alice, PRO, 10e6);
        vm.prank(alice);
        billing.cancel();

        (uint8 plan, uint256 credit, uint256 lastCharged) = billing.accounts(alice);
        assertEq(plan, 0);
        assertEq(credit, 0);
        assertEq(lastCharged, block.timestamp);
        assertEq(usdc.balanceOf(alice), 10e6);
        assertEq(billing.pendingRevenue(), 10e6);
        assertEq(usdc.balanceOf(address(billing)), 10e6);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancelRefundsUnusedTopUpToo() public {
        _subscribe(alice, PRO, 25e6);
        vm.warp(vm.getBlockTimestamp() + 15 days);

        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), 15e6);
        assertEq(billing.pendingRevenue(), 10e6);
    }

    function test_cancelWithoutSubscriptionFails() public {
        _fund(alice, 5e6);
        vm.prank(alice);
        billing.topUp(5e6);

        vm.expectRevert(Billing.NotSubscribed.selector);
        vm.prank(alice);
        billing.cancel();
    }

    function test_cancelAfterExactExhaustionFails() public {
        _subscribe(alice, HOBBY, 5e6);
        vm.warp(vm.getBlockTimestamp() + 30 days);
        assertFalse(billing.isSubscribed(alice));

        vm.expectRevert(Billing.NotSubscribed.selector);
        vm.prank(alice);
        billing.cancel();
    }

    function test_withdrawWhileSubscribed() public {
        _subscribe(alice, HOBBY, 10e6);
        vm.warp(vm.getBlockTimestamp() + 3 days);

        vm.prank(alice);
        billing.withdraw(1e6);

        (uint8 plan, uint256 credit, uint256 lastCharged) = billing.accounts(alice);
        assertEq(plan, HOBBY);
        assertEq(credit, 10e6 - 500_000 - 1e6);
        assertEq(lastCharged, block.timestamp);
        assertEq(usdc.balanceOf(alice), 1e6);
        assertEq(billing.pendingRevenue(), 500_000);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_withdrawMoreThanCreditFails() public {
        _subscribe(alice, HOBBY, 5e6);

        vm.expectRevert(Billing.InsufficientCredit.selector);
        vm.prank(alice);
        billing.withdraw(5e6 + 1);
    }

    function test_withdrawEverythingEndsService() public {
        _subscribe(alice, HOBBY, 5e6);

        vm.prank(alice);
        billing.withdraw(5e6);

        assertFalse(billing.isSubscribed(alice));
    }

    function test_resubscribeAfterCancel() public {
        _subscribe(alice, HOBBY, 5e6);
        vm.prank(alice);
        billing.cancel();

        _fund(alice, 20e6);
        vm.prank(alice);
        billing.topUp(20e6);
        vm.prank(alice);
        billing.subscribe(PRO);

        assertTrue(billing.isSubscribed(alice));
        (uint8 planAfter, uint256 creditAfter, uint256 chargedAfter, uint256 priceAfter, uint256 paidUntilAfter) =
            billing.getAccount(alice);
        assertEq(planAfter, PRO);
        assertEq(creditAfter, 20e6);
        assertEq(chargedAfter, block.timestamp);
        assertEq(priceAfter, PRO_PRICE);
        assertEq(paidUntilAfter, block.timestamp + 30 days);
    }

    function test_planSwitchProratesBothLegs() public {
        _subscribe(alice, HOBBY, 5e6);
        vm.warp(vm.getBlockTimestamp() + 15 days);

        _fund(alice, PRO_PRICE + 1e6);
        vm.prank(alice);
        billing.topUp(PRO_PRICE + 1e6);

        (, uint256 creditAfterTopUp,) = billing.accounts(alice);
        assertEq(creditAfterTopUp, 5e6 - 2.5e6 + 21e6);

        vm.prank(alice);
        billing.subscribe(PRO);
        vm.warp(vm.getBlockTimestamp() + 30 days);

        assertTrue(billing.isSubscribed(alice));
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), 3.5e6);
        assertEq(billing.pendingRevenue(), 2.5e6 + 20e6);
    }

    function test_accountsAreIndependent() public {
        _subscribe(alice, HOBBY, 5e6);
        assertFalse(billing.isSubscribed(bob));
        assertFalse(billing.isSubscribed(owner));

        vm.warp(vm.getBlockTimestamp() + 30 days);
        assertFalse(billing.isSubscribed(alice));

        (uint8 plan, uint256 credit, uint256 lastCharged) = billing.accounts(alice);
        assertEq(plan, HOBBY);
        assertEq(credit, 5e6);
        assertEq(lastCharged, block.timestamp - 30 days);
    }

    function test_priceChangeAppliesToAccruedTime() public {
        _subscribe(alice, HOBBY, 5e6);
        vm.warp(vm.getBlockTimestamp() + 15 days);

        vm.prank(owner);
        billing.setPlanPrice(HOBBY, 6e6);

        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), 2e6);
        assertEq(billing.pendingRevenue(), 3e6);
    }

    function test_priceChangeValidation() public {
        vm.startPrank(owner);
        billing.setPlanPrice(HOBBY, 6e6);
        assertEq(billing.planPrice(HOBBY), 6e6);
        vm.expectRevert(Billing.BadPlan.selector);
        billing.setPlanPrice(0, 6e6);
        vm.expectRevert(Billing.BadPlan.selector);
        billing.setPlanPrice(3, 6e6);
        vm.expectRevert(Billing.ZeroAmount.selector);
        billing.setPlanPrice(HOBBY, 0);
        vm.stopPrank();

        vm.expectRevert(Billing.NotOwner.selector);
        vm.prank(alice);
        billing.setPlanPrice(HOBBY, 1e6);
    }

    function test_collectRevenue() public {
        _subscribe(alice, HOBBY, 5e6);
        vm.warp(vm.getBlockTimestamp() + 15 days);
        vm.prank(alice);
        billing.cancel();
        assertEq(billing.pendingRevenue(), 2.5e6);

        vm.prank(owner);
        billing.collectRevenue(bob, 2.5e6);

        assertEq(usdc.balanceOf(bob), 2.5e6);
        assertEq(billing.pendingRevenue(), 0);

        vm.expectRevert(Billing.InsufficientRevenue.selector);
        vm.prank(owner);
        billing.collectRevenue(bob, 1);

        vm.expectRevert(Billing.NotOwner.selector);
        vm.prank(alice);
        billing.collectRevenue(alice, 1);
    }

    function test_transferOwnership() public {
        vm.prank(owner);
        billing.transferOwnership(bob);
        assertEq(billing.owner(), bob);

        vm.expectRevert(Billing.NotOwner.selector);
        vm.prank(owner);
        billing.setPlanPrice(HOBBY, 1e6);

        vm.expectRevert(Billing.NotOwner.selector);
        vm.prank(owner);
        billing.transferOwnership(owner);

        vm.prank(bob);
        billing.transferOwnership(owner);
        assertEq(billing.owner(), owner);
    }

    function test_contractBalanceInvariant() public {
        _subscribe(alice, HOBBY, 12e6);
        _subscribe(bob, PRO, 30e6);
        vm.warp(vm.getBlockTimestamp() + 20 days);

        billing.settle(alice);
        billing.settle(bob);

        (uint8 planA, uint256 creditA, uint256 chargedA) = billing.accounts(alice);
        (uint8 planB, uint256 creditB, uint256 chargedB) = billing.accounts(bob);
        assertEq(planA, HOBBY);
        assertEq(planB, PRO);
        assertEq(chargedA, block.timestamp);
        assertEq(chargedB, block.timestamp);
        assertEq(creditA, 12e6 - 3_333_333);
        assertEq(creditB, 30e6 - 13_333_333);
        assertEq(billing.pendingRevenue(), 3_333_333 + 13_333_333);
        assertEq(usdc.balanceOf(address(billing)), creditA + creditB + billing.pendingRevenue());
    }

    function test_ownerCannotTouchCustomerCredit() public {
        _subscribe(alice, HOBBY, 50e6);

        vm.expectRevert(Billing.InsufficientRevenue.selector);
        vm.prank(owner);
        billing.collectRevenue(owner, type(uint256).max);

        (, uint256 credit,) = billing.accounts(alice);
        assertEq(credit, 50e6);
        assertEq(usdc.balanceOf(owner), 0);
    }

    function test_getAccountForUnsubscribed() public {
        _fund(alice, 7e6);
        vm.prank(alice);
        billing.topUp(7e6);

        (uint8 plan, uint256 credit, uint256 lastCharged, uint256 pricePerMonth, uint256 paidUntil) =
            billing.getAccount(alice);
        assertEq(plan, 0);
        assertEq(credit, 7e6);
        assertEq(lastCharged, 0);
        assertEq(pricePerMonth, 0);
        assertEq(paidUntil, 0);
    }

    function test_getAccountPaidUntilMidCycle() public {
        _subscribe(alice, HOBBY, 10e6);
        vm.warp(vm.getBlockTimestamp() + 10 days);

        (,,,, uint256 paidUntil) = billing.getAccount(alice);
        assertEq(paidUntil, block.timestamp + 4_320_000);
    }

    function test_rejectsEth() public {
        vm.deal(alice, 1 ether);
        (bool ok,) = address(billing).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(billing).balance, 0);
    }

    function testFuzz_cancelRefundIsExact(uint64 elapsed, uint96 credit_) public {
        uint256 elapsedSeconds = bound(elapsed, 0, 365 days);
        uint256 credit = bound(credit_, HOBBY_PRICE, 1000e6);

        _subscribe(alice, HOBBY, credit);
        vm.warp(vm.getBlockTimestamp() + elapsedSeconds);

        uint256 due = elapsedSeconds * HOBBY_PRICE / MONTH;
        if (due >= credit) {
            vm.expectRevert(Billing.NotSubscribed.selector);
            vm.prank(alice);
            billing.cancel();
        } else {
            vm.prank(alice);
            billing.cancel();
            assertEq(usdc.balanceOf(alice), credit - due);
            assertEq(usdc.balanceOf(address(billing)), due);
            assertEq(usdc.balanceOf(alice) + usdc.balanceOf(address(billing)), credit);
        }
    }

    function testFuzz_isSubscribedMatchesGetAccount(uint64 elapsed, uint96 topUp_) public {
        uint256 elapsedSeconds = bound(elapsed, 0, 365 days);
        uint256 toppedUp = bound(topUp_, PRO_PRICE, 1000e6);

        _subscribe(alice, PRO, toppedUp);
        vm.warp(vm.getBlockTimestamp() + elapsedSeconds);

        (uint8 plan, uint256 credit, uint256 lastCharged, uint256 pricePerMonth, uint256 paidUntil) =
            billing.getAccount(alice);
        uint256 due = elapsedSeconds * PRO_PRICE / MONTH;
        uint256 remaining = due >= credit ? 0 : credit - due;

        assertEq(plan, PRO);
        assertEq(credit, toppedUp);
        assertEq(lastCharged, block.timestamp - elapsedSeconds);
        assertEq(pricePerMonth, PRO_PRICE);
        assertEq(paidUntil, block.timestamp + remaining * MONTH / PRO_PRICE);
        assertEq(billing.isSubscribed(alice), credit > due);
    }
}
