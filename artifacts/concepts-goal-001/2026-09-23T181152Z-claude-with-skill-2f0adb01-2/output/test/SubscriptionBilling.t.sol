// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal payout = makeAddr("payout");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal randomKeeper = makeAddr("randomKeeper");

    uint128 internal constant HOBBY_PRICE = 5e6; // $5
    uint128 internal constant PRO_PRICE = 20e6; // $20
    uint256 internal PERIOD;

    uint32 internal hobby;
    uint32 internal pro;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner, payout);
        PERIOD = billing.PERIOD();

        vm.startPrank(owner);
        hobby = billing.addPlan(HOBBY_PRICE);
        pro = billing.addPlan(PRO_PRICE);
        vm.stopPrank();

        // Start at a realistic timestamp, not 1.
        vm.warp(1_750_000_000);

        _fund(alice, 1000e6);
        _fund(bob, 1000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _topUpAndSubscribe(address who, uint256 amount, uint32 plan) internal {
        vm.startPrank(who);
        billing.deposit(amount);
        billing.subscribe(plan);
        vm.stopPrank();
    }

    /// @dev The one invariant that matters: the contract always holds at least what
    ///      it owes to customers (free + escrowed) plus unpaid revenue.
    function _assertSolvent() internal view {
        uint256 owed =
            billing.totalCustomerBalance() + billing.totalEscrowed() + billing.withdrawableRevenue();
        assertGe(usdc.balanceOf(address(billing)), owed, "insolvent");
    }

    // ---------------------------------------------------------------
    // Deposit / withdraw
    // ---------------------------------------------------------------

    function test_depositCreditsFreeBalance() public {
        vm.prank(alice);
        billing.deposit(100e6);

        assertEq(billing.accountOf(alice).balance, 100e6);
        assertEq(billing.totalCustomerBalance(), 100e6);
        assertFalse(billing.isSubscribed(alice), "deposit alone is not a subscription");
        _assertSolvent();
    }

    function test_depositForCreditsOtherAccount() public {
        vm.prank(alice);
        billing.depositFor(bob, 50e6);

        assertEq(billing.accountOf(bob).balance, 50e6);
        assertEq(billing.accountOf(alice).balance, 0);
    }

    function test_withdrawUnsubscribedReturnsEverything() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        billing.withdraw(100e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 1000e6);
        assertEq(billing.totalCustomerBalance(), 0);
    }

    function test_withdrawCannotTouchEscrowedPeriod() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        // 100 deposited, 5 escrowed for the running period => 95 free.
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.withdraw(96e6);

        vm.prank(alice);
        billing.withdraw(95e6);
        assertTrue(billing.isSubscribed(alice), "paid period survives a full withdrawal");
        assertEq(billing.accountOf(alice).balance, 0);
    }

    // ---------------------------------------------------------------
    // Subscribe / entitlement
    // ---------------------------------------------------------------

    function test_subscribeEscrowsOnePeriod() public {
        _topUpAndSubscribe(alice, 100e6, hobby);

        SubscriptionBilling.Account memory a = billing.accountOf(alice);
        assertEq(a.balance, 95e6);
        assertEq(a.periodPrice, HOBBY_PRICE);
        assertEq(a.planId, hobby);
        assertEq(a.paidThrough, block.timestamp + PERIOD);
        assertEq(billing.totalEscrowed(), HOBBY_PRICE);
        assertEq(billing.withdrawableRevenue(), 0, "nothing earned until time passes");
        _assertSolvent();
    }

    function test_subscribeRequiresFullFirstPeriod() public {
        vm.startPrank(alice);
        billing.deposit(4e6);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.subscribe(hobby);
        vm.stopPrank();
    }

    function test_cannotSubscribeTwice() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.AlreadySubscribed.selector);
        billing.subscribe(pro);
    }

    function test_unknownPlanReverts() public {
        vm.startPrank(alice);
        billing.deposit(100e6);
        vm.expectRevert(SubscriptionBilling.UnknownPlan.selector);
        billing.subscribe(99);
        vm.stopPrank();
    }

    /// The core promise to the backend: entitlement is correct with zero pokes.
    function test_entitlementHoldsWithoutAnyoneSettling() public {
        _topUpAndSubscribe(alice, 100e6, hobby); // 95 free = 19 more periods

        // 20 periods of coverage total: 1 escrowed + 19 the free balance can buy,
        // spanning [t0, t0 + 20*PERIOD). So 19 warps still land inside coverage.
        for (uint256 i = 0; i < 19; ++i) {
            vm.warp(block.timestamp + PERIOD);
            assertTrue(billing.isSubscribed(alice), "should still be covered");
        }
        vm.warp(block.timestamp + PERIOD); // t0 + 20*PERIOD: first uncovered instant
        assertFalse(billing.isSubscribed(alice), "runway exhausted");
    }

    function test_entitledUntilMatchesActualExpiry() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        uint64 until_ = billing.entitledUntil(alice);
        assertEq(until_, block.timestamp + (20 * PERIOD), "1 escrowed + 19 affordable");

        vm.warp(until_ - 1);
        assertTrue(billing.isSubscribed(alice));
        vm.warp(until_);
        assertFalse(billing.isSubscribed(alice), "entitledUntil is exclusive");
    }

    function test_runwayAndDustAreReported() public {
        _topUpAndSubscribe(alice, 12e6, hobby); // 5 escrowed, 7 free => 1 more period + $2 dust
        assertEq(billing.periodsOfRunway(alice), 1);
        assertEq(billing.entitledUntil(alice), block.timestamp + (2 * PERIOD));
    }

    // ---------------------------------------------------------------
    // Settlement
    // ---------------------------------------------------------------

    function test_settleIsPermissionlessAndPaysMerchant() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.warp(block.timestamp + PERIOD);

        vm.prank(randomKeeper); // anyone at all
        billing.settle(alice);

        assertEq(billing.withdrawableRevenue(), HOBBY_PRICE, "first period earned");
        assertEq(billing.totalEscrowed(), HOBBY_PRICE, "second period now escrowed");
        assertEq(billing.accountOf(alice).balance, 90e6);
        assertTrue(billing.isSubscribed(alice));
        _assertSolvent();
    }

    /// Settling late must produce the same result as settling on time.
    function test_lateSettlementMatchesIncrementalSettlement() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        _topUpAndSubscribe(bob, 100e6, hobby);

        for (uint256 i = 0; i < 6; ++i) {
            vm.warp(block.timestamp + PERIOD);
            billing.settle(alice); // diligent
        }
        billing.settle(bob); // ignored for six periods, settled once at the end

        SubscriptionBilling.Account memory a = billing.accountOf(alice);
        SubscriptionBilling.Account memory b = billing.accountOf(bob);
        assertEq(a.balance, b.balance, "same balance");
        assertEq(a.paidThrough, b.paidThrough, "same expiry");
        assertEq(a.planId, b.planId);
        assertEq(billing.withdrawableRevenue(), 2 * 6 * uint256(HOBBY_PRICE));
        _assertSolvent();
    }

    function test_settleIsIdempotentWithinAPeriod() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.warp(block.timestamp + PERIOD + 1 days);

        billing.settle(alice);
        uint256 revenueAfterFirst = billing.withdrawableRevenue();
        uint256 balanceAfterFirst = billing.accountOf(alice).balance;

        billing.settle(alice);
        billing.settle(alice);
        assertEq(billing.withdrawableRevenue(), revenueAfterFirst, "no double charging");
        assertEq(billing.accountOf(alice).balance, balanceAfterFirst);
    }

    function test_settleNoOpsForNeverSubscribed() public {
        billing.settle(alice);
        assertEq(billing.withdrawableRevenue(), 0);
    }

    function test_lapseWhenFundsRunOut() public {
        _topUpAndSubscribe(alice, 12e6, hobby); // 2 periods of service, $2 left over
        vm.warp(block.timestamp + (3 * PERIOD));

        assertFalse(billing.isSubscribed(alice), "already lapsed by computation");
        billing.settle(alice);

        SubscriptionBilling.Account memory a = billing.accountOf(alice);
        assertEq(a.planId, 0, "lapsed");
        assertEq(a.balance, 2e6, "dust stays the customer's");
        assertEq(billing.withdrawableRevenue(), 10e6, "charged for 2 periods served");
        assertEq(billing.totalEscrowed(), 0);
        _assertSolvent();

        // and it is genuinely theirs to take back
        vm.prank(alice);
        billing.withdraw(2e6);
        assertEq(usdc.balanceOf(alice), 1000e6 - 10e6);
    }

    /// A deposit after a lapse must not back-charge the dormant months.
    function test_depositAfterLapseDoesNotBackCharge() public {
        _topUpAndSubscribe(alice, 5e6, hobby); // exactly one period
        vm.warp(block.timestamp + (10 * PERIOD)); // dormant for ages

        vm.prank(alice);
        billing.deposit(100e6);

        assertEq(billing.withdrawableRevenue(), 5e6, "only the one period they used");
        assertEq(billing.accountOf(alice).balance, 100e6, "full deposit intact");
        assertFalse(billing.isSubscribed(alice), "must resubscribe deliberately");

        vm.prank(alice);
        billing.subscribe(hobby);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.accountOf(alice).paidThrough, block.timestamp + PERIOD, "fresh period from now");
    }

    function test_settleManyBatches() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        _topUpAndSubscribe(bob, 100e6, pro);
        vm.warp(block.timestamp + PERIOD);

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        vm.prank(randomKeeper);
        billing.settleMany(accounts);

        assertEq(billing.withdrawableRevenue(), uint256(HOBBY_PRICE) + PRO_PRICE);
    }

    // ---------------------------------------------------------------
    // Cancel / refund
    // ---------------------------------------------------------------

    function test_cancelMidPeriodProratesToTheSecond() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.warp(block.timestamp + (PERIOD / 2)); // exactly half a period used

        vm.prank(alice);
        billing.cancel();

        // 95 free + half of the $5 period back = 97.50
        assertEq(billing.accountOf(alice).balance, 97_500_000);
        assertEq(billing.withdrawableRevenue(), 2_500_000, "merchant keeps the half used");
        assertEq(billing.totalEscrowed(), 0);
        assertFalse(billing.isSubscribed(alice), "cancel is immediate");
        _assertSolvent();
    }

    function test_cancelImmediatelyAfterSubscribingRefundsNearlyAll() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.prank(alice);
        billing.cancel();

        assertEq(billing.accountOf(alice).balance, 100e6, "no time used, nothing charged");
        assertEq(billing.withdrawableRevenue(), 0);
    }

    function test_cancelAndWithdrawAllInOneCall() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.warp(block.timestamp + (PERIOD / 2));

        vm.prank(alice);
        billing.cancelAndWithdrawAll();

        assertEq(usdc.balanceOf(alice), 1000e6 - 2_500_000, "only the used half is gone");
        assertEq(billing.totalCustomerBalance(), 0);
        assertEq(billing.totalEscrowed(), 0);
        _assertSolvent();
    }

    function test_cancelAfterLongUnsettledGapRefundsCorrectly() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        // Nobody settles for 3.5 periods, then the customer cancels.
        vm.warp(block.timestamp + (3 * PERIOD) + (PERIOD / 2));

        vm.prank(alice);
        billing.cancelAndWithdrawAll();

        // 3.5 periods of hobby = $17.50 consumed.
        assertEq(usdc.balanceOf(alice), 1000e6 - 17_500_000);
        assertEq(billing.withdrawableRevenue(), 17_500_000);
        _assertSolvent();
    }

    function test_cancelWhenNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    // ---------------------------------------------------------------
    // Plan changes
    // ---------------------------------------------------------------

    function test_changePlanRefundsOldAndStartsNew() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.warp(block.timestamp + (PERIOD / 2));

        vm.prank(alice);
        billing.changePlan(pro);

        SubscriptionBilling.Account memory a = billing.accountOf(alice);
        assertEq(a.planId, pro);
        assertEq(a.periodPrice, PRO_PRICE);
        assertEq(a.paidThrough, block.timestamp + PERIOD, "fresh pro period");
        // 95 + 2.50 refund - 20 for pro = 77.50
        assertEq(a.balance, 77_500_000);
        assertEq(billing.withdrawableRevenue(), 2_500_000);
        _assertSolvent();
    }

    function test_changePlanToSameReverts() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.SamePlan.selector);
        billing.changePlan(hobby);
    }

    function test_changePlanRequiresFundsForNewPlan() public {
        _topUpAndSubscribe(alice, 6e6, hobby); // $1 free after escrow
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.changePlan(pro);
        assertTrue(billing.isSubscribed(alice), "failed upgrade leaves them subscribed");
    }

    // ---------------------------------------------------------------
    // Pricing / plan admin
    // ---------------------------------------------------------------

    /// Price rises must not reach existing subscribers, retroactively or otherwise.
    function test_existingSubscriberKeepsLockedRateAcrossAPriceHike() public {
        _topUpAndSubscribe(alice, 100e6, hobby);

        vm.startPrank(owner);
        billing.setPlanActive(hobby, false);
        uint32 hobbyV2 = billing.addPlan(50e6); // 10x price
        vm.stopPrank();
        assertEq(billing.planOfId(hobbyV2).price, 50e6);

        // Six unsettled periods, then the merchant settles at the new price era.
        vm.warp(block.timestamp + (6 * PERIOD));
        billing.settle(alice);

        assertEq(billing.withdrawableRevenue(), 6 * uint256(HOBBY_PRICE), "still $5 a period");
        assertTrue(billing.isSubscribed(alice), "retired plan keeps renewing");
    }

    function test_retiredPlanBlocksNewSignups() public {
        vm.prank(owner);
        billing.setPlanActive(hobby, false);

        vm.startPrank(alice);
        billing.deposit(100e6);
        vm.expectRevert(SubscriptionBilling.PlanRetired.selector);
        billing.subscribe(hobby);
        vm.stopPrank();
    }

    function test_onlyOwnerAdministersPlans() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.addPlan(1e6);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.setPayoutAddress(alice);
    }

    // ---------------------------------------------------------------
    // Revenue boundaries
    // ---------------------------------------------------------------

    function test_merchantCannotWithdrawEscrowOrCustomerBalances() public {
        _topUpAndSubscribe(alice, 100e6, hobby); // 95 free + 5 escrowed, 0 earned

        vm.prank(payout);
        vm.expectRevert(SubscriptionBilling.InsufficientRevenue.selector);
        billing.withdrawRevenue(1);

        vm.warp(block.timestamp + PERIOD);
        billing.settle(alice);

        vm.prank(payout);
        vm.expectRevert(SubscriptionBilling.InsufficientRevenue.selector);
        billing.withdrawRevenue(uint256(HOBBY_PRICE) + 1);
    }

    function test_revenueAlwaysGoesToPayoutAddressWhoeverCallsIt() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        vm.warp(block.timestamp + PERIOD);
        billing.settle(alice);

        vm.prank(randomKeeper); // attacker triggering the payout gains nothing
        billing.withdrawRevenue(HOBBY_PRICE);

        assertEq(usdc.balanceOf(payout), HOBBY_PRICE);
        assertEq(usdc.balanceOf(randomKeeper), 0);
        assertEq(billing.withdrawableRevenue(), 0);
        assertEq(billing.lifetimeRevenueWithdrawn(), HOBBY_PRICE);
        _assertSolvent();
    }

    /// The abandoned-merchant scenario: customers must still get their money out.
    function test_customersExitEvenIfOwnerVanishes() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        _topUpAndSubscribe(bob, 200e6, pro);
        vm.warp(block.timestamp + (PERIOD / 2));

        // Owner key is gone; nobody ever settles or administers anything again.
        vm.prank(alice);
        billing.cancelAndWithdrawAll();
        vm.prank(bob);
        billing.cancelAndWithdrawAll();

        assertEq(usdc.balanceOf(alice), 1000e6 - 2_500_000);
        assertEq(usdc.balanceOf(bob), 1000e6 - 10e6);
        assertEq(billing.totalCustomerBalance(), 0);
        assertEq(billing.totalEscrowed(), 0);
        _assertSolvent();
    }

    function test_rescueOnlyTakesStraySurplus() public {
        _topUpAndSubscribe(alice, 100e6, hobby);
        usdc.mint(address(billing), 7e6); // someone transferred in directly

        vm.prank(owner);
        billing.rescueSurplus(address(usdc), owner);
        assertEq(usdc.balanceOf(owner), 7e6, "exactly the stray amount");
        _assertSolvent();

        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.NoSurplus.selector);
        billing.rescueSurplus(address(usdc), owner);
    }

    // ---------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------

    function testFuzz_cancelNeverChargesMoreThanTimeUsed(uint256 deposit_, uint256 elapsed) public {
        deposit_ = bound(deposit_, HOBBY_PRICE, 1000e6);
        elapsed = bound(elapsed, 0, PERIOD - 1);

        _topUpAndSubscribe(alice, deposit_, hobby);
        vm.warp(block.timestamp + elapsed);

        vm.prank(alice);
        billing.cancelAndWithdrawAll();

        uint256 charged = 1000e6 - usdc.balanceOf(alice);
        uint256 fairPrice = (uint256(HOBBY_PRICE) * elapsed) / PERIOD;
        assertEq(charged, fairPrice, "charged exactly for time used");
        _assertSolvent();
    }

    function testFuzz_settlingAtAnyPointKeepsEntitlementConsistent(uint256 deposit_, uint256 elapsed) public {
        deposit_ = bound(deposit_, PRO_PRICE, 1000e6);
        elapsed = bound(elapsed, 0, 40 * PERIOD);

        _topUpAndSubscribe(alice, deposit_, pro);
        vm.warp(block.timestamp + elapsed);

        bool beforeSettle = billing.isSubscribed(alice);
        billing.settle(alice);
        bool afterSettle = billing.isSubscribed(alice);

        assertEq(beforeSettle, afterSettle, "settling must never change entitlement");
        _assertSolvent();
    }

    function testFuzz_merchantNeverEarnsMoreThanServiceDelivered(uint256 deposit_, uint256 elapsed) public {
        deposit_ = bound(deposit_, HOBBY_PRICE, 1000e6);
        elapsed = bound(elapsed, 0, 60 * PERIOD);

        _topUpAndSubscribe(alice, deposit_, hobby);
        vm.warp(block.timestamp + elapsed);
        billing.settle(alice);

        // Revenue is only ever recognised for whole elapsed periods.
        uint256 maxPeriods = (elapsed / PERIOD) + 1;
        assertLe(billing.withdrawableRevenue(), maxPeriods * uint256(HOBBY_PRICE));
        assertLe(billing.withdrawableRevenue(), deposit_);
        _assertSolvent();
    }
}
