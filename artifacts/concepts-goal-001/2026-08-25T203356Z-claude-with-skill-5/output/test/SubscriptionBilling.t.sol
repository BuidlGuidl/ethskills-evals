// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal treasury = address(0xBEEF);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint128 internal constant HOBBY_PRICE = 5_000_000; // $5.00
    uint128 internal constant PRO_PRICE = 20_000_000; // $20.00
    uint8 internal constant HOBBY = 1;
    uint8 internal constant PRO = 2;

    uint256 internal constant MONTH = 30 days;

    function setUp() public {
        usdc = new MockUSDC();

        uint128[] memory prices = new uint128[](2);
        prices[0] = HOBBY_PRICE;
        prices[1] = PRO_PRICE;
        billing = new SubscriptionBilling(IERC20(address(usdc)), treasury, prices);

        // Start at a realistic timestamp; block 1's timestamp is 1 by default.
        vm.warp(1_800_000_000);

        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? alice : bob;
            usdc.mint(who, 1_000_000_000);
            vm.prank(who);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function _fund(address who, uint256 amount, uint8 plan) internal {
        vm.prank(who);
        billing.depositAndSubscribe(amount, plan);
    }

    /*//////////////////////////////////////////////////////////////
                                 SETUP
    //////////////////////////////////////////////////////////////*/

    function test_plansAreConfigured() public view {
        assertEq(billing.planCount(), 3, "plan 0 is the not-subscribed sentinel");

        (uint128 hobby, bool hobbyOpen) = billing.plans(HOBBY);
        assertEq(hobby, HOBBY_PRICE);
        assertTrue(hobbyOpen);

        (uint128 pro, bool proOpen) = billing.plans(PRO);
        assertEq(pro, PRO_PRICE);
        assertTrue(proOpen);
    }

    function test_unknownAccountIsNotSubscribed() public view {
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.paidThrough(alice), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          SUBSCRIBE AND STREAM
    //////////////////////////////////////////////////////////////*/

    function test_subscribeMakesAccountActive() public {
        _fund(alice, 15_000_000, HOBBY); // three months of hobby

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.paidThrough(alice), uint64(block.timestamp + 3 * MONTH));
    }

    function test_billingAccruesWithoutAnyTransaction() public {
        _fund(alice, 15_000_000, HOBBY);

        // Nobody sends anything for a month. The stream still charged.
        vm.warp(block.timestamp + MONTH);

        assertEq(billing.withdrawable(alice), 10_000_000, "one month consumed");
        assertTrue(billing.isSubscribed(alice));
    }

    function test_lapsesExactlyWhenBalanceRunsOut() public {
        _fund(alice, 15_000_000, HOBBY);
        uint256 expiry = block.timestamp + 3 * MONTH;

        vm.warp(expiry - 1);
        assertTrue(billing.isSubscribed(alice), "still funded one second before");

        vm.warp(expiry);
        assertFalse(billing.isSubscribed(alice), "unfunded, and nobody had to say so");
        assertEq(billing.withdrawable(alice), 0);
    }

    function test_lapseNeedsNoTransactionToTakeEffect() public {
        _fund(alice, 5_000_000, HOBBY);
        vm.warp(block.timestamp + 365 days);

        // Storage still says plan 1, but the view a backend reads is already correct.
        assertEq(billing.accountOf(alice).plan, HOBBY);
        assertFalse(billing.isSubscribed(alice));
    }

    /*//////////////////////////////////////////////////////////////
                                SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function test_settleMovesAccruedIntoRevenue() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.warp(block.timestamp + MONTH);

        billing.settle(alice);

        assertEq(billing.revenueAccrued(), 5_000_000);
        assertEq(billing.accountOf(alice).balance, 10_000_000);
        assertTrue(billing.isSubscribed(alice), "settling does not end the subscription");
    }

    function test_settleIsEconomicallyNeutral() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.warp(block.timestamp + 40 days);

        uint256 withdrawableBefore = billing.withdrawable(alice);
        uint64 paidThroughBefore = billing.paidThrough(alice);

        // A stranger settles. Nothing about Alice's position changes.
        vm.prank(address(0xDEAD));
        billing.settle(alice);

        assertEq(billing.withdrawable(alice), withdrawableBefore);
        assertEq(billing.paidThrough(alice), paidThroughBefore);
    }

    function test_lateSettlementCollectsTheSameTotal() public {
        _fund(alice, 15_000_000, HOBBY);
        _fund(bob, 15_000_000, HOBBY);

        // Alice is settled every month; Bob is not touched for three.
        for (uint256 i; i < 3; ++i) {
            vm.warp(block.timestamp + MONTH);
            billing.settle(alice);
        }
        billing.settle(bob);

        assertEq(billing.revenueAccrued(), 30_000_000, "same revenue either way");
        assertEq(billing.withdrawable(alice), billing.withdrawable(bob));
    }

    function test_settleCapsAtBalanceAndRecordsLapse() public {
        _fund(alice, 5_000_000, HOBBY);
        uint256 expiry = block.timestamp + MONTH;

        // Settled a year late: the account may not accrue a debt for time it was
        // not being served.
        vm.warp(block.timestamp + 365 days);
        vm.expectEmit(true, true, false, true, address(billing));
        emit SubscriptionBilling.Lapsed(alice, HOBBY, uint64(expiry));
        billing.settle(alice);

        assertEq(billing.revenueAccrued(), 5_000_000, "never more than was prepaid");
        assertEq(billing.accountOf(alice).plan, 0);
        assertEq(billing.accountOf(alice).balance, 0);
    }

    function test_settleManySweepsABatch() public {
        _fund(alice, 15_000_000, HOBBY);
        _fund(bob, 60_000_000, PRO);
        vm.warp(block.timestamp + MONTH);

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        billing.settleMany(accounts);

        assertEq(billing.revenueAccrued(), 25_000_000);
    }

    /*//////////////////////////////////////////////////////////////
                            CANCEL AND REFUND
    //////////////////////////////////////////////////////////////*/

    function test_cancelRefundsExactlyTheUnusedPortion() public {
        _fund(alice, 15_000_000, HOBBY);
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.warp(block.timestamp + 45 days); // one and a half months
        vm.prank(alice);
        uint256 refunded = billing.cancelAndWithdraw();

        assertEq(refunded, 7_500_000, "half a month of hobby left unused");
        assertEq(usdc.balanceOf(alice), balanceBefore + 7_500_000);
        assertEq(billing.revenueAccrued(), 7_500_000);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancelMidSecondIsProRata() public {
        _fund(alice, 5_000_000, HOBBY);
        vm.warp(block.timestamp + 1 days);

        vm.prank(alice);
        uint256 refunded = billing.cancelAndWithdraw();

        // 29/30ths of $5 back, to the token unit.
        assertEq(refunded, 5_000_000 - (5_000_000 * 1 days) / MONTH);
    }

    function test_cancelStopsFurtherAccrual() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.warp(block.timestamp + MONTH);

        vm.prank(alice);
        billing.cancel();

        uint256 leftover = billing.withdrawable(alice);
        vm.warp(block.timestamp + 365 days);
        assertEq(billing.withdrawable(alice), leftover, "cancelled means cancelled");
        assertEq(billing.revenueAccrued(), 5_000_000);
    }

    function test_cancelledBalanceStaysWithdrawableForever() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.prank(alice);
        billing.cancel();

        vm.warp(block.timestamp + 3650 days);
        vm.prank(alice);
        billing.withdraw(15_000_000, alice);
        assertEq(billing.accountOf(alice).balance, 0);
    }

    function test_cancelRevertsWhenNotSubscribed() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_withdrawCannotTakeAccruedRevenue() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.warp(block.timestamp + MONTH);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 15_000_000, 10_000_000)
        );
        billing.withdraw(15_000_000, alice);
    }

    function test_partialWithdrawShortensRunway() public {
        _fund(alice, 15_000_000, HOBBY);

        vm.prank(alice);
        billing.withdraw(10_000_000, alice);

        assertEq(billing.paidThrough(alice), uint64(block.timestamp + MONTH));
        assertTrue(billing.isSubscribed(alice));
    }

    /*//////////////////////////////////////////////////////////////
                              PLAN CHANGES
    //////////////////////////////////////////////////////////////*/

    function test_upgradeSettlesOldPlanFirst() public {
        _fund(alice, 60_000_000, HOBBY);
        vm.warp(block.timestamp + MONTH);

        vm.prank(alice);
        billing.subscribe(PRO);

        assertEq(billing.revenueAccrued(), 5_000_000, "hobby month billed at hobby price");
        assertEq(billing.withdrawable(alice), 55_000_000);
        // $55 of runway at $20/month.
        assertEq(billing.paidThrough(alice), uint64(block.timestamp + (55 * MONTH) / 20));
    }

    function test_downgradeExtendsRunway() public {
        _fund(alice, 20_000_000, PRO);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.subscribe(HOBBY);

        assertEq(billing.withdrawable(alice), 10_000_000);
        assertEq(billing.paidThrough(alice), uint64(block.timestamp + 2 * MONTH));
    }

    function test_resubscribingToSamePlanReverts() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.AlreadyOnPlan.selector);
        billing.subscribe(HOBBY);
    }

    function test_underfundedSubscribeReverts() public {
        uint256 oneDayOfHobby = (uint256(HOBBY_PRICE) * 1 days) / MONTH;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.Underfunded.selector, 1000, oneDayOfHobby));
        billing.depositAndSubscribe(1000, HOBBY);
    }

    function test_unknownPlanReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.UnknownPlan.selector);
        billing.depositAndSubscribe(15_000_000, 9);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.UnknownPlan.selector);
        billing.subscribe(0);
    }

    /*//////////////////////////////////////////////////////////////
                          TOP-UP AFTER A LAPSE
    //////////////////////////////////////////////////////////////*/

    function test_topUpAfterLapseIsNotEatenByTheGap() public {
        _fund(alice, 5_000_000, HOBBY);
        vm.warp(block.timestamp + 365 days); // ran dry 11 months ago

        vm.prank(alice);
        billing.deposit(5_000_000);

        // The deposit settled the lapse first, so the new $5 is intact.
        assertEq(billing.withdrawable(alice), 5_000_000);
        assertEq(billing.revenueAccrued(), 5_000_000, "only the month actually served");
        assertFalse(billing.isSubscribed(alice), "lapsed accounts must resubscribe");

        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertEq(billing.paidThrough(alice), uint64(block.timestamp + MONTH));
    }

    function test_topUpWhileActiveExtendsRunway() public {
        _fund(alice, 5_000_000, HOBBY);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        billing.deposit(5_000_000);

        // $2.50 left plus $5 = $7.50 at $5/month.
        assertEq(billing.paidThrough(alice), uint64(block.timestamp + (15 days) + MONTH));
    }

    function test_depositForSponsorsAnotherAccount() public {
        vm.prank(bob);
        billing.depositFor(alice, 15_000_000);

        assertEq(billing.withdrawable(alice), 15_000_000);

        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertTrue(billing.isSubscribed(alice));

        // Paying for someone grants no control over their account.
        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    /*//////////////////////////////////////////////////////////////
                            OPERATOR SURFACE
    //////////////////////////////////////////////////////////////*/

    function test_revenueWithdrawalAlwaysGoesToTreasury() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.warp(block.timestamp + MONTH);
        billing.settle(alice);

        // Even a stranger calling it can only push funds to the configured treasury.
        vm.prank(address(0xDEAD));
        billing.withdrawRevenue();

        assertEq(usdc.balanceOf(treasury), 5_000_000);
        assertEq(billing.revenueAccrued(), 0);
    }

    function test_operatorCannotTouchSubscriberDeposits() public {
        _fund(alice, 15_000_000, HOBBY);

        // Nothing in the operator surface can reach an unconsumed deposit; the most
        // the treasury can do is take revenue that the stream has already earned.
        vm.prank(treasury);
        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.withdrawRevenue();

        assertEq(billing.withdrawable(alice), 15_000_000);
    }

    function test_operatorCannotRepriceAnExistingPlan() public {
        // There is no setter. The only price lever is adding a new plan.
        vm.prank(treasury);
        uint8 enterprise = billing.addPlan(100_000_000);
        assertEq(enterprise, 3);

        (uint128 hobbyStillFive,) = billing.plans(HOBBY);
        assertEq(hobbyStillFive, HOBBY_PRICE);
    }

    function test_closedPlanBlocksNewSubscribersOnly() public {
        _fund(alice, 15_000_000, HOBBY);

        vm.prank(treasury);
        billing.closePlan(HOBBY);

        // Alice keeps streaming at her locked price.
        vm.warp(block.timestamp + MONTH);
        assertTrue(billing.isSubscribed(alice));

        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.PlanNotOpen.selector);
        billing.depositAndSubscribe(15_000_000, HOBBY);
    }

    function test_onlyTreasuryCanManagePlans() public {
        vm.startPrank(alice);
        vm.expectRevert(SubscriptionBilling.NotTreasury.selector);
        billing.addPlan(1_000_000);
        vm.expectRevert(SubscriptionBilling.NotTreasury.selector);
        billing.closePlan(HOBBY);
        vm.expectRevert(SubscriptionBilling.NotTreasury.selector);
        billing.transferTreasury(alice);
        vm.stopPrank();
    }

    function test_treasuryHandoverIsTwoStep() public {
        address newTreasury = address(0xCAFE);

        vm.prank(treasury);
        billing.transferTreasury(newTreasury);
        assertEq(billing.treasury(), treasury, "not until accepted");

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotTreasury.selector);
        billing.acceptTreasury();

        vm.prank(newTreasury);
        billing.acceptTreasury();
        assertEq(billing.treasury(), newTreasury);
    }

    function test_operatorCanEndASubscriptionButNotKeepTheMoney() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.warp(block.timestamp + MONTH);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        vm.prank(treasury);
        billing.endSubscriptions(accounts);

        assertFalse(billing.isSubscribed(alice), "operator can cut off access");
        assertEq(billing.revenueAccrued(), 5_000_000, "only the month actually served");
        assertEq(billing.withdrawable(alice), 10_000_000, "the rest is still Alice's");

        // And Alice can take it, with no cooperation from the operator.
        vm.prank(alice);
        billing.withdraw(10_000_000, alice);
        assertEq(usdc.balanceOf(alice), 1_000_000_000 - 5_000_000);
    }

    function test_endedSubscriptionStopsAccruing() public {
        _fund(alice, 15_000_000, HOBBY);
        address[] memory accounts = new address[](1);
        accounts[0] = alice;

        vm.prank(treasury);
        billing.endSubscriptions(accounts);

        vm.warp(block.timestamp + 365 days);
        assertEq(billing.withdrawable(alice), 15_000_000, "meter stopped");
        assertEq(billing.revenueAccrued(), 0);
    }

    function test_onlyTreasuryCanEndSubscriptions() public {
        _fund(alice, 15_000_000, HOBBY);
        address[] memory accounts = new address[](1);
        accounts[0] = alice;

        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.NotTreasury.selector);
        billing.endSubscriptions(accounts);
    }

    function test_endedSubscriberCanSubscribeAgain() public {
        _fund(alice, 15_000_000, HOBBY);
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        vm.prank(treasury);
        billing.endSubscriptions(accounts);

        // Being cut off is not a ban: the account is ordinary again.
        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertTrue(billing.isSubscribed(alice));
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    function test_statusOfMatchesTheIndividualViews() public {
        _fund(alice, 15_000_000, HOBBY);
        vm.warp(block.timestamp + 10 days);

        (bool active, uint8 plan, uint256 balance, uint64 through, uint256 owed) = billing.statusOf(alice);

        assertTrue(active);
        assertEq(plan, HOBBY);
        assertEq(balance, billing.withdrawable(alice));
        assertEq(through, billing.paidThrough(alice));
        assertEq(owed, (uint256(HOBBY_PRICE) * 10 days) / MONTH);
    }

    function test_revenueIncludingCountsUnsettledAccrual() public {
        _fund(alice, 15_000_000, HOBBY);
        _fund(bob, 60_000_000, PRO);
        vm.warp(block.timestamp + MONTH);

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        uint256 projected = billing.revenueIncluding(accounts);
        billing.settleMany(accounts);
        assertEq(projected, billing.revenueAccrued(), "the view predicted the sweep exactly");
    }

    /*//////////////////////////////////////////////////////////////
                              SOLVENCY
    //////////////////////////////////////////////////////////////*/

    /// @dev The invariant that matters: subscriber money and operator revenue must
    ///      always be fully backed by tokens actually held.
    function _assertSolvent(address[] memory accounts) internal view {
        uint256 owedToUsers;
        for (uint256 i; i < accounts.length; ++i) {
            owedToUsers += billing.withdrawable(accounts[i]);
        }
        uint256 claims = owedToUsers + billing.revenueIncluding(accounts);
        assertGe(usdc.balanceOf(address(billing)), claims, "contract is short");
    }

    function testFuzz_contractStaysSolventUnderArbitraryUse(
        uint96 aliceDeposit,
        uint96 bobDeposit,
        uint32 t1,
        uint32 t2,
        bool aliceUpgrades
    ) public {
        aliceDeposit = uint96(bound(aliceDeposit, 1_000_000, 500_000_000));
        bobDeposit = uint96(bound(bobDeposit, 1_000_000, 500_000_000));
        t1 = uint32(bound(t1, 0, 400 days));
        t2 = uint32(bound(t2, 0, 400 days));

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        _fund(alice, aliceDeposit, HOBBY);
        _fund(bob, bobDeposit, PRO);
        _assertSolvent(accounts);

        vm.warp(block.timestamp + t1);
        _assertSolvent(accounts);

        // A plan switch still has to clear MIN_FUNDING_PERIOD at the *new* price.
        uint256 dayOfPro = (uint256(PRO_PRICE) * 1 days) / MONTH;
        if (aliceUpgrades && billing.isSubscribed(alice) && billing.withdrawable(alice) >= dayOfPro) {
            vm.prank(alice);
            billing.subscribe(PRO);
            _assertSolvent(accounts);
        }

        vm.warp(block.timestamp + t2);
        billing.settleMany(accounts);
        _assertSolvent(accounts);

        if (billing.revenueAccrued() > 0) billing.withdrawRevenue();
        _assertSolvent(accounts);

        vm.prank(alice);
        billing.cancelAndWithdraw();
        vm.prank(bob);
        billing.cancelAndWithdraw();
        _assertSolvent(accounts);
    }

    function testFuzz_refundPlusRevenueEqualsDeposit(uint96 amount, uint32 elapsed) public {
        amount = uint96(bound(amount, 1_000_000, 500_000_000));
        elapsed = uint32(bound(elapsed, 0, 400 days));

        _fund(alice, amount, HOBBY);
        vm.warp(block.timestamp + elapsed);

        vm.prank(alice);
        uint256 refunded = billing.cancelAndWithdraw();

        // Every unit deposited is either revenue or refunded. Nothing is stranded.
        assertEq(refunded + billing.revenueAccrued(), amount);
        assertEq(usdc.balanceOf(address(billing)), billing.revenueAccrued());
    }

    function testFuzz_neverChargesMoreThanTheElapsedTime(uint96 amount, uint32 elapsed) public {
        amount = uint96(bound(amount, 1_000_000, 500_000_000));
        elapsed = uint32(bound(elapsed, 0, 3650 days));

        _fund(alice, amount, HOBBY);
        vm.warp(block.timestamp + elapsed);
        billing.settle(alice);

        uint256 fullPriceForElapsed = (uint256(HOBBY_PRICE) * elapsed) / MONTH;
        assertLe(billing.revenueAccrued(), fullPriceForElapsed, "charged for unserved time");
        assertLe(billing.revenueAccrued(), amount, "charged more than was prepaid");
    }
}
