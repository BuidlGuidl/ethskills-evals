// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract WeatherBillingTest is Test {
    WeatherBilling billing;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");

    uint128 constant HOBBY = 5_000_000;
    uint128 constant PRO = 20_000_000;
    uint256 constant MONTH = 30 days;

    function setUp() public {
        vm.prank(owner);
        usdc = new MockUSDC();
        billing = new WeatherBilling(address(usdc), owner, HOBBY, PRO);
    }

    function _fund(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _subscribe(address user, WeatherBilling.Plan plan, uint256 amount) internal {
        _fund(user, amount);
        vm.startPrank(user);
        billing.topUp(amount);
        billing.setPlan(plan);
        vm.stopPrank();
    }

    function _account(address user) internal view returns (WeatherBilling.Account memory) {
        (WeatherBilling.Plan plan, uint128 price, uint64 lastSettled, uint256 balance,,) =
            billing.getAccount(user);
        return WeatherBilling.Account(plan, price, lastSettled, balance);
    }

    function test_constructor_state() public view {
        assertEq(address(billing.usdc()), address(usdc));
        assertEq(billing.owner(), owner);
        assertEq(billing.hobbyPrice(), HOBBY);
        assertEq(billing.proPrice(), PRO);
        assertEq(billing.BILLING_PERIOD(), MONTH);
        assertEq(billing.totalEarned(), 0);
    }

    function test_constructor_reverts() public {
        vm.expectRevert(WeatherBilling.ZeroAddress.selector);
        new WeatherBilling(address(0), owner, HOBBY, PRO);
        vm.expectRevert(WeatherBilling.ZeroAddress.selector);
        new WeatherBilling(address(usdc), address(0), HOBBY, PRO);
        vm.expectRevert(WeatherBilling.ZeroAmount.selector);
        new WeatherBilling(address(usdc), owner, 0, PRO);
        vm.expectRevert(WeatherBilling.ZeroAmount.selector);
        new WeatherBilling(address(usdc), owner, HOBBY, 0);
    }

    function test_top_up_and_subscribe() public {
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        WeatherBilling.Account memory a = _account(alice);
        assertEq(uint8(a.plan), uint8(WeatherBilling.Plan.Hobby));
        assertEq(a.price, HOBBY);
        assertEq(a.lastSettled, block.timestamp);
        assertEq(a.balance, HOBBY);
        assertTrue(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(address(billing)), HOBBY);
        assertEq(billing.secondsRemaining(alice), MONTH);
    }

    function test_top_up_without_plan_is_not_subscribed() public {
        _fund(alice, HOBBY);
        vm.startPrank(alice);
        billing.topUp(HOBBY);
        vm.stopPrank();
        assertFalse(billing.isSubscribed(alice));
        assertEq(uint8(_account(alice).plan), uint8(WeatherBilling.Plan.None));
        assertEq(_account(alice).balance, HOBBY);
    }

    function test_set_plan_first_then_top_up() public {
        vm.startPrank(alice);
        billing.setPlan(WeatherBilling.Plan.Pro);
        assertFalse(billing.isSubscribed(alice));
        vm.stopPrank();
        _fund(alice, PRO);
        vm.prank(alice);
        billing.topUp(PRO);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_full_month_charge_hobby() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.warp(t0 + MONTH);
        vm.prank(keeper);
        billing.settle(alice);
        assertEq(_account(alice).balance, 0);
        assertEq(_account(alice).lastSettled, t0 + MONTH);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.totalEarned(), HOBBY);
    }

    function test_exhaustion_never_charges_past_zero() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY / 2);
        vm.warp(t0 + MONTH / 2 + 1 hours);
        vm.prank(keeper);
        billing.settle(alice);
        WeatherBilling.Account memory a = _account(alice);
        assertEq(a.balance, 0);
        assertEq(a.price, HOBBY);
        assertEq(a.lastSettled, t0 + MONTH / 2);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.secondsRemaining(alice), 0);
        assertEq(billing.totalEarned(), HOBBY / 2);
    }

    function test_retopup_after_gap_charges_nothing_for_downtime() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY / 2);
        vm.warp(t0 + MONTH / 2);
        vm.prank(keeper);
        billing.settle(alice);
        assertEq(billing.totalEarned(), HOBBY / 2);
        vm.warp(t0 + MONTH / 2 + 10 days);
        _fund(alice, HOBBY);
        vm.prank(alice);
        billing.topUp(HOBBY);
        assertEq(_account(alice).balance, HOBBY);
        assertEq(_account(alice).lastSettled, t0 + MONTH / 2 + 10 days);
        assertEq(billing.totalEarned(), HOBBY / 2);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_cancel_refunds_prorated() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.warp(t0 + 15 days);
        assertTrue(billing.isSubscribed(alice));
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), aliceBefore + HOBBY / 2);
        assertEq(billing.totalEarned(), HOBBY / 2);
        WeatherBilling.Account memory a = _account(alice);
        assertEq(uint8(a.plan), uint8(WeatherBilling.Plan.None));
        assertEq(a.price, 0);
        assertEq(a.balance, 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancel_without_plan_refunds_full_deposit() public {
        _fund(alice, 3 ether);
        vm.startPrank(alice);
        billing.topUp(3 ether);
        billing.cancel();
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 3 ether);
        assertEq(usdc.balanceOf(address(billing)), 0);
        assertEq(billing.totalEarned(), 0);
    }

    function test_cancel_when_already_exhausted_refunds_zero() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY / 2);
        vm.warp(t0 + 40 days);
        assertFalse(billing.isSubscribed(alice));
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), aliceBefore);
        assertEq(billing.totalEarned(), HOBBY / 2);
    }

    function test_plan_switch_mid_cycle() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, 20e6);
        vm.warp(t0 + 15 days);
        vm.prank(alice);
        billing.setPlan(WeatherBilling.Plan.Pro);
        WeatherBilling.Account memory a = _account(alice);
        assertEq(uint8(a.plan), uint8(WeatherBilling.Plan.Pro));
        assertEq(a.price, PRO);
        assertEq(a.lastSettled, t0 + 15 days);
        assertEq(a.balance, 17.5e6);
        assertEq(billing.totalEarned(), 2.5e6);
        assertTrue(billing.isSubscribed(alice));
        vm.warp(t0 + 30 days);
        vm.prank(alice);
        billing.cancel();
        assertEq(billing.totalEarned(), 12.5e6);
        assertEq(usdc.balanceOf(alice), 7.5e6);
    }

    function test_price_change_grandfathers_existing_subscribers() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.prank(owner);
        billing.setPrices(10e6, 40e6);
        _subscribe(bob, WeatherBilling.Plan.Hobby, 10e6);
        vm.warp(t0 + MONTH);
        vm.prank(keeper);
        billing.settle(alice);
        vm.prank(keeper);
        billing.settle(bob);
        assertEq(billing.totalEarned(), HOBBY + 10e6);
        assertEq(_account(alice).price, HOBBY);
        assertEq(_account(bob).price, 10e6);
        vm.prank(alice);
        billing.setPlan(WeatherBilling.Plan.Hobby);
        assertEq(_account(alice).price, 10e6);
    }

    function test_settle_many() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        _subscribe(bob, WeatherBilling.Plan.Pro, PRO);
        vm.warp(t0 + MONTH);
        address[] memory users = new address[](3);
        users[0] = alice;
        users[1] = bob;
        users[2] = keeper;
        vm.prank(keeper);
        billing.settleMany(users);
        assertEq(billing.totalEarned(), HOBBY + PRO);
        assertFalse(billing.isSubscribed(alice));
        assertFalse(billing.isSubscribed(bob));
        assertFalse(billing.isSubscribed(keeper));
    }

    function test_withdraw_earned() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        _subscribe(bob, WeatherBilling.Plan.Pro, PRO);
        vm.warp(t0 + MONTH);
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        vm.prank(keeper);
        billing.settleMany(users);
        assertEq(billing.totalEarned(), HOBBY + PRO);
        assertEq(usdc.balanceOf(address(billing)), HOBBY + PRO);
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.withdrawEarned(1);
        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        billing.withdrawEarned(HOBBY + PRO);
        assertEq(usdc.balanceOf(owner), ownerBefore + HOBBY + PRO);
        assertEq(billing.totalEarned(), 0);
        vm.prank(owner);
        vm.expectRevert(WeatherBilling.InsufficientEarned.selector);
        billing.withdrawEarned(1);
    }

    function test_partial_settle_then_withdraw_leaves_prepaid_funds_intact() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.warp(t0 + 15 days);
        vm.prank(keeper);
        billing.settle(alice);
        assertEq(billing.totalEarned(), 2.5e6);
        assertEq(usdc.balanceOf(address(billing)), HOBBY);
        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        billing.withdrawEarned(2.5e6);
        assertEq(usdc.balanceOf(owner), ownerBefore + 2.5e6);
        assertEq(usdc.balanceOf(address(billing)), 2.5e6);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 2.5e6);
        assertEq(usdc.balanceOf(address(billing)), 0);
    }

    function test_seconds_remaining() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Pro, PRO);
        assertEq(billing.secondsRemaining(alice), MONTH);
        vm.warp(t0 + 10 days);
        assertEq(billing.secondsRemaining(alice), 20 days);
        vm.warp(t0 + 35 days);
        assertEq(billing.secondsRemaining(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_is_subscribed_is_live_when_state_is_stale() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY / 2);
        vm.warp(t0 + 40 days);
        assertEq(_account(alice).balance, HOBBY / 2);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_small_elapsed_rounds_down_and_keeps_clock() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY);
        vm.warp(t0 + 1);
        vm.prank(keeper);
        billing.settle(alice);
        assertEq(_account(alice).balance, HOBBY - 1);
        vm.warp(t0 + 2);
        vm.prank(keeper);
        billing.settle(alice);
        assertEq(_account(alice).balance, HOBBY - 2);
        assertEq(_account(alice).lastSettled, t0 + 2);
    }

    function test_zero_and_invalid_inputs() public {
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.ZeroAmount.selector);
        billing.topUp(0);
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.InvalidPlan.selector);
        billing.setPlan(WeatherBilling.Plan.None);
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.setPrices(1, 1);
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.transferOwnership(alice);
        vm.prank(owner);
        vm.expectRevert(WeatherBilling.ZeroAddress.selector);
        billing.transferOwnership(address(0));
        vm.prank(owner);
        vm.expectRevert(WeatherBilling.ZeroAmount.selector);
        billing.setPrices(0, 1);
    }

    function test_ownership_transfer() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        billing.transferOwnership(newOwner);
        assertEq(billing.owner(), newOwner);
        vm.prank(owner);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.setPrices(1, 1);
        vm.prank(newOwner);
        billing.setPrices(6e6, 25e6);
        assertEq(billing.hobbyPrice(), 6e6);
        assertEq(billing.proPrice(), 25e6);
    }

    function test_current_price() public view {
        assertEq(billing.currentPrice(WeatherBilling.Plan.Hobby), HOBBY);
        assertEq(billing.currentPrice(WeatherBilling.Plan.Pro), PRO);
    }

    function test_reentrancy_blocked() public {
        ReentrantUSDC token = new ReentrantUSDC();
        WeatherBilling evilBilling = new WeatherBilling(address(token), owner, HOBBY, PRO);
        vm.expectRevert(WeatherBilling.ReentrantCall.selector);
        token.attack(evilBilling, 1e6);
    }

    function test_solvent_invariant() public {
        uint256 t0 = 1;
        _subscribe(alice, WeatherBilling.Plan.Hobby, HOBBY * 3);
        _subscribe(bob, WeatherBilling.Plan.Pro, PRO * 2);
        vm.warp(t0 + 45 days);
        _fund(alice, HOBBY);
        vm.prank(alice);
        billing.topUp(HOBBY);
        vm.warp(t0 + 50 days);
        vm.prank(bob);
        billing.cancel();
        vm.prank(keeper);
        billing.settle(alice);
        uint256 aliceBalance = _account(alice).balance;
        uint256 bobBalance = _account(bob).balance;
        assertEq(aliceBalance, 11_666_667);
        assertEq(bobBalance, 0);
        assertEq(billing.totalEarned(), 41_666_666);
        assertEq(
            usdc.balanceOf(address(billing)),
            billing.totalEarned() + aliceBalance + bobBalance,
            "contract funds must equal earned + remaining prepaid balances"
        );
    }
}

contract ReentrantUSDC {
    WeatherBilling public billing;
    uint256 public reentryAmount;

    function attack(WeatherBilling billing_, uint256 reentryAmount_) external {
        billing = billing_;
        reentryAmount = reentryAmount_;
        billing.topUp(reentryAmount);
    }

    function transferFrom(address, address, uint256) external returns (bool) {
        billing.topUp(reentryAmount);
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }
}
