// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    uint256 constant HOBBY = 5e6; // $5 / month (USDC has 6 decimals)
    uint256 constant PRO = 20e6; // $20 / month
    uint256 constant MONTH = 30 days;

    MockUSDC usdc;
    SubscriptionBilling billing;
    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(address(usdc), HOBBY, PRO);
        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(billing), type(uint256).max);
    }

    // -- deposit -----------------------------------------------------

    function test_deposit_pullsUsdcIntoEscrow() public {
        vm.prank(alice);
        billing.deposit(100e6);
        assertEq(usdc.balanceOf(address(billing)), 100e6);
        (,, uint256 balance,) = billing.accountOf(alice);
        assertEq(balance, 100e6);
    }

    function test_deposit_zeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.deposit(0);
    }

    function test_deposit_withoutApprovalReverts() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, 100e6);
        vm.prank(carol);
        vm.expectRevert(SubscriptionBilling.TransferFailed.selector);
        billing.deposit(100e6);
    }

    // -- subscribe ---------------------------------------------------

    function test_subscribe_requiresFirstMonthPrepaid() public {
        vm.startPrank(alice);
        billing.deposit(4e6); // less than hobby price
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 4e6, HOBBY)
        );
        billing.subscribe(SubscriptionBilling.Plan.Hobby);
        vm.stopPrank();
    }

    function test_subscribe_hobbyIsActiveImmediately() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 100e6);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_subscribe_twiceReverts() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 100e6);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.AlreadySubscribed.selector);
        billing.subscribe(SubscriptionBilling.Plan.Hobby);
    }

    // -- per-second accrual ------------------------------------------

    function test_chargesAccruePerSecond() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 100e6);
        skip(MONTH / 2); // half a month → ~$2.50 charged on settle
        billing.poke(alice);
        (,, uint256 balance,) = billing.accountOf(alice);
        assertEq(balance, 100e6 - HOBBY / 2);
        assertEq(billing.collected(), HOBBY / 2);
    }

    function test_pokeIsPermissionless() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 100e6);
        skip(MONTH);
        vm.prank(bob); // a stranger can checkpoint alice's account
        billing.poke(alice);
        assertEq(billing.collected(), HOBBY);
    }

    // -- lapse --------------------------------------------------------

    function test_lapsesExactlyWhenBalanceExhausts() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 10e6); // 2 months prepaid
        uint256 expected = vm.getBlockTimestamp() + 2 * MONTH;

        skip(2 * MONTH - 1);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.paidThrough(alice), expected);

        skip(2);
        assertFalse(billing.isSubscribed(alice)); // past paidThrough now
    }

    function test_lapsedUserCanResubscribe() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 5e6);
        skip(MONTH + 1);
        assertFalse(billing.isSubscribed(alice));

        vm.startPrank(alice);
        billing.deposit(20e6);
        billing.subscribe(SubscriptionBilling.Plan.Pro);
        vm.stopPrank();
        assertTrue(billing.isSubscribed(alice));
    }

    // -- cancel --------------------------------------------------------

    function test_cancel_refundsUnusedToTheSecond() public {
        _subscribeAlice(SubscriptionBilling.Plan.Pro, 100e6);
        skip(7 days);
        uint256 owed = (7 days * PRO) / MONTH;

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), before + 100e6 - owed);
        assertEq(billing.collected(), owed);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancel_whenNotSubscribedRefundsEverything() public {
        vm.startPrank(alice);
        billing.deposit(42e6);
        billing.cancel();
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 1_000e6);
    }

    // -- plan switching ------------------------------------------------

    function test_switchPlan_settlesOldRateThenAppliesNew() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 100e6);
        skip(MONTH); // one full hobby month
        vm.prank(alice);
        billing.switchPlan(SubscriptionBilling.Plan.Pro);

        (SubscriptionBilling.Plan plan, uint256 price, uint256 balance,) = billing.accountOf(alice);
        assertEq(uint256(plan), uint256(SubscriptionBilling.Plan.Pro));
        assertEq(price, PRO);
        assertEq(balance, 100e6 - HOBBY);
    }

    // -- price snapshot -------------------------------------------------

    function test_priceChange_doesNotAffectExistingSubscribers() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 100e6);
        billing.setPlanPrice(SubscriptionBilling.Plan.Hobby, 50e6); // 10x hike

        skip(MONTH);
        billing.poke(alice);
        assertEq(billing.collected(), HOBBY); // still charged the old $5

        // new subscribers get the new price snapshot
        vm.startPrank(bob);
        billing.deposit(100e6);
        billing.subscribe(SubscriptionBilling.Plan.Hobby);
        vm.stopPrank();
        (, uint256 price,,) = billing.accountOf(bob);
        assertEq(price, 50e6);
    }

    // -- owner withdrawals ----------------------------------------------

    function test_withdraw_onlyCollectedFees() public {
        _subscribeAlice(SubscriptionBilling.Plan.Hobby, 100e6);
        skip(MONTH);
        billing.poke(alice);

        billing.withdraw(HOBBY);
        assertEq(usdc.balanceOf(owner), HOBBY);

        // 95 USDC of customer escrow is untouchable
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.ExceedsCollected.selector, 0, 95e6)
        );
        billing.withdraw(95e6);

        // and the customer can still cancel and get it all back
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), before + 95e6);
    }

    function test_withdraw_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.withdraw(1);
    }

    function test_setPlanPrice_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.setPlanPrice(SubscriptionBilling.Plan.Hobby, 1e6);
    }

    // -- helpers ---------------------------------------------------------

    function _subscribeAlice(SubscriptionBilling.Plan plan, uint256 depositAmount) internal {
        vm.startPrank(alice);
        billing.deposit(depositAmount);
        billing.subscribe(plan);
        vm.stopPrank();
    }
}
