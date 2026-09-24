// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TestBase} from "./TestBase.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";

contract SubscriptionBillingTest is TestBase {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal operator = address(0xA11CE);
    address internal alice = address(0xB0B);
    address internal bob = address(0xCAFE);
    address internal treasury = address(0xFEE5);

    uint128 internal constant HOBBY_PRICE = 5_000_000; // $5.00, 6 decimals
    uint128 internal constant PRO_PRICE = 20_000_000; // $20.00
    uint256 internal constant MONTH = 30 days;

    uint16 internal hobby;
    uint16 internal pro;

    function setUp() public {
        vm.warp(1_750_000_000); // a realistic timestamp, not 0
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator);

        vm.startPrank(operator);
        hobby = billing.createPlan(HOBBY_PRICE, "hobby");
        pro = billing.createPlan(PRO_PRICE, "pro");
        vm.stopPrank();

        usdc.mint(alice, 1_000_000_000);
        usdc.mint(bob, 1_000_000_000);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function _join(address who, uint16 planId, uint256 amount) internal {
        vm.startPrank(who);
        usdc.approve(address(billing), amount);
        billing.subscribe(planId, amount);
        vm.stopPrank();
    }

    /// @dev The invariant the whole contract exists to protect: tokens held here
    /// are exactly what subscribers can still withdraw plus what the operator has
    /// earned. Asserted after every meaningful test.
    function _assertSolvent() internal view {
        assertEq(
            usdc.balanceOf(address(billing)),
            billing.totalSubscriberBalance() + billing.revenueAccrued(),
            "solvency: held == owed to subscribers + owed to operator"
        );
    }

    // ---------------------------------------------------------------
    // Core lifecycle
    // ---------------------------------------------------------------

    function test_FiveDollarsBuysExactlyOneMonthOfHobby() public {
        _join(alice, hobby, HOBBY_PRICE);

        assertTrue(billing.isActive(alice), "active immediately after subscribing");
        assertEq(billing.activeUntil(alice), block.timestamp + MONTH, "one month of runway");

        vm.warp(block.timestamp + MONTH - 1);
        assertTrue(billing.isActive(alice), "still active one second before expiry");

        vm.warp(block.timestamp + 1);
        assertFalse(billing.isActive(alice), "inactive once the month is consumed");
        assertEq(billing.accruedOf(alice), HOBBY_PRICE, "entire deposit consumed");
        _assertSolvent();
    }

    function test_TwentyDollarsBuysOneMonthOfPro() public {
        _join(bob, pro, PRO_PRICE);
        assertEq(billing.activeUntil(bob), block.timestamp + MONTH, "pro: one month for $20");

        // The same $20 on hobby would have lasted four months.
        _join(alice, hobby, PRO_PRICE);
        assertEq(billing.activeUntil(alice), block.timestamp + 4 * MONTH, "hobby: four months for $20");
        _assertSolvent();
    }

    function test_ToppingUpExtendsWithoutAnyRenewalTransaction() public {
        _join(alice, hobby, HOBBY_PRICE * 3); // three months up front

        vm.warp(block.timestamp + 90 days);
        assertFalse(billing.isActive(alice), "lapsed after three months");

        vm.startPrank(alice);
        usdc.approve(address(billing), HOBBY_PRICE);
        billing.deposit(HOBBY_PRICE);
        vm.stopPrank();

        assertTrue(billing.isActive(alice), "back in credit after top-up");
        assertEq(billing.activeUntil(alice), block.timestamp + MONTH, "fresh month from now");
        _assertSolvent();
    }

    function test_CancelRefundsExactlyTheUnusedPortion() public {
        _join(alice, hobby, HOBBY_PRICE * 2); // two months

        vm.warp(block.timestamp + 15 days); // quarter of the way through
        uint256 expectedRefund = HOBBY_PRICE * 2 - HOBBY_PRICE / 2;
        assertApproxEq(billing.refundableOf(alice), expectedRefund, 1, "refund quote");

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();

        assertApproxEq(usdc.balanceOf(alice) - before, expectedRefund, 1, "refund paid out");
        assertFalse(billing.isActive(alice), "inactive after cancelling");
        assertApproxEq(billing.revenueAccrued(), HOBBY_PRICE / 2, 1, "operator keeps the used half-month");
        _assertSolvent();
    }

    function test_CancelImmediatelyRefundsEverything() public {
        _join(alice, hobby, HOBBY_PRICE);
        uint256 before = usdc.balanceOf(alice);

        vm.prank(alice);
        billing.cancel();

        assertEq(usdc.balanceOf(alice) - before, HOBBY_PRICE, "no time used, nothing charged");
        assertEq(billing.revenueAccrued(), 0, "operator earned nothing");
        _assertSolvent();
    }

    function test_CancelledAccountStopsAccruing() public {
        _join(alice, hobby, HOBBY_PRICE * 2);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.cancel();
        uint256 revenueAtCancel = billing.revenueAccrued();

        vm.warp(block.timestamp + 365 days);
        billing.collect(alice);
        assertEq(billing.revenueAccrued(), revenueAtCancel, "no accrual after cancellation");
        _assertSolvent();
    }

    // ---------------------------------------------------------------
    // The accrual edge cases that actually bite
    // ---------------------------------------------------------------

    /// @notice A naive implementation rounds `elapsed * price / month` down on every
    /// settlement, so settling often destroys revenue. At $5/month the rate is ~1.93
    /// units per second, so per-second settlement would round away ~48% of it — and
    /// `collect` is permissionless, so anyone could grief the operator by spamming it.
    /// The remainder carry makes revenue independent of settlement frequency.
    function test_RevenueIsIndependentOfHowOftenCollectIsCalled() public {
        _join(alice, hobby, HOBBY_PRICE);
        _join(bob, hobby, HOBBY_PRICE);

        uint256 start = block.timestamp;

        // Alice is settled every single second for 1000 seconds.
        for (uint256 i = 1; i <= 1000; ++i) {
            vm.warp(start + i);
            billing.collect(alice);
        }
        // Bob is settled once at the end.
        billing.collect(bob);

        SubscriptionBilling.Subscription memory a = billing.subscriptionOf(alice);
        SubscriptionBilling.Subscription memory b = billing.subscriptionOf(bob);

        assertApproxEq(a.balance, b.balance, 1, "spamming collect must not change what is charged");

        uint256 expected = (1000 * uint256(HOBBY_PRICE)) / MONTH;
        assertApproxEq(HOBBY_PRICE - a.balance, expected, 1, "charged the true 1000 seconds of usage");
        _assertSolvent();
    }

    /// @notice Running out of credit must not create a debt that eats a later top-up.
    function test_LapsedAccountAccumulatesNoDebt() public {
        _join(alice, hobby, HOBBY_PRICE);

        vm.warp(block.timestamp + 365 days); // lapsed 11 months ago
        billing.collect(alice);

        assertEq(billing.revenueAccrued(), HOBBY_PRICE, "charged the one month that was prepaid, no more");
        assertEq(billing.subscriptionOf(alice).balance, 0, "balance floored at zero");

        vm.startPrank(alice);
        usdc.approve(address(billing), HOBBY_PRICE);
        billing.deposit(HOBBY_PRICE);
        vm.stopPrank();

        assertEq(billing.activeUntil(alice), block.timestamp + MONTH, "top-up buys a full month, not a partial one");
        _assertSolvent();
    }

    /// @notice Same as above, but the gap is never settled before the top-up —
    /// the settle-on-deposit path must handle it identically.
    function test_TopUpAfterLongLapseWithoutIntermediateCollect() public {
        _join(alice, hobby, HOBBY_PRICE);
        vm.warp(block.timestamp + 730 days);

        vm.startPrank(alice);
        usdc.approve(address(billing), HOBBY_PRICE * 2);
        billing.deposit(HOBBY_PRICE * 2);
        vm.stopPrank();

        assertEq(billing.activeUntil(alice), block.timestamp + 2 * MONTH, "two clean months");
        assertEq(billing.revenueAccrued(), HOBBY_PRICE, "only the originally prepaid month was earned");
        _assertSolvent();
    }

    // ---------------------------------------------------------------
    // Plan changes
    // ---------------------------------------------------------------

    function test_UpgradeSettlesOldPlanAtOldRate() public {
        _join(alice, hobby, HOBBY_PRICE * 2);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.subscribe(pro, 0);

        // Half a month of hobby was consumed — charged at $5/mo, not retroactively at $20/mo.
        assertApproxEq(billing.revenueAccrued(), HOBBY_PRICE / 2, 1, "old plan settled at old rate");

        uint256 remaining = HOBBY_PRICE * 2 - HOBBY_PRICE / 2;
        assertApproxEq(
            billing.activeUntil(alice) - block.timestamp,
            (remaining * MONTH) / PRO_PRICE,
            2,
            "leftover credit re-quoted at the pro rate"
        );
        _assertSolvent();
    }

    function test_DowngradeStretchesRemainingCredit() public {
        _join(alice, pro, PRO_PRICE);
        vm.prank(alice);
        billing.subscribe(hobby, 0);
        assertEq(billing.activeUntil(alice), block.timestamp + 4 * MONTH, "$20 stretches to 4 hobby months");
        _assertSolvent();
    }

    function test_ClosingAPlanDoesNotDisturbExistingSubscribers() public {
        _join(alice, hobby, HOBBY_PRICE);

        vm.prank(operator);
        billing.closePlan(hobby);

        vm.warp(block.timestamp + 15 days);
        assertTrue(billing.isActive(alice), "existing subscriber keeps running on a closed plan");
        assertEq(billing.activeUntil(alice), block.timestamp + 15 days, "and at the original rate");

        vm.startPrank(bob);
        usdc.approve(address(billing), HOBBY_PRICE);
        vm.expectRevert(SubscriptionBilling.PlanClosedToNewSubscribers.selector);
        billing.subscribe(hobby, HOBBY_PRICE);
        vm.stopPrank();
        _assertSolvent();
    }

    /// @notice There is deliberately no `setPrice`. Repricing is a new plan, so a
    /// subscriber's prepaid runway can never be shortened by the operator.
    function test_OperatorCannotRepriceAnExistingPlan() public {
        _join(alice, hobby, HOBBY_PRICE);
        uint256 runwayBefore = billing.activeUntil(alice);

        vm.startPrank(operator);
        billing.closePlan(hobby);
        billing.createPlan(50_000_000, "hobby v2"); // the only way to reprice
        vm.stopPrank();

        assertEq(billing.activeUntil(alice), runwayBefore, "alice's runway is untouched");
        assertEq(billing.plans(hobby).pricePerMonth, HOBBY_PRICE, "original plan price is immutable");
    }

    // ---------------------------------------------------------------
    // Operator boundaries
    // ---------------------------------------------------------------

    function test_OperatorCannotWithdrawUnearnedSubscriberFunds() public {
        _join(alice, hobby, HOBBY_PRICE * 12); // a year up front

        vm.warp(block.timestamp + 15 days);
        billing.collect(alice);

        uint256 earned = billing.revenueAccrued();
        assertApproxEq(earned, HOBBY_PRICE / 2, 1, "only half a month is earned");

        vm.startPrank(operator);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.withdrawRevenue(treasury, earned + 1);

        billing.withdrawRevenue(treasury, earned); // exactly the earned amount is fine
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), earned, "operator paid out");
        assertEq(billing.revenueAccrued(), 0, "pot emptied");

        // Alice's money is still hers.
        vm.prank(alice);
        billing.cancel();
        assertApproxEq(
            usdc.balanceOf(alice), 1_000_000_000 - earned, 1, "subscriber lost only what was consumed"
        );
        _assertSolvent();
    }

    function test_OnlyOwnerCanCreatePlansAndWithdraw() public {
        vm.startPrank(alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.createPlan(1_000_000, "rogue");

        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.closePlan(hobby);

        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.withdrawRevenue(alice, 1);
        vm.stopPrank();
    }

    function test_CollectIsPermissionlessSoALostOperatorKeyStrandsNothing() public {
        _join(alice, hobby, HOBBY_PRICE);
        vm.warp(block.timestamp + 10 days);

        // A random third party settles; no special role required.
        vm.prank(bob);
        billing.collect(alice);
        assertTrue(billing.revenueAccrued() > 0, "settlement works without the operator");

        // And the subscriber can still exit entirely on their own.
        vm.prank(alice);
        billing.cancel();
        _assertSolvent();
    }

    function test_TwoStepOwnershipHandover() public {
        vm.prank(operator);
        billing.transferOwnership(alice);
        assertEq(billing.owner(), operator, "owner unchanged until accepted");

        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.NotPendingOwner.selector);
        billing.acceptOwnership();

        vm.prank(alice);
        billing.acceptOwnership();
        assertEq(billing.owner(), alice, "handover complete");
        assertEq(billing.pendingOwner(), address(0), "pending cleared");
    }

    // ---------------------------------------------------------------
    // Withdrawals and misc
    // ---------------------------------------------------------------

    function test_PartialWithdrawShortensRunway() public {
        _join(alice, hobby, HOBBY_PRICE * 4);

        vm.prank(alice);
        billing.withdraw(HOBBY_PRICE * 2);

        assertEq(billing.activeUntil(alice), block.timestamp + 2 * MONTH, "two months left");
        assertTrue(billing.isActive(alice), "still subscribed");
        _assertSolvent();
    }

    function test_WithdrawMoreThanBalanceReverts() public {
        _join(alice, hobby, HOBBY_PRICE);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.withdraw(HOBBY_PRICE + 1);
    }

    function test_DepositForSomeoneElse() public {
        _join(alice, hobby, HOBBY_PRICE);

        vm.startPrank(bob);
        usdc.approve(address(billing), HOBBY_PRICE);
        billing.depositFor(alice, HOBBY_PRICE);
        vm.stopPrank();

        assertEq(billing.activeUntil(alice), block.timestamp + 2 * MONTH, "gift extended alice's runway");

        // The funds are alice's, not bob's.
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice) - before, HOBBY_PRICE * 2, "alice withdraws the gifted funds");
        _assertSolvent();
    }

    function test_UnknownAddressReadsAsInactive() public view {
        assertFalse(billing.isActive(address(0xDEAD)), "never-seen address is not subscribed");
        assertEq(billing.activeUntil(address(0xDEAD)), 0, "and has no runway");
    }

    function test_SubscribingToNonexistentPlanReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NoSuchPlan.selector);
        billing.subscribe(99, 0);
    }

    function test_CancelWithoutSubscriptionReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    // ---------------------------------------------------------------
    // Multi-subscriber solvency under interleaved activity
    // ---------------------------------------------------------------

    function test_ManySubscribersStaySolventAcrossInterleavedActivity() public {
        _join(alice, hobby, HOBBY_PRICE * 6);
        _join(bob, pro, PRO_PRICE * 2);

        vm.warp(block.timestamp + 10 days);
        billing.collect(alice);
        _assertSolvent();

        vm.startPrank(alice);
        usdc.approve(address(billing), HOBBY_PRICE);
        billing.deposit(HOBBY_PRICE);
        vm.stopPrank();
        _assertSolvent();

        vm.warp(block.timestamp + 25 days);
        vm.prank(bob);
        billing.subscribe(hobby, 0); // bob downgrades
        _assertSolvent();

        // Read first: a nested call would consume the prank before the withdrawal.
        uint256 earned = billing.revenueAccrued();
        vm.prank(operator);
        billing.withdrawRevenue(treasury, earned);
        _assertSolvent();

        vm.warp(block.timestamp + 40 days);
        address[] memory everyone = new address[](2);
        everyone[0] = alice;
        everyone[1] = bob;
        billing.collectMany(everyone);
        _assertSolvent();

        vm.prank(alice);
        billing.cancel();
        vm.prank(bob);
        billing.cancel();
        _assertSolvent();

        assertEq(billing.totalSubscriberBalance(), 0, "all subscriber funds returned");
        assertEq(billing.surplus(), 0, "no tokens stranded");
    }
}
