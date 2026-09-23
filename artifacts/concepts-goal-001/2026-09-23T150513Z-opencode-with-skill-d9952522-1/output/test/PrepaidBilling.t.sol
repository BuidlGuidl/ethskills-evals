// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PrepaidBilling} from "../src/PrepaidBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract PrepaidBillingTest is Test {
    uint128 constant HOBBY = 5e6; // $5/mo
    uint128 constant PRO = 20e6; // $20/mo
    uint256 constant MONTH = 30 days;

    MockUSDC usdc;
    PrepaidBilling billing;
    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        billing = new PrepaidBilling(address(usdc), HOBBY, PRO);
        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(billing), type(uint256).max);
        vm.warp(1_700_000_000);
    }

    /// @dev Deposit + subscribe as alice; returns the subscribe timestamp.
    function aliceSubscribes(uint128 depositAmount, uint8 planId) internal returns (uint256 t0) {
        vm.startPrank(alice);
        billing.deposit(depositAmount);
        billing.subscribe(planId);
        vm.stopPrank();
        t0 = block.timestamp;
    }

    function test_depositAndSubscribe() public {
        aliceSubscribes(50e6, 0);

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.effectiveBalance(alice), 50e6);
        // $50 at $5/mo lasts 10 months
        assertEq(billing.subscribedUntil(alice), block.timestamp + 10 * MONTH);
    }

    function test_subscribeWithoutBalanceReverts() public {
        vm.prank(alice);
        vm.expectRevert(PrepaidBilling.InsufficientBalance.selector);
        billing.subscribe(0);
    }

    function test_accruesPerSecond() public {
        uint256 t0 = aliceSubscribes(5e6, 0);

        vm.warp(t0 + MONTH);
        assertEq(billing.effectiveBalance(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_partialMonthAccrual() public {
        uint256 t0 = aliceSubscribes(10e6, 0);

        vm.warp(t0 + MONTH / 2);
        assertEq(billing.effectiveBalance(alice), 10e6 - HOBBY / 2);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_expiryBoundary() public {
        aliceSubscribes(5e6, 0);

        uint256 expiry = billing.subscribedUntil(alice);
        vm.warp(expiry - 1);
        assertTrue(billing.isSubscribed(alice));
        vm.warp(expiry);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancelRefundsUnused() public {
        uint256 t0 = aliceSubscribes(20e6, 0);

        vm.warp(t0 + MONTH); // one month consumed: $5
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice) - before, 15e6);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.effectiveBalance(alice), 0);
        assertEq(billing.earned(), 5e6);
    }

    function test_switchPlanSettlesAtOldRate() public {
        uint256 t0 = aliceSubscribes(100e6, 0);

        vm.warp(t0 + MONTH); // $5 consumed on hobby
        vm.prank(alice);
        billing.subscribe(1); // switch to pro

        assertEq(billing.earned(), 5e6);
        assertEq(billing.effectiveBalance(alice), 95e6);
        // $95 at $20/mo = 4.75 months
        assertEq(billing.subscribedUntil(alice), block.timestamp + (95e6 * MONTH) / PRO);
    }

    function test_topUpExtendsSubscription() public {
        uint256 t0 = aliceSubscribes(5e6, 0);

        vm.warp(t0 + MONTH / 2);
        vm.prank(alice);
        billing.deposit(5e6); // settles $2.50, balance back to $7.50

        uint256 expiry = billing.subscribedUntil(alice);
        vm.warp(expiry - 1);
        assertTrue(billing.isSubscribed(alice));
        vm.warp(expiry);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_resubscribeAfterExpiryChargesOnlyWhatWasThere() public {
        uint256 t0 = aliceSubscribes(5e6, 0);

        // run way past expiry; charges are capped at the balance, no debt accrues
        vm.warp(t0 + 365 days);
        assertFalse(billing.isSubscribed(alice));

        aliceSubscribes(5e6, 0);

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.earned(), 5e6); // only the original $5, not a year of charges
        assertEq(billing.effectiveBalance(alice), 5e6);
    }

    function test_ownerWithdrawsEarnedOnly() public {
        uint256 t0 = aliceSubscribes(20e6, 0);

        vm.warp(t0 + MONTH);
        // settle alice's accrual via the permissionless path
        billing.settle(alice);
        assertEq(billing.earned(), 5e6);

        billing.withdrawRevenue(owner, 5e6);
        assertEq(usdc.balanceOf(owner), 5e6);

        // nothing left to take even though $15 of customer funds sit in the contract
        vm.expectRevert(PrepaidBilling.NothingToWithdraw.selector);
        billing.withdrawRevenue(owner, 1);
    }

    function test_nonOwnerCannotWithdrawRevenue() public {
        vm.prank(alice);
        vm.expectRevert(PrepaidBilling.NotOwner.selector);
        billing.withdrawRevenue(alice, 1);
    }

    function test_withdrawWhileInactive() public {
        vm.prank(alice);
        billing.deposit(10e6);
        vm.prank(alice);
        billing.withdraw();
        assertEq(usdc.balanceOf(alice), 1_000e6);
    }

    function test_withdrawWhileActiveReverts() public {
        vm.startPrank(alice);
        billing.deposit(10e6);
        billing.subscribe(0);
        vm.expectRevert(PrepaidBilling.NotSubscribed.selector);
        billing.withdraw();
        vm.stopPrank();
    }

    function test_unknownPlanReverts() public {
        vm.prank(alice);
        billing.deposit(10e6);
        vm.prank(alice);
        vm.expectRevert(PrepaidBilling.PlanDoesNotExist.selector);
        billing.subscribe(7);
    }

    function test_doubleCancelReverts() public {
        vm.startPrank(alice);
        billing.deposit(10e6);
        billing.subscribe(0);
        billing.cancel();
        vm.expectRevert(PrepaidBilling.NotSubscribed.selector);
        billing.cancel();
        vm.stopPrank();
    }
}
