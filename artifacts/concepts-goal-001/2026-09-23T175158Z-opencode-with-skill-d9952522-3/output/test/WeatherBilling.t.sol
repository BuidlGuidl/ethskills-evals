// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

contract MockUSDC {
    string public constant name = "Mock USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "insufficient allowance");
        allowance[from][msg.sender] = allowed - amount;
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract RawPlanCaller {
    function subscribe(address target, uint8 plan) external {
        WeatherBilling(target).subscribe(WeatherBilling.Plan(plan));
    }
}

contract WeatherBillingTest is Test {
    WeatherBilling internal billing;
    MockUSDC internal usdc;

    address internal operator = makeAddr("operator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 constant PERIOD = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new WeatherBilling(address(usdc), operator);
        usdc.mint(alice, 100_000_000e6);
        vm.startPrank(alice);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _startHobby(uint256 credit, uint256 t0) internal {
        billing.topUp(credit);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        assertEq(billing.paidThrough(alice), t0 + credit * PERIOD / 5_000_000);
    }

    function test_onboarding_two_transactions() public {
        uint256 t0 = block.timestamp;
        _startHobby(10e6, t0);
        assertTrue(billing.isSubscribed(alice));
        (WeatherBilling.Plan plan, uint256 credit, uint64 lastSettled,) =
            billing.getAccount(alice);
        assertEq(uint8(plan), uint8(WeatherBilling.Plan.Hobby));
        assertEq(credit, 10e6);
        assertEq(lastSettled, t0);
    }

    function test_paidThrough_is_two_months_for_ten_dollars() public {
        uint256 t0 = block.timestamp;
        billing.topUp(10e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        assertEq(billing.paidThrough(alice), t0 + 60 days);
    }

    function test_credit_alone_is_not_subscribed() public {
        billing.topUp(10e6);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.paidThrough(alice), 0);
    }

    function test_subscribe_rejects_zero_credit_and_bad_plan() public {
        RawPlanCaller raw = new RawPlanCaller();
        vm.expectRevert(WeatherBilling.InvalidPlan.selector);
        billing.subscribe(WeatherBilling.Plan.None);
        vm.expectRevert(abi.encodeWithSelector(0x4e487b71, 0x21));
        raw.subscribe(address(billing), 7);
        billing.topUp(1e6);
        billing.cancel();
        vm.expectRevert(WeatherBilling.InsufficientCredit.selector);
        billing.subscribe(WeatherBilling.Plan.Hobby);
    }

    function test_topUp_rejects_zero() public {
        vm.expectRevert(WeatherBilling.ZeroAmount.selector);
        billing.topUp(0);
    }

    function test_subscription_expires_exactly_when_credit_runs_out() public {
        uint256 t0 = block.timestamp;
        billing.topUp(5e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        assertEq(billing.paidThrough(alice), t0 + 30 days);
        vm.warp(t0 + 30 days - 1);
        assertTrue(billing.isSubscribed(alice));
        vm.warp(t0 + 30 days);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancel_mid_month_refunds_exact_pro_rata() public {
        uint256 t0 = block.timestamp;
        billing.topUp(10e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(t0 + 15 days);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 100_000_000e6 - 10e6 + 7_500_000);
        assertEq(billing.revenuePool(), 2.5e6);
        assertFalse(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(address(billing)), 2.5e6);
    }

    function test_topUp_while_active_extends_paidThrough() public {
        uint256 t0 = block.timestamp;
        billing.topUp(10e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(t0 + 10 days);
        billing.topUp(5e6);
        (, uint256 credit,,) = billing.getAccount(alice);
        uint256 expectedCredit = 10e6 - 10 days * 5e6 / PERIOD + 5e6;
        assertEq(credit, expectedCredit);
        assertEq(billing.paidThrough(alice), block.timestamp + expectedCredit * PERIOD / 5e6);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_lapse_is_reported_without_any_transaction() public {
        uint256 t0 = block.timestamp;
        billing.topUp(5e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(t0 + 40 days);
        assertFalse(billing.isSubscribed(alice));
        (, uint256 credit,,) = billing.getAccount(alice);
        assertGt(credit, 0);
    }

    function test_resume_after_lapse_charges_nothing_for_the_gap() public {
        uint256 t0 = block.timestamp;
        billing.topUp(5e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(t0 + 40 days);
        billing.topUp(5e6);
        (WeatherBilling.Plan plan,,,) = billing.getAccount(alice);
        assertEq(uint8(plan), uint8(WeatherBilling.Plan.None));
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.revenuePool(), 5e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        (, uint256 credit, uint64 lastSettled,) = billing.getAccount(alice);
        assertEq(credit, 5e6);
        assertEq(lastSettled, t0 + 40 days);
        assertEq(billing.paidThrough(alice), t0 + 70 days);
        assertEq(billing.revenuePool(), 5e6);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_cancel_after_lapse_refunds_nothing_and_clears() public {
        uint256 t0 = block.timestamp;
        billing.topUp(5e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(t0 + 40 days);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 100_000_000e6 - 5e6);
        assertEq(billing.revenuePool(), 5e6);
    }

    function test_plan_switch_settles_at_old_rate_then_reanchors() public {
        uint256 t0 = block.timestamp;
        billing.topUp(20e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(t0 + 10 days);
        billing.subscribe(WeatherBilling.Plan.Pro);
        (, uint256 credit, uint64 lastSettled,) = billing.getAccount(alice);
        assertEq(credit, 18_333_334);
        assertEq(lastSettled, t0 + 10 days);
        assertEq(billing.revenuePool(), 1_666_666);
        assertEq(billing.paidThrough(alice), t0 + 3_240_000);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_revenue_withdraw_only_operator() public {
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NotOperator.selector);
        billing.withdrawRevenue();

        vm.startPrank(alice);
        uint256 t0 = block.timestamp;
        billing.topUp(10e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(t0 + 15 days);
        billing.cancel();
        vm.stopPrank();

        assertEq(billing.revenuePool(), 2.5e6);
        vm.prank(operator);
        billing.withdrawRevenue();
        assertEq(usdc.balanceOf(operator), 2.5e6);
        assertEq(billing.revenuePool(), 0);
        assertEq(usdc.balanceOf(address(billing)), 0);
    }

    function test_balance_invariant_revenue_plus_credit() public {
        vm.stopPrank();
        usdc.mint(bob, 50e6);
        vm.startPrank(bob);
        usdc.approve(address(billing), type(uint256).max);
        billing.topUp(20e6);
        billing.subscribe(WeatherBilling.Plan.Pro);
        vm.stopPrank();
        vm.startPrank(alice);
        billing.topUp(10e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.warp(block.timestamp + 3 days);
        billing.topUp(2e6);
        billing.cancel();
        vm.stopPrank();
        vm.prank(bob);
        billing.cancel();

        (, uint256 aliceCredit,,) = billing.getAccount(alice);
        (, uint256 bobCredit,,) = billing.getAccount(bob);
        assertEq(usdc.balanceOf(address(billing)), billing.revenuePool() + aliceCredit + bobCredit);
    }

    function test_no_charge_for_time_before_subscribing() public {
        uint256 t0 = block.timestamp;
        vm.warp(t0 + 100 days);
        billing.topUp(5e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        (, uint256 credit, uint64 lastSettled,) = billing.getAccount(alice);
        assertEq(credit, 5e6);
        assertEq(lastSettled, t0 + 100 days);
        assertEq(billing.revenuePool(), 0);
    }
}