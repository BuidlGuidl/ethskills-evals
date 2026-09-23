// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WeatherBilling} from "../src/WeatherBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function bound(uint256, uint256, uint256) external returns (uint256);
}

contract WeatherBillingTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 constant PERIOD = 30 days;
    uint256 constant HOBBY = 5_000_000;
    uint256 constant PRO = 20_000_000;
    uint256 constant START = 1_700_000_000;

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant OWNER = address(0x5EED);

    MockUSDC token;
    WeatherBilling billing;

    function setUp() public {
        vm.warp(START);
        token = new MockUSDC();
        billing = new WeatherBilling(OWNER, address(token), HOBBY, PRO);
        token.mint(ALICE, 1_000e6);
        token.mint(BOB, 1_000e6);
    }

    function assertTrue(bool condition, string memory message) internal pure {
        if (!condition) revert(message);
    }

    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        if (a != b) revert(message);
    }

    function assertLe(uint256 a, uint256 b, string memory message) internal pure {
        if (a > b) revert(message);
    }

    function state(address customer) internal view returns (WeatherBilling.Subscription memory s) {
        (s.status, s.planId, s.price, s.lastSettle, s.credit) = billing.subs(customer);
    }

    function expectRevert(address target, bytes memory data, bytes4 expected) internal {
        (bool ok, bytes memory ret) = target.call(data);
        assertTrue(!ok, "expected revert");
        assertEq(uint32(bytes4(ret)), uint32(expected), "wrong error");
    }

    function topUp(address customer, uint256 amount, uint256 planId) internal {
        vm.startPrank(customer);
        token.approve(address(billing), amount);
        billing.depositAndSubscribe(amount, planId);
        vm.stopPrank();
    }

    function deposit(address customer, uint256 amount) internal {
        vm.startPrank(customer);
        token.approve(address(billing), amount);
        billing.deposit(amount);
        vm.stopPrank();
    }

    function test_initial_state() public {
        assertTrue(billing.owner() == OWNER, "owner");
        assertTrue(address(billing.usdc()) == address(token), "usdc");
        assertEq(billing.planPrice(0), HOBBY, "hobby price");
        assertEq(billing.planPrice(1), PRO, "pro price");
        assertEq(billing.totalCredits(), 0, "no credit");
        assertEq(billing.totalSettled(), 0, "no revenue");
        assertTrue(!billing.isSubscribed(ALICE), "nobody subscribed");
    }

    function test_deposit_pulls_and_credits() public {
        deposit(ALICE, 100e6);
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(s.credit, 100e6, "credit recorded");
        assertEq(uint8(s.status), 0, "still None status");
        assertEq(token.balanceOf(address(billing)), 100e6, "contract holds USDC");
        assertEq(token.balanceOf(ALICE), 900e6, "tokens pulled");
        assertEq(billing.totalCredits(), 100e6, "total credits");
        assertTrue(!billing.isSubscribed(ALICE), "deposit alone does not subscribe");
    }

    function test_deposit_rejects_zero() public {
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.deposit.selector, uint256(0)),
            WeatherBilling.InvalidAmount.selector
        );
    }

    function test_subscribe_needs_credit() public {
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.subscribe.selector, uint256(0)),
            WeatherBilling.InsufficientCredit.selector
        );
    }

    function test_subscribe_unknown_plan() public {
        deposit(ALICE, 100e6);
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.subscribe.selector, uint256(7)),
            WeatherBilling.UnknownPlan.selector
        );
    }

    function test_subscribe_minimum_one_period_of_credit() public {
        deposit(ALICE, HOBBY);
        vm.prank(ALICE);
        billing.subscribe(0);
        assertTrue(billing.isSubscribed(ALICE), "exactly one period is enough");

        deposit(BOB, HOBBY - 1);
        vm.prank(BOB);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.subscribe.selector, uint256(0)),
            WeatherBilling.InsufficientCredit.selector
        );
    }

    function test_deposit_and_subscribe_single_tx() public {
        topUp(ALICE, 10e6, 0);
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(uint8(s.status), 1, "active");
        assertEq(s.planId, 0, "hobby plan");
        assertEq(s.price, HOBBY, "price snapshot");
        assertEq(s.credit, 10e6, "credit");
        assertEq(s.lastSettle, START, "accrual starts at subscribe time");
        assertTrue(billing.isSubscribed(ALICE), "subscribed");
        assertEq(billing.remainingCredit(ALICE), 10e6, "nothing accrued yet");
    }

    function test_subscribe_reverts_while_active() public {
        topUp(ALICE, 10e6, 0);
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.subscribe.selector, uint256(0)),
            WeatherBilling.AlreadyActive.selector
        );
    }

    function test_half_month_settlement() public {
        topUp(ALICE, 10e6, 0);
        vm.warp(START + 15 days);
        assertEq(billing.accruedCost(ALICE), HOBBY / 2, "accrued is half a month");
        assertEq(billing.remainingCredit(ALICE), 10e6 - HOBBY / 2, "remaining");
        assertTrue(billing.isSubscribed(ALICE), "still subscribed");
        billing.settle(ALICE);
        assertEq(token.balanceOf(OWNER), HOBBY / 2, "owner paid");
        assertEq(billing.totalSettled(), HOBBY / 2, "revenue counter");
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(s.credit, 10e6 - HOBBY / 2, "credit after settle");
        assertEq(uint8(s.status), 1, "still active");
        assertTrue(billing.isSubscribed(ALICE), "subscribed after settle");
    }

    function test_full_periods_then_exact_boundary_lapse() public {
        topUp(ALICE, 10e6, 0);
        vm.warp(START + 30 days);
        billing.settle(ALICE);
        assertEq(token.balanceOf(OWNER), HOBBY, "first month paid");
        assertEq(state(ALICE).credit, 5e6, "one month left");
        vm.warp(START + 60 days);
        assertTrue(!billing.isSubscribed(ALICE), "paid-through expired exactly");
        assertEq(billing.remainingCredit(ALICE), 0, "nothing left");
        billing.settle(ALICE);
        assertEq(token.balanceOf(OWNER), 2 * HOBBY, "second month paid");
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(uint8(s.status), 3, "lapsed");
        assertEq(s.credit, 0, "no credit left");
        assertTrue(!billing.isSubscribed(ALICE), "lapsed means unsubscribed");
    }

    function test_one_month_credit_lapses_at_30_days() public {
        topUp(ALICE, HOBBY, 0);
        vm.warp(START + 30 days - 1);
        assertTrue(billing.isSubscribed(ALICE), "subscribed until the last second");
        vm.warp(START + 30 days);
        assertTrue(!billing.isSubscribed(ALICE), "expired at exactly 30 days");
        billing.settle(ALICE);
        assertEq(token.balanceOf(OWNER), HOBBY, "charged exactly one month");
    }

    function test_lapse_caps_cost_at_credit_and_forgives_gap() public {
        topUp(ALICE, HOBBY, 0);
        vm.warp(START + 45 days);
        assertTrue(!billing.isSubscribed(ALICE), "ran out at 30 days");
        billing.settle(ALICE);
        assertEq(token.balanceOf(OWNER), HOBBY, "never more than the credit");
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(uint8(s.status), 3, "lapsed");
        assertEq(s.credit, 0, "drained");
        assertEq(s.lastSettle, START + 45 days, "gap is not billed later");
    }

    function test_resubscribe_after_lapse_starts_clean() public {
        topUp(ALICE, HOBBY, 0);
        vm.warp(START + 45 days);
        billing.settle(ALICE);
        deposit(ALICE, HOBBY);
        vm.prank(ALICE);
        billing.subscribe(0);
        assertEq(billing.remainingCredit(ALICE), HOBBY, "fresh credit, fresh clock");
        assertTrue(billing.isSubscribed(ALICE), "subscribed again");
    }

    function test_cancel_refunds_unused_credit() public {
        topUp(ALICE, 10e6, 0);
        vm.warp(START + 10 days);
        vm.prank(ALICE);
        billing.cancel();
        uint256 accrued = 10 days * HOBBY / PERIOD;
        assertEq(token.balanceOf(OWNER), accrued, "owner keeps earned part");
        assertEq(token.balanceOf(ALICE), 1000e6 - 10e6 + (10e6 - accrued), "refund of unspent");
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(uint8(s.status), 2, "cancelled");
        assertEq(s.credit, 0, "no stranded credit");
        assertEq(billing.totalCredits(), 0, "pot empty");
        assertEq(token.balanceOf(address(billing)), 0, "contract empty");
        assertTrue(!billing.isSubscribed(ALICE), "cancelled means unsubscribed");
    }

    function test_cancel_after_exhaustion_refunds_zero() public {
        topUp(ALICE, HOBBY, 0);
        vm.warp(START + 45 days);
        vm.prank(ALICE);
        billing.cancel();
        assertEq(token.balanceOf(OWNER), HOBBY, "all credit was earned");
        assertEq(token.balanceOf(ALICE), 1000e6 - HOBBY, "nothing to refund");
        assertEq(uint8(state(ALICE).status), 2, "cancelled");
    }

    function test_cancel_then_resubscribe_needs_new_deposit() public {
        topUp(ALICE, 10e6, 0);
        vm.prank(ALICE);
        billing.cancel();
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.subscribe.selector, uint256(0)),
            WeatherBilling.InsufficientCredit.selector
        );
    }

    function test_withdraw_when_inactive() public {
        deposit(ALICE, 50e6);
        vm.prank(ALICE);
        billing.withdraw(20e6);
        assertEq(state(ALICE).credit, 30e6, "partial withdrawal");
        assertEq(token.balanceOf(ALICE), 1000e6 - 50e6 + 20e6, "tokens back");
        vm.prank(ALICE);
        billing.withdraw(30e6);
        assertEq(state(ALICE).credit, 0, "fully withdrawn");
        assertEq(token.balanceOf(address(billing)), 0, "contract empty");
    }

    function test_withdraw_blocked_while_active() public {
        topUp(ALICE, 10e6, 0);
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.withdraw.selector, uint256(1)),
            WeatherBilling.SubscriptionActive.selector
        );
    }

    function test_withdraw_rejects_overdraw() public {
        deposit(ALICE, 10e6);
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.withdraw.selector, uint256(10e6 + 1)),
            WeatherBilling.InvalidAmount.selector
        );
    }

    function test_switch_plan_settles_then_reprices() public {
        topUp(ALICE, 40e6, 0);
        vm.warp(START + 15 days);
        vm.prank(ALICE);
        billing.switchPlan(1);
        assertEq(token.balanceOf(OWNER), HOBBY / 2, "settled at old plan first");
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(s.price, PRO, "new price snapshot");
        assertEq(s.planId, 1, "new plan");
        assertEq(s.credit, 40e6 - HOBBY / 2, "credit after settle");
        vm.warp(START + 30 days);
        assertEq(billing.accruedCost(ALICE), PRO / 2, "accrues at pro rate");
        billing.settle(ALICE);
        assertEq(token.balanceOf(OWNER), HOBBY / 2 + PRO / 2, "pro half-month paid");
    }

    function test_switch_plan_needs_credit_for_new_plan() public {
        topUp(ALICE, 10e6, 0);
        vm.warp(START + 15 days);
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.switchPlan.selector, uint256(1)),
            WeatherBilling.InsufficientCredit.selector
        );
    }

    function test_switch_plan_reverts_when_lapsed() public {
        topUp(ALICE, HOBBY, 0);
        vm.warp(START + 40 days);
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.switchPlan.selector, uint256(1)),
            WeatherBilling.NotActive.selector
        );
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(uint8(s.status), 1, "unchanged by revert");
        assertEq(s.credit, HOBBY, "credit intact");
        billing.settle(ALICE);
        assertEq(uint8(state(ALICE).status), 3, "explicit settle lapses");
    }

    function test_settle_many_batch() public {
        topUp(ALICE, 10e6, 0);
        topUp(BOB, 20e6, 1);
        vm.warp(START + 15 days);
        address[] memory customers = new address[](3);
        customers[0] = ALICE;
        customers[1] = BOB;
        customers[2] = address(0xdead);
        billing.settleMany(customers);
        assertEq(token.balanceOf(OWNER), HOBBY / 2 + PRO / 2, "both settled, stranger ignored");
    }

    function test_deposit_while_active_settles_first() public {
        topUp(ALICE, 10e6, 0);
        vm.warp(START + 15 days);
        deposit(ALICE, 100e6);
        assertEq(token.balanceOf(OWNER), HOBBY / 2, "accrued paid before top-up");
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(s.credit, 10e6 - HOBBY / 2 + 100e6, "old accrual did not eat new deposit");
        assertEq(billing.totalCredits(), s.credit, "pot matches");
        assertEq(uint8(s.status), 1, "still active");
    }

    function test_truncation_favors_customer() public {
        topUp(ALICE, 10e6, 0);
        vm.warp(START + 1);
        billing.settle(ALICE);
        assertEq(billing.totalSettled(), 1, "one second costs one base unit, not two");
        assertEq(state(ALICE).credit, 10e6 - 1, "charged at most the true rate");
    }

    function test_price_change_grandfathers_active_subs() public {
        topUp(ALICE, 10e6, 0);
        vm.prank(OWNER);
        billing.setPlan(0, 7e6);
        assertEq(billing.planPrice(0), 7e6, "new price for new subs");
        assertEq(state(ALICE).price, HOBBY, "active sub keeps snapshot");
        vm.warp(START + 30 days);
        billing.settle(ALICE);
        assertEq(token.balanceOf(OWNER), HOBBY, "charged old price");
        topUp(BOB, 10e6, 0);
        vm.warp(START + 60 days);
        billing.settle(BOB);
        assertEq(token.balanceOf(OWNER), HOBBY + 7e6, "bob charged new price");
    }

    function test_zero_price_disables_plan() public {
        vm.prank(OWNER);
        billing.setPlan(1, 0);
        deposit(ALICE, 100e6);
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.subscribe.selector, uint256(1)),
            WeatherBilling.UnknownPlan.selector
        );
    }

    function test_sweep_excess_only() public {
        deposit(ALICE, 10e6);
        vm.prank(BOB);
        token.transfer(address(billing), 5e6);
        assertEq(token.balanceOf(address(billing)), 15e6, "mistaken direct transfer");
        vm.prank(OWNER);
        billing.sweepExcess();
        assertEq(token.balanceOf(OWNER), 5e6, "excess recovered");
        assertEq(token.balanceOf(address(billing)), 10e6, "customer credit untouched");
        assertEq(billing.totalCredits(), 10e6, "accounting intact");
    }

    function test_sweep_is_noop_without_excess() public {
        deposit(ALICE, 10e6);
        vm.prank(OWNER);
        billing.sweepExcess();
        assertEq(token.balanceOf(OWNER), 0, "nothing swept");
        assertEq(token.balanceOf(address(billing)), 10e6, "credit stays");
    }

    function test_ownership_two_step() public {
        vm.prank(OWNER);
        billing.transferOwnership(BOB);
        assertTrue(billing.owner() == OWNER, "owner unchanged until accepted");
        assertTrue(billing.pendingOwner() == BOB, "pending set");
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.acceptOwnership.selector),
            WeatherBilling.NotPendingOwner.selector
        );
        vm.prank(BOB);
        billing.acceptOwnership();
        assertTrue(billing.owner() == BOB, "ownership moved");
        assertTrue(billing.pendingOwner() == address(0), "pending cleared");
    }

    function test_owner_functions_guarded() public {
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.setPlan.selector, uint256(3), uint256(1e6)),
            WeatherBilling.NotOwner.selector
        );
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.sweepExcess.selector),
            WeatherBilling.NotOwner.selector
        );
        vm.prank(ALICE);
        expectRevert(
            address(billing),
            abi.encodeWithSelector(WeatherBilling.transferOwnership.selector, ALICE),
            WeatherBilling.NotOwner.selector
        );
    }

    function test_pot_matches_total_credits_across_sequence() public {
        topUp(ALICE, 10e6, 0);
        deposit(BOB, 20e6);
        assertEq(token.balanceOf(address(billing)), billing.totalCredits(), "after deposits");
        vm.warp(START + 15 days);
        address[] memory customers = new address[](2);
        customers[0] = BOB;
        customers[1] = ALICE;
        billing.settleMany(customers);
        assertEq(token.balanceOf(address(billing)), billing.totalCredits(), "after settle");
        vm.prank(ALICE);
        billing.cancel();
        assertEq(token.balanceOf(address(billing)), billing.totalCredits(), "after cancel");
        vm.prank(BOB);
        billing.withdraw(20e6);
        assertEq(token.balanceOf(address(billing)), billing.totalCredits(), "after withdraw");
        assertEq(billing.totalCredits(), 0, "pot empty at the end");
    }

    function testFuzz_settle_conserves_funds(uint96 amount, uint48 delta) public {
        uint256 depositAmount = HOBBY + uint256(amount) % (1000e6 - HOBBY + 1);
        uint256 elapsed = 1 + uint256(delta) % (400 days);
        topUp(ALICE, depositAmount, 0);
        vm.warp(START + elapsed);
        billing.settle(ALICE);
        uint256 paid = token.balanceOf(OWNER);
        assertLe(paid, elapsed * HOBBY / PERIOD, "never overcharged");
        assertLe(paid, depositAmount, "never more than credit");
        WeatherBilling.Subscription memory s = state(ALICE);
        assertEq(paid + s.credit, depositAmount, "funds conserved");
        assertEq(token.balanceOf(address(billing)), billing.totalCredits(), "pot matches");
        assertTrue(
            billing.isSubscribed(ALICE) == (s.status == WeatherBilling.Status.Active), "view consistent with state"
        );
    }

    function testFuzz_cancel_conserves_funds(uint96 amount, uint48 delta) public {
        uint256 depositAmount = HOBBY + uint256(amount) % (1000e6 - HOBBY + 1);
        uint256 elapsed = 1 + uint256(delta) % (400 days);
        topUp(ALICE, depositAmount, 0);
        vm.warp(START + elapsed);
        vm.prank(ALICE);
        billing.cancel();
        uint256 paid = token.balanceOf(OWNER);
        assertLe(paid, elapsed * HOBBY / PERIOD, "never overcharged");
        uint256 refunded = token.balanceOf(ALICE) - (1000e6 - depositAmount);
        assertEq(paid + refunded, depositAmount, "funds conserved");
        assertEq(token.balanceOf(address(billing)), 0, "contract empty after cancel");
        assertEq(billing.totalCredits(), 0, "no stranded accounting");
    }
}
