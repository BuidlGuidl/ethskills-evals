// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    uint256 constant PERIOD = 30 days;
    uint256 constant HOBBY = 0;
    uint256 constant PRO = 1;
    uint256 constant HOBBY_PRICE = 5e6; // $5
    uint256 constant PRO_PRICE = 20e6; // $20

    MockUSDC usdc;
    SubscriptionBilling billing;

    address operator = makeAddr("operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(address(usdc), operator, HOBBY_PRICE, PRO_PRICE);

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(billing), type(uint256).max);
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    function _depositSubscribe(address user, uint256 depositAmount, uint256 planId) internal {
        vm.startPrank(user);
        billing.deposit(depositAmount);
        billing.subscribe(planId);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------
    // plans / deployment
    // ---------------------------------------------------------------

    function test_initialPlans() public view {
        (uint256 p0, bool a0) = billing.plans(0);
        (uint256 p1, bool a1) = billing.plans(1);
        assertEq(p0, HOBBY_PRICE);
        assertEq(p1, PRO_PRICE);
        assertTrue(a0);
        assertTrue(a1);
        assertEq(billing.planCount(), 2);
        assertEq(billing.HOBBY(), HOBBY);
        assertEq(billing.PRO(), PRO);
    }

    function test_constructorRevertsOnZero() public {
        vm.expectRevert(SubscriptionBilling.ZeroAddress.selector);
        new SubscriptionBilling(address(0), operator, HOBBY_PRICE, PRO_PRICE);
        vm.expectRevert(SubscriptionBilling.ZeroAddress.selector);
        new SubscriptionBilling(address(usdc), address(0), HOBBY_PRICE, PRO_PRICE);
        vm.expectRevert(SubscriptionBilling.ZeroPrice.selector);
        new SubscriptionBilling(address(usdc), operator, 0, PRO_PRICE);
    }

    // ---------------------------------------------------------------
    // deposits & withdrawals
    // ---------------------------------------------------------------

    function test_deposit() public {
        vm.prank(alice);
        billing.deposit(50e6);
        assertEq(billing.currentBalance(alice), 50e6);
        assertEq(usdc.balanceOf(address(billing)), 50e6);
        assertEq(usdc.balanceOf(alice), 950e6);
    }

    function test_depositZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.deposit(0);
    }

    function test_withdrawUnsubscribed() public {
        vm.prank(alice);
        billing.deposit(50e6);
        vm.prank(alice);
        billing.withdraw(50e6);
        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(billing.currentBalance(alice), 0);
    }

    function test_withdrawTooMuchReverts() public {
        vm.prank(alice);
        billing.deposit(50e6);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 50e6, 51e6)
        );
        billing.withdraw(51e6);
    }

    function test_withdrawToZeroLapsesSubscription() public {
        _depositSubscribe(alice, 50e6, HOBBY);
        vm.warp(block.timestamp + 1 days);
        uint256 remaining = billing.currentBalance(alice);
        vm.prank(alice);
        billing.withdraw(remaining);
        assertFalse(billing.isActive(alice));
        assertFalse(billing.getAccount(alice).subscribed);
    }

    // ---------------------------------------------------------------
    // subscribing
    // ---------------------------------------------------------------

    function test_subscribeRequiresOneMonthFunded() public {
        vm.startPrank(alice);
        billing.deposit(HOBBY_PRICE - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionBilling.InsufficientBalance.selector, HOBBY_PRICE - 1, HOBBY_PRICE
            )
        );
        billing.subscribe(HOBBY);
        billing.deposit(1);
        billing.subscribe(HOBBY);
        vm.stopPrank();
        assertTrue(billing.isActive(alice));
    }

    function test_subscribeSetsAccount() public {
        _depositSubscribe(alice, 100e6, PRO);
        SubscriptionBilling.Account memory a = billing.getAccount(alice);
        assertEq(a.balance, 100e6);
        assertEq(a.planId, PRO);
        assertEq(a.price, PRO_PRICE); // snapshotted
        assertEq(a.lastAccrual, block.timestamp);
        assertTrue(a.subscribed);
        assertTrue(billing.isActive(alice));
    }

    function test_subscribeTwiceReverts() public {
        _depositSubscribe(alice, 100e6, HOBBY);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.AlreadySubscribed.selector);
        billing.subscribe(PRO);
    }

    function test_subscribeUnknownPlanReverts() public {
        vm.prank(alice);
        billing.deposit(100e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, 7));
        billing.subscribe(7);
    }

    // ---------------------------------------------------------------
    // accrual & settlement
    // ---------------------------------------------------------------

    function test_accrualMatchesMonthlyRate() public {
        _depositSubscribe(alice, 100e6, HOBBY);
        vm.warp(block.timestamp + 15 days);
        assertEq(billing.pendingCharge(alice), HOBBY_PRICE / 2);
        assertEq(billing.currentBalance(alice), 100e6 - HOBBY_PRICE / 2);
        assertEq(billing.earned(), 0); // nothing realized until settle

        billing.settle(alice);
        assertEq(billing.earned(), HOBBY_PRICE / 2);
        assertEq(billing.currentBalance(alice), 100e6 - HOBBY_PRICE / 2);
        assertTrue(billing.isActive(alice));
    }

    function testYPEarningRateIsPerSecond() public {
        _depositSubscribe(alice, 100e6, PRO);
        vm.warp(block.timestamp + 1 days);
        // 20e6 * 86400 / 2592000 = 666666 (rounds down in customer's favor)
        assertEq(billing.pendingCharge(alice), 666666);
    }

    function test_isActiveAccountsForUnsettledAccrual() public {
        _depositSubscribe(alice, HOBBY_PRICE, HOBBY); // exactly one month
        assertTrue(billing.isActive(alice));
        vm.warp(block.timestamp + PERIOD);
        // storage still says subscribed, but the balance is fully consumed
        assertFalse(billing.isActive(alice));
        assertTrue(billing.getAccount(alice).subscribed);
    }

    function test_settleLapsesDepletedAccount() public {
        _depositSubscribe(alice, HOBBY_PRICE, HOBBY);
        vm.warp(block.timestamp + PERIOD + 1);
        vm.expectEmit(true, false, false, false);
        emit SubscriptionBilling.Lapsed(alice);
        billing.settle(alice);

        SubscriptionBilling.Account memory a = billing.getAccount(alice);
        assertEq(a.balance, 0);
        assertFalse(a.subscribed);
        assertEq(billing.earned(), HOBBY_PRICE); // operator keeps everything earned
        assertFalse(billing.isActive(alice));
    }

    function test_resubscribeAfterLapse() public {
        _depositSubscribe(alice, HOBBY_PRICE, HOBBY);
        vm.warp(block.timestamp + PERIOD + 1);
        // subscribe() settles first, which lapses the old subscription, then re-subscribes
        vm.startPrank(alice);
        billing.deposit(HOBBY_PRICE);
        billing.subscribe(HOBBY);
        vm.stopPrank();
        assertTrue(billing.isActive(alice));
        assertEq(billing.earned(), HOBBY_PRICE);
    }

    function test_settleMany() public {
        _depositSubscribe(alice, 100e6, HOBBY);
        _depositSubscribe(bob, 100e6, PRO);
        vm.warp(block.timestamp + 10 days);

        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        billing.settleMany(users);

        uint256 expected = (HOBBY_PRICE / 3) + (PRO_PRICE / 3);
        assertEq(billing.earned(), expected);
    }

    // ---------------------------------------------------------------
    // plan changes
    // ---------------------------------------------------------------

    function test_changePlanSettlesOldRateThenAppliesNew() public {
        _depositSubscribe(alice, 100e6, HOBBY);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.changePlan(PRO);
        assertEq(billing.earned(), HOBBY_PRICE / 2); // old rate settled

        vm.warp(block.timestamp + 15 days);
        assertEq(billing.pendingCharge(alice), PRO_PRICE / 2); // new rate applies
        assertTrue(billing.isActive(alice));
    }

    function test_changePlanRequiresNewMonthFunded() public {
        _depositSubscribe(alice, HOBBY_PRICE, HOBBY); // only $5 in escrow
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionBilling.InsufficientBalance.selector, HOBBY_PRICE, PRO_PRICE
            )
        );
        billing.changePlan(PRO);
    }

    function test_changePlanNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.changePlan(HOBBY);
    }

    // ---------------------------------------------------------------
    // cancel & refund
    // ---------------------------------------------------------------

    function test_cancelRefundsEverythingUnused() public {
        _depositSubscribe(alice, 20e6, HOBBY);
        vm.warp(block.timestamp + 6 days); // 1/5 of a period -> $1 accrued

        uint256 expectedRefund = 20e6 - HOBBY_PRICE / 5;
        vm.prank(alice);
        uint256 refund = billing.cancel();

        assertEq(refund, expectedRefund);
        assertEq(usdc.balanceOf(alice), 1_000e6 - 20e6 + expectedRefund);
        assertEq(billing.currentBalance(alice), 0);
        assertFalse(billing.isActive(alice));
        assertEq(billing.earned(), HOBBY_PRICE / 5); // operator keeps the used $1
    }

    function test_cancelNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_cancelAtExactPeriodBoundary() public {
        _depositSubscribe(alice, HOBBY_PRICE, HOBBY);
        vm.warp(block.timestamp + PERIOD);
        vm.prank(alice);
        uint256 refund = billing.cancel();
        assertEq(refund, 0);
        assertEq(billing.earned(), HOBBY_PRICE);
    }

    // ---------------------------------------------------------------
    // operator
    // ---------------------------------------------------------------

    function test_withdrawEarned() public {
        _depositSubscribe(alice, 100e6, PRO);
        vm.warp(block.timestamp + PERIOD);
        billing.settle(alice);

        uint256 earnedNow = billing.earned();
        assertEq(earnedNow, PRO_PRICE);

        vm.prank(operator);
        billing.withdrawEarned(operator, earnedNow);
        assertEq(billing.earned(), 0);
        assertEq(usdc.balanceOf(operator), earnedNow);
    }

    function test_withdrawEarnedOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        billing.withdrawEarned(alice, 1);
    }

    function test_withdrawEarnedCannotTouchEscrow() public {
        _depositSubscribe(alice, 100e6, HOBBY); // nothing earned yet
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.ExceedsEarned.selector, 0, 1));
        billing.withdrawEarned(operator, 1);
        assertEq(usdc.balanceOf(address(billing)), 100e6);
    }

    // ---------------------------------------------------------------
    // plan administration
    // ---------------------------------------------------------------

    function test_setPlanAffectsOnlyNewSubscribers() public {
        _depositSubscribe(alice, 100e6, HOBBY); // snapshots $5

        vm.prank(operator);
        billing.setPlan(HOBBY, 6e6, true);

        // existing subscriber keeps the snapshotted price
        vm.warp(block.timestamp + PERIOD);
        assertEq(billing.pendingCharge(alice), HOBBY_PRICE);

        // new subscriber pays the new price
        _depositSubscribe(bob, 100e6, HOBBY);
        assertEq(billing.getAccount(bob).price, 6e6);
    }

    function test_setPlanOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        billing.setPlan(HOBBY, 6e6, true);
    }

    function test_deactivatedPlanRejectsNewSubscribers() public {
        vm.prank(operator);
        billing.setPlan(HOBBY, HOBBY_PRICE, false);

        vm.prank(alice);
        billing.deposit(100e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.PlanNotActive.selector, 0));
        billing.subscribe(HOBBY);
    }

    function test_addPlan() public {
        vm.prank(operator);
        uint256 id = billing.addPlan(100e6);
        assertEq(id, 2);
        (uint256 price, bool active) = billing.plans(2);
        assertEq(price, 100e6);
        assertTrue(active);
    }

    // ---------------------------------------------------------------
    // fuzz
    // ---------------------------------------------------------------

    function testFuzz_accrualMatchesFormula(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, PERIOD - 1);
        _depositSubscribe(alice, 100e6, PRO);
        vm.warp(block.timestamp + elapsed);
        assertEq(billing.pendingCharge(alice), (PRO_PRICE * elapsed) / PERIOD);
        assertTrue(billing.isActive(alice));
    }

    function testFuzz_depositWithdrawRoundtrip(uint256 amount) public {
        amount = bound(amount, 1, 1_000e6);
        vm.prank(alice);
        billing.deposit(amount);
        vm.prank(alice);
        billing.withdraw(amount);
        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(usdc.balanceOf(address(billing)), 0);
    }
}
