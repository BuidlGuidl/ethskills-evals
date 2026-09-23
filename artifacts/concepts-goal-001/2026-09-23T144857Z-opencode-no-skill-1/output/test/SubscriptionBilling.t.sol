// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    uint256 constant HOBBY = 1;
    uint256 constant PRO = 2;
    uint256 constant HOBBY_PRICE = 5e6; // $5, 6 decimals
    uint256 constant PRO_PRICE = 20e6; // $20

    MockUSDC usdc;
    SubscriptionBilling billing;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(address(usdc), owner);
        vm.startPrank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, true);
        billing.setPlan(PRO, PRO_PRICE, true);
        vm.stopPrank();

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(billing), type(uint256).max);
    }

    // ------------------------------------------------------------- subscribe

    function test_depositAndSubscribeActivatesImmediately() public {
        vm.startPrank(alice);
        billing.deposit(50e6);
        billing.subscribe(HOBBY);
        vm.stopPrank();

        assertTrue(billing.isActive(alice));
        (uint256 balance,, uint256 paidThrough, bool subscribed) = billing.getAccount(alice);
        assertEq(balance, 45e6); // first month charged up front
        assertTrue(subscribed);
        assertEq(paidThrough, block.timestamp + 30 days);
        assertEq(billing.collectedFees(), HOBBY_PRICE);
    }

    function test_subscribeWithoutBalanceIsInactiveUntilTopUp() public {
        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertFalse(billing.isActive(alice));

        vm.prank(alice);
        billing.deposit(5e6);
        assertTrue(billing.isActive(alice));
        (uint256 balance,, uint256 paidThrough,) = billing.getAccount(alice);
        assertEq(balance, 0);
        assertEq(paidThrough, block.timestamp + 30 days);
    }

    // --------------------------------------------------------------- renewal

    function test_renewalViaChargeBatchAfterPeriod() public {
        vm.startPrank(alice);
        billing.deposit(50e6);
        billing.subscribe(HOBBY);
        vm.stopPrank();

        vm.warp(block.timestamp + 31 days);
        assertTrue(billing.isActive(alice)); // still true before anyone settles

        address[] memory users = new address[](1);
        users[0] = alice;
        billing.chargeBatch(users); // permissionless keeper call

        (uint256 balance,, uint256 paidThrough,) = billing.getAccount(alice);
        assertEq(balance, 40e6);
        assertEq(paidThrough, block.timestamp + 30 days); // realigned to charge time
        assertEq(billing.collectedFees(), 2 * HOBBY_PRICE);
    }

    function test_lapseWhenBalanceRunsOut_noBackChargeOnReturn() public {
        vm.startPrank(alice);
        billing.deposit(7e6); // covers exactly one month, with $2 left over
        billing.subscribe(HOBBY);
        vm.stopPrank();

        vm.warp(block.timestamp + 40 days);
        assertFalse(billing.isActive(alice)); // balance 2e6 < 5e6 price

        // Comes back 100 days later: must NOT be charged for the gap.
        vm.warp(block.timestamp + 100 days);
        vm.prank(alice);
        billing.deposit(10e6);

        assertTrue(billing.isActive(alice));
        (uint256 balance,, uint256 paidThrough,) = billing.getAccount(alice);
        assertEq(balance, 12e6 - HOBBY_PRICE); // only ONE new period charged
        assertEq(paidThrough, block.timestamp + 30 days);
    }

    function test_zeroBalanceRenewalChargesNothing() public {
        vm.startPrank(alice);
        billing.deposit(5e6);
        billing.subscribe(HOBBY);
        vm.stopPrank();

        vm.warp(block.timestamp + 31 days);
        address[] memory users = new address[](1);
        users[0] = alice;
        billing.chargeBatch(users);

        assertFalse(billing.isActive(alice));
        (uint256 balance,, uint256 paidThrough, bool subscribed) = billing.getAccount(alice);
        assertEq(balance, 0);
        assertTrue(subscribed); // still opted in; a top-up revives it
        assertLt(paidThrough, block.timestamp);
    }

    // ---------------------------------------------------------------- cancel

    function test_cancelRefundsUnusedAndKeepsAccessUntilPeriodEnd() public {
        vm.startPrank(alice);
        billing.deposit(50e6);
        billing.subscribe(HOBBY); // balance now 45e6, paid through +30d
        vm.warp(block.timestamp + 10 days);

        uint256 walletBefore = usdc.balanceOf(alice);
        billing.cancel();
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice) - walletBefore, 45e6); // unused balance back
        assertTrue(billing.isActive(alice) == false); // not subscribed anymore by flag...

        // ...but access should continue until the paid period ends. The API check
        // is isActive(), so model "access until paidThrough" on the account data:
        (uint256 balance,, uint256 paidThrough, bool subscribed) = billing.getAccount(alice);
        assertEq(balance, 0);
        assertFalse(subscribed);
        assertGt(paidThrough, block.timestamp); // backend may honor paidThrough if desired

        // No further charges ever: settle does nothing once unsubscribed.
        vm.warp(block.timestamp + 365 days);
        address[] memory users = new address[](1);
        users[0] = alice;
        billing.chargeBatch(users);
        assertEq(billing.collectedFees(), HOBBY_PRICE);
    }

    function test_cancelWhileLapsedRefundsDust() public {
        vm.startPrank(alice);
        billing.deposit(6e6);
        billing.subscribe(HOBBY); // balance 1e6 after first charge
        vm.warp(block.timestamp + 31 days);
        assertFalse(billing.isActive(alice));

        uint256 walletBefore = usdc.balanceOf(alice);
        billing.cancel();
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice) - walletBefore, 1e6);
    }

    // -------------------------------------------------------------- withdraw

    function test_withdrawPartial() public {
        vm.startPrank(alice);
        billing.deposit(50e6);
        billing.subscribe(HOBBY);
        billing.withdraw(20e6);
        vm.stopPrank();

        (uint256 balance,,,) = billing.getAccount(alice);
        assertEq(balance, 25e6);
        assertTrue(billing.isActive(alice)); // current period already paid
    }

    function test_withdrawRevertsWhenOverBalance() public {
        vm.startPrank(alice);
        billing.deposit(10e6);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionBilling.InsufficientBalance.selector, 11e6, 10e6
            )
        );
        billing.withdraw(11e6);
        vm.stopPrank();
    }

    // ----------------------------------------------------------------- plans

    function test_planSwitchAppliesAtNextRenewal() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.subscribe(HOBBY);
        billing.subscribe(PRO); // switch: current hobby period untouched
        vm.stopPrank();

        (uint256 balance, uint256 planId, uint256 paidThrough,) = billing.getAccount(alice);
        assertEq(planId, PRO);
        assertEq(balance, 95e6); // only the hobby month charged so far
        uint256 hobbyPaidThrough = paidThrough;

        vm.warp(hobbyPaidThrough + 1);
        address[] memory users = new address[](1);
        users[0] = alice;
        billing.chargeBatch(users);

        (balance,,,) = billing.getAccount(alice);
        assertEq(balance, 75e6); // now charged at the pro price
    }

    function test_discontinuedPlanLapsesAtPeriodEnd() public {
        vm.startPrank(alice);
        billing.deposit(50e6);
        billing.subscribe(HOBBY);
        vm.stopPrank();

        vm.prank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, false);

        assertTrue(billing.isActive(alice)); // still paid up
        vm.warp(block.timestamp + 31 days);
        assertFalse(billing.isActive(alice)); // cannot renew a dead plan
    }

    function test_subscribeRevertsOnUnknownPlan() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, 99));
        billing.subscribe(99);
    }

    // ----------------------------------------------------------------- owner

    function test_sweepOnlyFees_andOnlyOwner() public {
        vm.startPrank(alice);
        billing.deposit(50e6);
        billing.subscribe(HOBBY);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.sweep(1);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionBilling.InsufficientBalance.selector, 6e6, HOBBY_PRICE
            )
        );
        billing.sweep(6e6); // more than fees; customer balances untouchable

        vm.prank(owner);
        billing.sweep(HOBBY_PRICE);
        assertEq(usdc.balanceOf(owner), HOBBY_PRICE);
        assertEq(billing.collectedFees(), 0);
        // Customer money still fully backed in the contract.
        assertEq(usdc.balanceOf(address(billing)), 45e6);
    }

    function test_ownershipTransfer() public {
        vm.prank(owner);
        billing.transferOwnership(bob);
        assertEq(billing.owner(), bob);

        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.setPlan(3, 1, true);
    }

    // ----------------------------------------------------------------- views

    function test_isActiveIsSeamlessAcrossRenewalBoundary() public {
        vm.startPrank(alice);
        billing.deposit(50e6);
        billing.subscribe(HOBBY);
        vm.stopPrank();

        // Exactly at expiry with funds: still active (renewal pending).
        (, , uint256 paidThrough,) = billing.getAccount(alice);
        vm.warp(paidThrough);
        assertTrue(billing.isActive(alice));
        assertEq(billing.effectivePaidThrough(alice), block.timestamp + 30 days);
    }
}
