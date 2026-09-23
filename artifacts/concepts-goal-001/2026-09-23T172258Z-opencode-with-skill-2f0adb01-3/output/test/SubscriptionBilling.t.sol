// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    uint128 constant HOBBY = 5e6; // $5 / 30 days
    uint128 constant PRO = 20e6; // $20 / 30 days
    uint256 constant HOBBY_ID = 1;
    uint256 constant PRO_ID = 2;

    MockUSDC usdc;
    SubscriptionBilling billing;
    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(address(usdc), HOBBY, PRO);
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(billing), type(uint256).max);
    }

    // -- plan setup ----------------------------------------------------

    function test_plansSeeded() public view {
        (uint128 price, bool exists) = billing.plans(HOBBY_ID);
        assertEq(price, HOBBY);
        assertTrue(exists);
        (price, exists) = billing.plans(PRO_ID);
        assertEq(price, PRO);
        assertTrue(exists);
    }

    function test_ownerCanSetPlan() public {
        billing.setPlan(3, 50e6);
        (uint128 price, bool exists) = billing.plans(3);
        assertEq(price, 50e6);
        assertTrue(exists);
    }

    function test_setPlan_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.setPlan(3, 50e6);
    }

    // -- top up + subscribe ---------------------------------------------

    function test_topUpAndSubscribe() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();

        assertTrue(billing.isActive(alice));
        (uint256 planId, uint256 balance,, bool subscribed, bool activeNow) = billing.getAccount(alice);
        assertEq(planId, HOBBY_ID);
        assertEq(balance, 10e6);
        assertTrue(subscribed);
        assertTrue(activeNow);
        assertEq(usdc.balanceOf(address(billing)), 10e6);
    }

    function test_subscribeToUnknownPlanReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.PlanDoesNotExist.selector);
        billing.subscribe(99);
    }

    function test_doubleSubscribeReverts() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        vm.expectRevert(SubscriptionBilling.AlreadySubscribed.selector);
        billing.subscribe(PRO_ID);
        vm.stopPrank();
    }

    // -- accrual ---------------------------------------------------------

    function test_accruesPerSecond() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();

        skip(15 days);
        // half the period -> half the price owed
        (,, uint256 owed,,) = billing.getAccount(alice);
        assertEq(owed, HOBBY / 2);
        assertTrue(billing.isActive(alice));
    }

    function test_settleMovesFeesToEarned() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();

        skip(30 days);
        billing.settle(alice); // permissionless poke
        assertEq(billing.earned(), HOBBY);
        assertTrue(billing.isActive(alice)); // 10e6 balance - 5e6 charged
    }

    // -- cancel + refund -------------------------------------------------

    function test_cancelRefundsUnused() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        skip(15 days);
        billing.cancel();
        vm.stopPrank();

        // used ~$2.50, gets the rest back
        assertEq(usdc.balanceOf(alice), 1000e6 - HOBBY / 2);
        assertFalse(billing.isActive(alice));
        assertEq(billing.earned(), HOBBY / 2);
    }

    function test_cancelWhenNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_resubscribeAfterCancel() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        skip(1 days);
        billing.cancel();
        billing.topUp(20e6);
        billing.subscribe(PRO_ID);
        vm.stopPrank();
        assertTrue(billing.isActive(alice));
        (uint256 planId,,,,) = billing.getAccount(alice);
        assertEq(planId, PRO_ID);
    }

    // -- lapse ------------------------------------------------------------

    function test_lapsesWhenBalanceRunsOut() public {
        vm.startPrank(alice);
        billing.topUp(5e6); // exactly one hobby month
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();

        skip(31 days);
        assertFalse(billing.isActive(alice)); // view sees it immediately, no poke needed

        billing.settle(alice); // operator (or anyone) finalizes it
        assertEq(billing.earned(), 5e6);
        (,,, bool subscribed,) = billing.getAccount(alice);
        assertFalse(subscribed);
    }

    function test_topUpAndResubscribeAfterLapse() public {
        vm.startPrank(alice);
        billing.topUp(5e6);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();

        skip(31 days);
        vm.startPrank(alice);
        billing.topUp(5e6);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();
        assertTrue(billing.isActive(alice));
    }

    // -- balance withdrawal without subscription --------------------------

    function test_withdrawBalanceWithoutSubscription() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.withdrawBalance();
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 1000e6);
    }

    function test_withdrawBalanceRevertsWhileSubscribed() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        vm.expectRevert(SubscriptionBilling.StillSubscribed.selector);
        billing.withdrawBalance();
        vm.stopPrank();
    }

    // -- operator revenue ---------------------------------------------------

    function test_withdrawEarned() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();

        vm.startPrank(bob);
        billing.topUp(40e6);
        billing.subscribe(PRO_ID);
        vm.stopPrank();

        skip(30 days);
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        billing.settleMany(accounts); // anyone can batch-settle

        uint256 expected = HOBBY + PRO;
        assertEq(billing.earned(), expected);

        uint256 before = usdc.balanceOf(owner);
        billing.withdrawEarned();
        assertEq(usdc.balanceOf(owner) - before, expected);
        assertEq(billing.earned(), 0);
    }

    function test_withdrawEarned_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.withdrawEarned();
    }

    // -- invariant: contract solvency ---------------------------------------

    function test_contractAlwaysSolvent() public {
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();
        vm.startPrank(bob);
        billing.topUp(40e6);
        billing.subscribe(PRO_ID);
        vm.stopPrank();

        skip(365 days);
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        billing.settleMany(accounts);
        billing.withdrawEarned();

        // everyone lapsed, no balances left, contract drained exactly
        assertEq(usdc.balanceOf(address(billing)), 0);
    }
}
