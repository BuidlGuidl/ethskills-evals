// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling, IERC20} from "../src/SubscriptionBilling.sol";

/// @notice Minimal 6-decimal ERC-20 standing in for USDC.
contract MockUSDC {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
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
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SubscriptionBillingTest is Test {
    MockUSDC usdc;
    SubscriptionBilling billing;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant HOBBY = 5e6;
    uint256 constant PRO = 20e6;
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

    function _depositSubscribe(address who, uint256 amount, SubscriptionBilling.Plan plan) internal {
        vm.startPrank(who);
        billing.deposit(amount);
        billing.subscribe(plan);
        vm.stopPrank();
    }

    function test_depositAddsBalance() public {
        vm.prank(alice);
        billing.deposit(50e6);
        (, uint256 balance,) = billing.accounts(alice);
        assertEq(balance, 50e6);
        assertEq(usdc.balanceOf(address(billing)), 50e6);
    }

    function test_subscribeRequiresOnePeriodPrepaid() public {
        vm.startPrank(alice);
        billing.deposit(HOBBY - 1);
        vm.expectRevert(SubscriptionBilling.BalanceBelowPlanPrice.selector);
        billing.subscribe(SubscriptionBilling.Plan.Hobby);
        vm.stopPrank();
    }

    function test_isSubscribedAfterSubscribe() public {
        _depositSubscribe(alice, HOBBY, SubscriptionBilling.Plan.Hobby);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_chargesAtMonthlyRate() public {
        _depositSubscribe(alice, PRO, SubscriptionBilling.Plan.Pro);
        skip(15 days);
        // halfway through a pro period: $10 consumed
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1_000e6 - PRO / 2);
        assertEq(billing.accruedFees(), PRO / 2);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_lapsesWhenBalanceRunsOut() public {
        _depositSubscribe(alice, HOBBY, SubscriptionBilling.Plan.Hobby);
        skip(PERIOD + 1);
        assertFalse(billing.isSubscribed(alice));
        // settling now: the whole $5 went to fees, nothing refunded, no debt
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1_000e6 - HOBBY);
        assertEq(billing.accruedFees(), HOBBY);
    }

    function test_noBackDebtAfterLapse() public {
        _depositSubscribe(alice, HOBBY, SubscriptionBilling.Plan.Hobby);
        skip(365 days); // lapsed long ago
        // top up and resubscribe: only the new money is in play, no catch-up charge
        _depositSubscribe(alice, HOBBY, SubscriptionBilling.Plan.Hobby);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.accruedFees(), HOBBY); // still just the first $5
        (, uint256 balance,) = billing.accounts(alice);
        assertEq(balance, HOBBY);
    }

    function test_cancelRefundsUnusedImmediately() public {
        _depositSubscribe(alice, 100e6, SubscriptionBilling.Plan.Hobby);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(billing.accruedFees(), 0);
    }

    function test_planSwitchChargesOldRateUntilSwitch() public {
        _depositSubscribe(alice, 100e6, SubscriptionBilling.Plan.Hobby);
        skip(PERIOD); // one hobby month: $5
        vm.prank(alice);
        billing.subscribe(SubscriptionBilling.Plan.Pro);
        skip(PERIOD); // one pro month: $20
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1_000e6 - HOBBY - PRO);
    }

    function test_withdrawPartialKeepsSubscription() public {
        _depositSubscribe(alice, 100e6, SubscriptionBilling.Plan.Hobby);
        vm.prank(alice);
        billing.withdraw(80e6);
        assertTrue(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(alice), 1_000e6 - 20e6);
    }

    function test_withdrawAllLapses() public {
        _depositSubscribe(alice, HOBBY, SubscriptionBilling.Plan.Hobby);
        vm.prank(alice);
        billing.withdraw(HOBBY);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_timeUntilLapse() public {
        _depositSubscribe(alice, HOBBY * 3, SubscriptionBilling.Plan.Hobby);
        assertEq(billing.timeUntilLapse(alice), 3 * PERIOD);
        skip(PERIOD);
        assertEq(billing.timeUntilLapse(alice), 2 * PERIOD);
    }

    function test_collectOnlyByOwner() public {
        _depositSubscribe(alice, PRO, SubscriptionBilling.Plan.Pro);
        skip(PERIOD);
        vm.prank(alice); // any touch settles; use cancel to settle alice
        billing.cancel();

        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.collect(PRO, bob);

        billing.collect(PRO, owner);
        assertEq(usdc.balanceOf(owner), PRO);
        assertEq(billing.accruedFees(), 0);
    }

    function test_cannotCollectMoreThanAccrued() public {
        _depositSubscribe(alice, PRO, SubscriptionBilling.Plan.Pro);
        vm.expectRevert(SubscriptionBilling.AmountExceedsAccrued.selector);
        billing.collect(1, owner);
    }

    function test_transferOwnership() public {
        billing.transferOwnership(bob);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.collect(0, owner);
        vm.prank(bob);
        billing.collect(0, bob);
    }
}
