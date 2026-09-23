// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling, IERC20} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling billing;
    MockUSDC usdc;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant HOBBY = 5e6; // $5 per 30 days
    uint256 constant PRO = 20e6; // $20 per 30 days
    uint256 constant PERIOD = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(address(usdc));

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(billing), type(uint256).max);
    }

    // ---------- subscribe ----------

    function test_subscribe_storesPlanAndPullsFunds() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, 50e6);

        (SubscriptionBilling.Plan plan, uint256 balance, uint256 lastSettled) =
            billing.subscriptions(alice);
        assertEq(uint256(plan), uint256(SubscriptionBilling.Plan.Hobby));
        assertEq(balance, 50e6);
        assertEq(lastSettled, block.timestamp);
        assertEq(usdc.balanceOf(address(billing)), 50e6);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_subscribe_revertsWithoutApproval() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, 50e6);
        vm.prank(carol);
        vm.expectRevert("insufficient allowance");
        billing.subscribe(SubscriptionBilling.Plan.Hobby, 50e6);
    }

    function test_subscribe_revertsWhileActive() public {
        vm.startPrank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, 50e6);
        vm.expectRevert(SubscriptionBilling.AlreadySubscribed.selector);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, 50e6);
        vm.stopPrank();
    }

    // ---------- accrual ----------

    function test_balanceBurnsDownPerSecond() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);

        skip(15 days);
        // Halfway through the period: half the deposit remains.
        assertEq(billing.remainingBalance(alice), HOBBY / 2);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_subscriptionLapsesWhenBalanceRunsOut() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);

        skip(PERIOD + 1);
        assertEq(billing.remainingBalance(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_isSubscribed_neverNeedsAPoke() public {
        // Nobody calls settle() in this test at all — reads are still correct.
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Pro, 10e6); // half a month of Pro

        skip(15 days - 1);
        assertTrue(billing.isSubscribed(alice));
        skip(2);
        assertFalse(billing.isSubscribed(alice));
    }

    // ---------- settle ----------

    function test_settle_movesFeesToOwner() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);

        skip(6 days); // 6/30 of $5 = $1
        billing.settle(alice); // anyone may call this

        assertEq(billing.accruedFees(), 1e6);
        assertEq(billing.remainingBalance(alice), 4e6);
    }

    function test_settle_afterLapse_chargesOnlyWhatIsThere() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);

        skip(365 days); // way past the money
        billing.settle(alice);

        assertEq(billing.accruedFees(), HOBBY); // capped at the deposit
        assertEq(billing.remainingBalance(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    // ---------- cancel / refund ----------

    function test_cancel_refundsUnspentBalance() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);

        skip(15 days);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), before + HOBBY / 2); // unused half back
        assertEq(billing.accruedFees(), HOBBY / 2); // used half is revenue
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancel_afterLapse_refundsNothing() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);

        skip(365 days);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), before);
        assertEq(billing.accruedFees(), HOBBY);
    }

    function test_userCanResubscribeAfterCancel() public {
        vm.startPrank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);
        billing.cancel();
        billing.subscribe(SubscriptionBilling.Plan.Pro, PRO);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.remainingBalance(alice), PRO);
    }

    // ---------- topUp ----------

    function test_topUp_extendsSubscription() public {
        vm.startPrank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);
        skip(15 days);
        billing.topUp(HOBBY);
        vm.stopPrank();

        // $2.50 remaining + $5 new = $7.50, i.e. 45 more days of Hobby.
        assertEq(billing.remainingBalance(alice), HOBBY / 2 + HOBBY);
        assertEq(billing.secondsUntilLapse(alice), 45 days);
    }

    function test_topUp_afterLapse_restartsClockWithoutBackDebt() public {
        vm.startPrank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);
        skip(365 days); // lapsed long ago
        billing.topUp(HOBBY);
        vm.stopPrank();

        // Full new deposit available — no charge for the lapsed gap.
        assertEq(billing.remainingBalance(alice), HOBBY);
        assertTrue(billing.isSubscribed(alice));
    }

    // ---------- changePlan ----------

    function test_changePlan_settlesAtOldRateThenChargesNewRate() public {
        vm.startPrank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, 20e6);
        skip(15 days); // $2.50 burned at Hobby
        billing.changePlan(SubscriptionBilling.Plan.Pro);
        vm.stopPrank();

        assertEq(billing.remainingBalance(alice), 20e6 - HOBBY / 2);

        skip(15 days); // 15 more days at Pro = $10
        assertEq(billing.remainingBalance(alice), 20e6 - HOBBY / 2 - 10e6);
    }

    // ---------- withdrawFees ----------

    function test_withdrawFees_ownerOnly_andNeverTouchesPrincipal() public {
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Hobby, HOBBY);
        skip(6 days);
        billing.settle(alice); // permissionless — anyone can poke it

        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.withdrawFees(bob);

        billing.withdrawFees(owner);
        assertEq(usdc.balanceOf(owner), 1e6);
        assertEq(billing.accruedFees(), 0);

        // The remaining $4 of user principal is still in the contract and
        // still refundable to Alice.
        skip(6 days);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1_000e6 - 2e6);
    }
}
