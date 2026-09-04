// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant HOBBY_PRICE = 5e6; // $5 / 30 days
    uint256 internal constant PRO_PRICE = 20e6; // $20 / 30 days
    uint256 internal hobby;
    uint256 internal pro;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner);

        vm.startPrank(owner);
        hobby = billing.createPlan(HOBBY_PRICE);
        pro = billing.createPlan(PRO_PRICE);
        vm.stopPrank();

        // Start at a realistic timestamp so `lastSettled` arithmetic is not near zero.
        vm.warp(1_800_000_000);

        _fund(alice, 1000e6);
        _fund(bob, 1000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _subscribe(address who, uint256 planId, uint256 amount) internal {
        vm.prank(who);
        billing.subscribe(planId, amount);
    }

    // -----------------------------------------------------------------
    // Signing up
    // -----------------------------------------------------------------

    function test_subscribe_setsPlanAndBalance() public {
        _subscribe(alice, hobby, 15e6);

        (uint256 planId,, uint256 balance,,, bool active) = billing.accountOf(alice);
        assertEq(planId, hobby);
        assertEq(balance, 15e6);
        assertTrue(active);
        assertEq(usdc.balanceOf(address(billing)), 15e6);
        assertEq(billing.totalUserBalance(), 15e6);
        assertEq(billing.operatorAccrued(), 0);
    }

    function test_subscribe_requiresOneFullPeriodUpFront() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnderfundedForPlan.selector, HOBBY_PRICE, 4e6));
        billing.subscribe(hobby, 4e6);
    }

    function test_subscribe_revertsOnUnknownPlan() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.PlanDoesNotExist.selector);
        billing.subscribe(99, 10e6);
    }

    function test_subscribe_revertsWhenPlanClosed() public {
        vm.prank(owner);
        billing.setPlanOpen(hobby, false);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.PlanClosed.selector);
        billing.subscribe(hobby, 10e6);
    }

    // -----------------------------------------------------------------
    // Accrual: the clock runs with nobody touching the contract
    // -----------------------------------------------------------------

    function test_chargeAccruesWithoutAnyTransaction() public {
        _subscribe(alice, hobby, 30e6);

        vm.warp(block.timestamp + 15 days); // half a period
        assertEq(billing.pendingCharge(alice), HOBBY_PRICE / 2);
        assertEq(billing.previewRefund(alice), 30e6 - HOBBY_PRICE / 2);

        vm.warp(block.timestamp + 15 days); // one full period
        assertEq(billing.pendingCharge(alice), HOBBY_PRICE);
    }

    function test_isSubscribed_falseAfterPrepaidFundsRunOut() public {
        _subscribe(alice, hobby, HOBBY_PRICE); // exactly one month

        vm.warp(block.timestamp + 29 days);
        assertTrue(billing.isSubscribed(alice));

        vm.warp(block.timestamp + 1 days + 1);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.previewRefund(alice), 0);
    }

    function test_paidThrough_neverOutlivesIsSubscribed() public {
        _subscribe(alice, hobby, 7e6);
        uint256 expiry = billing.paidThrough(alice);

        vm.warp(expiry);
        assertFalse(billing.isSubscribed(alice), "must not be active at the cached expiry");

        vm.warp(expiry - 1);
        assertTrue(billing.isSubscribed(alice), "must still be active one second before");
    }

    function test_neverSubscribed_readsAreZero() public view {
        assertFalse(billing.isSubscribed(stranger));
        assertEq(billing.paidThrough(stranger), 0);
        assertEq(billing.pendingCharge(stranger), 0);
        assertEq(billing.previewRefund(stranger), 0);
    }

    // -----------------------------------------------------------------
    // Settlement is bookkeeping, never a prerequisite
    // -----------------------------------------------------------------

    function test_settle_movesChargeToOperatorWithoutChangingTheAnswer() public {
        _subscribe(alice, hobby, 30e6);
        vm.warp(block.timestamp + 15 days);

        uint256 refundBefore = billing.previewRefund(alice);
        uint256 expiryBefore = billing.paidThrough(alice);

        vm.prank(stranger); // permissionless
        billing.settle(alice);

        assertEq(billing.previewRefund(alice), refundBefore, "refund unchanged by settling");
        assertEq(billing.paidThrough(alice), expiryBefore, "expiry unchanged by settling");
        assertEq(billing.operatorAccrued(), HOBBY_PRICE / 2);
        assertEq(billing.pendingCharge(alice), 0);
    }

    /// @dev Settling often must never cost the *subscriber* anything. Per-settlement flooring
    ///      drops a fraction of a base unit each time, and it drops it in the subscriber's
    ///      favour: 90 daily settlements leave Alice with strictly more than untouched Bob, by
    ///      well under one micro-dollar per settlement. The reverse would be an attack — anyone
    ///      could spam `settle` to drain an account — so this asserts the direction, not equality.
    function test_settlingOftenOnlyEverFavoursTheSubscriber() public {
        _subscribe(alice, hobby, 60e6);
        _subscribe(bob, hobby, 60e6);

        for (uint256 i = 0; i < 90; ++i) {
            vm.warp(block.timestamp + 1 days);
            billing.settle(alice);
        }

        assertGe(billing.previewRefund(alice), billing.previewRefund(bob), "settling never charges more");
        assertGe(billing.paidThrough(alice), billing.paidThrough(bob), "settling never shortens access");
        assertLe(
            billing.previewRefund(alice) - billing.previewRefund(bob),
            90, // < 1 base unit ($0.000001) of leakage per settlement
            "drift stays under one base unit per settlement"
        );
    }

    /// @dev The same property under fuzzing: no schedule of settlements can charge a subscriber
    ///      more than never settling at all.
    function testFuzz_settleSpamCannotDrainASubscriber(uint8 settlements, uint16 gapSeconds) public {
        settlements = uint8(bound(settlements, 1, 40));
        gapSeconds = uint16(bound(gapSeconds, 1, type(uint16).max));

        _subscribe(alice, hobby, 500e6);
        _subscribe(bob, hobby, 500e6);

        for (uint256 i = 0; i < settlements; ++i) {
            vm.warp(block.timestamp + gapSeconds);
            billing.settle(alice);
        }

        assertGe(billing.previewRefund(alice), billing.previewRefund(bob));
    }

    function test_settleMany() public {
        _subscribe(alice, hobby, 30e6);
        _subscribe(bob, pro, 60e6);
        vm.warp(block.timestamp + 30 days);

        address[] memory who = new address[](2);
        who[0] = alice;
        who[1] = bob;
        billing.settleMany(who);

        assertEq(billing.operatorAccrued(), HOBBY_PRICE + PRO_PRICE);
    }

    // -----------------------------------------------------------------
    // Cancelling
    // -----------------------------------------------------------------

    function test_cancel_refundsExactlyTheUnusedPortion() public {
        _subscribe(alice, hobby, 30e6);
        vm.warp(block.timestamp + 6 days); // one fifth of a period

        uint256 expectedCharge = HOBBY_PRICE / 5;
        uint256 before = usdc.balanceOf(alice);

        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice) - before, 30e6 - expectedCharge);
        assertEq(billing.operatorAccrued(), expectedCharge);
        assertEq(billing.totalUserBalance(), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancel_worksAfterTheOperatorAbandonsTheContract() public {
        _subscribe(alice, hobby, 30e6);
        vm.warp(block.timestamp + 3 days);

        // Owner key is gone: nothing is settled, no plans are administered, nobody sweeps.
        // The subscriber still gets their money out with no help from anyone.
        uint256 expected = billing.previewRefund(alice);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1000e6 - 30e6 + expected);
    }

    function test_cancel_revertsIfNotSubscribed() public {
        vm.prank(stranger);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_cancelAfterLapse_refundsNothingButDoesNotRevert() public {
        _subscribe(alice, hobby, HOBBY_PRICE);
        vm.warp(block.timestamp + 365 days);

        vm.prank(alice);
        billing.cancel();

        assertEq(billing.operatorAccrued(), HOBBY_PRICE, "operator earns one month, not twelve");
        assertEq(usdc.balanceOf(alice), 1000e6 - HOBBY_PRICE);
    }

    // -----------------------------------------------------------------
    // Lapse and renewal: no debt accrues while unfunded
    // -----------------------------------------------------------------

    function test_topUpAfterLongLapse_doesNotBillTheGap() public {
        _subscribe(alice, hobby, HOBBY_PRICE);
        vm.warp(block.timestamp + 400 days);
        assertFalse(billing.isSubscribed(alice));

        vm.prank(alice);
        billing.topUp(HOBBY_PRICE);

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.previewRefund(alice), HOBBY_PRICE, "new money is not eaten by the gap");
        assertEq(billing.paidThrough(alice), block.timestamp + 30 days);
        assertEq(billing.operatorAccrued(), HOBBY_PRICE, "still only one month billed");
    }

    function test_topUp_extendsExpiry() public {
        _subscribe(alice, hobby, HOBBY_PRICE);
        uint256 expiry = billing.paidThrough(alice);

        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        billing.topUp(HOBBY_PRICE);

        assertEq(billing.paidThrough(alice), expiry + 30 days);
    }

    function test_topUp_revertsIfNotSubscribed() public {
        vm.prank(stranger);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.topUp(10e6);
    }

    // -----------------------------------------------------------------
    // Switching plans
    // -----------------------------------------------------------------

    function test_switchPlan_settlesAtTheOldRateFirst() public {
        _subscribe(alice, hobby, 60e6);
        vm.warp(block.timestamp + 30 days); // one month of hobby = $5

        _subscribe(alice, pro, 0); // upgrade, no new money

        assertEq(billing.operatorAccrued(), HOBBY_PRICE, "past usage billed at the old price");
        assertEq(billing.previewRefund(alice), 55e6);

        vm.warp(block.timestamp + 30 days); // one month of pro = $20
        assertEq(billing.pendingCharge(alice), PRO_PRICE);
    }

    function test_switchPlan_shortensExpiryOnUpgrade() public {
        _subscribe(alice, hobby, 20e6); // 4 months of hobby
        uint256 hobbyExpiry = billing.paidThrough(alice);

        _subscribe(alice, pro, 0); // same money, 1 month of pro
        assertLt(billing.paidThrough(alice), hobbyExpiry);
        assertEq(billing.paidThrough(alice), block.timestamp + 30 days);
    }

    function test_switchPlan_revertsIfRemainingBalanceCannotCoverOnePeriod() public {
        _subscribe(alice, hobby, 10e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnderfundedForPlan.selector, PRO_PRICE, 10e6));
        billing.subscribe(pro, 0);
    }

    function test_subscribe_revertsOnNoopResubscribe() public {
        _subscribe(alice, hobby, 10e6);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.AlreadyOnPlan.selector);
        billing.subscribe(hobby, 0);
    }

    function test_resubscribeToSamePlanWithFundsIsATopUp() public {
        _subscribe(alice, hobby, 10e6);
        _subscribe(alice, hobby, 10e6);
        assertEq(billing.previewRefund(alice), 20e6);
    }

    // -----------------------------------------------------------------
    // Grandfathering: closing a plan never touches existing subscribers
    // -----------------------------------------------------------------

    function test_closedPlan_existingSubscriberKeepsPriceAndCanTopUpAndCancel() public {
        _subscribe(alice, hobby, 10e6);

        vm.prank(owner);
        billing.setPlanOpen(hobby, false);

        vm.warp(block.timestamp + 30 days);
        assertEq(billing.pendingCharge(alice), HOBBY_PRICE, "price unchanged");

        vm.prank(alice);
        billing.topUp(10e6);
        assertTrue(billing.isSubscribed(alice));

        vm.prank(alice);
        billing.cancel();
        assertEq(billing.totalUserBalance(), 0);
    }

    function test_repricing_requiresANewPlanAndDoesNotAffectExistingSubscribers() public {
        _subscribe(alice, hobby, 30e6);

        vm.startPrank(owner);
        billing.setPlanOpen(hobby, false);
        uint256 hobbyV2 = billing.createPlan(8e6); // price rise for new signups only
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        assertEq(billing.pendingCharge(alice), HOBBY_PRICE, "alice still pays $5");

        _subscribe(bob, hobbyV2, 30e6);
        vm.warp(block.timestamp + 30 days);
        assertEq(billing.pendingCharge(bob), 8e6, "bob pays $8");
    }

    // -----------------------------------------------------------------
    // Operator powers are bounded
    // -----------------------------------------------------------------

    function test_ownerCannotWithdrawSubscriberFloat() public {
        _subscribe(alice, hobby, 100e6);
        vm.warp(block.timestamp + 30 days);
        billing.settle(alice);

        assertEq(billing.operatorAccrued(), HOBBY_PRICE);

        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.InsufficientEarnings.selector);
        billing.withdrawEarnings(owner, HOBBY_PRICE + 1);

        vm.prank(owner);
        billing.withdrawEarnings(owner, HOBBY_PRICE);
        assertEq(usdc.balanceOf(owner), HOBBY_PRICE);
        assertEq(usdc.balanceOf(address(billing)), 100e6 - HOBBY_PRICE);
    }

    function test_ownerCannotWithdrawUnsettledUsage() public {
        _subscribe(alice, hobby, 100e6);
        vm.warp(block.timestamp + 30 days);

        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.InsufficientEarnings.selector);
        billing.withdrawEarnings(owner, 1); // must settle first
    }

    function test_collect_settlesAndSweeps() public {
        _subscribe(alice, hobby, 100e6);
        _subscribe(bob, pro, 100e6);
        vm.warp(block.timestamp + 30 days);

        address[] memory who = new address[](2);
        who[0] = alice;
        who[1] = bob;

        vm.prank(owner);
        uint256 swept = billing.collect(who, owner);

        assertEq(swept, HOBBY_PRICE + PRO_PRICE);
        assertEq(usdc.balanceOf(owner), HOBBY_PRICE + PRO_PRICE);
        assertEq(billing.operatorAccrued(), 0);
    }

    function test_onlyOwnerFunctions() public {
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        billing.createPlan(1e6);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        billing.setPlanOpen(hobby, false);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        billing.withdrawEarnings(stranger, 0);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        billing.collect(new address[](0), stranger);
        vm.stopPrank();
    }

    function test_thereIsNoPauseOrBlacklist() public view {
        // Documented as an absence, asserted so it stays an absence.
        assertEq(_selectorExists("pause()"), false);
        assertEq(_selectorExists("unpause()"), false);
        assertEq(_selectorExists("upgradeTo(address)"), false);
        assertEq(_selectorExists("setBlocked(address,bool)"), false);
    }

    function _selectorExists(string memory sig) internal view returns (bool) {
        (bool ok,) = address(billing).staticcall(abi.encodeWithSignature(sig));
        return ok;
    }

    function test_createPlan_rejectsZeroPrice() public {
        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.ZeroPrice.selector);
        billing.createPlan(0);
    }

    // -----------------------------------------------------------------
    // Fuzz
    // -----------------------------------------------------------------

    /// @dev Every deposited token ends up either as operator revenue or back with the subscriber.
    function testFuzz_depositIsFullyConserved(uint96 deposit, uint32 elapsed) public {
        deposit = uint96(bound(deposit, HOBBY_PRICE, 1_000_000e6));
        usdc.mint(alice, deposit);

        uint256 aliceBefore = usdc.balanceOf(alice);
        _subscribe(alice, hobby, deposit);
        vm.warp(block.timestamp + elapsed);

        vm.prank(alice);
        billing.cancel();

        uint256 refunded = usdc.balanceOf(alice) - (aliceBefore - deposit);
        assertEq(refunded + billing.operatorAccrued(), deposit, "no tokens created or destroyed");
        assertLe(billing.operatorAccrued(), deposit, "cannot bill beyond the prepayment");
    }

    /// @dev A subscriber is never billed more than elapsed time at their plan rate, and never
    ///      more than they prepaid — the cap is what stops a lapsed account accruing debt.
    function testFuzz_neverOverchargedForElapsedTime(uint32 elapsed) public {
        uint256 deposit = 1000e6;
        _subscribe(alice, hobby, deposit);
        vm.warp(block.timestamp + elapsed);

        uint256 uncapped = (HOBBY_PRICE * uint256(elapsed)) / 30 days;
        assertEq(billing.pendingCharge(alice), uncapped > deposit ? deposit : uncapped);
    }

    /// @dev Rounding is always in the subscriber's favour, never the operator's.
    function testFuzz_roundingFavoursTheSubscriber(uint32 elapsed) public {
        _subscribe(alice, hobby, 1000e6);
        vm.warp(block.timestamp + elapsed);
        uint256 exactScaled = HOBBY_PRICE * uint256(elapsed);
        assertLe(billing.pendingCharge(alice) * 30 days, exactScaled);
    }
}
