// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal operator = makeAddr("operator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint128 internal constant HOBBY = 5_000_000; // $5 / 30 days
    uint128 internal constant PRO = 20_000_000; // $20 / 30 days
    uint32 internal constant HOBBY_ID = 1;
    uint32 internal constant PRO_ID = 2;

    uint256 internal constant PERIOD = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        uint128[] memory prices = new uint128[](2);
        prices[0] = HOBBY;
        prices[1] = PRO;
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator, prices);

        // Start well past the epoch so `lastSettled` arithmetic is realistic.
        vm.warp(1_800_000_000);

        for (uint256 i = 0; i < 2; i++) {
            address who = i == 0 ? alice : bob;
            usdc.mint(who, 1_000_000_000);
            vm.prank(who);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function _subscribe(address who, uint32 planId, uint256 topUp) internal {
        vm.prank(who);
        billing.subscribe(planId, topUp);
    }

    /*//////////////////////////////////////////////////////////////
                              SIGN-UP
    //////////////////////////////////////////////////////////////*/

    function test_constructor_seedsPlans() public view {
        assertEq(billing.planCount(), 2);
        assertEq(billing.plan(HOBBY_ID).pricePerPeriod, HOBBY);
        assertEq(billing.plan(PRO_ID).pricePerPeriod, PRO);
        assertTrue(billing.plan(PRO_ID).open);
        assertEq(billing.owner(), operator);
    }

    function test_subscribe_requiresOneFullPeriodUpFront() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientPrepaid.selector, 4_999_999, HOBBY));
        billing.subscribe(HOBBY_ID, 4_999_999);
    }

    function test_subscribe_startsTheMeter() public {
        _subscribe(alice, HOBBY_ID, 15_000_000); // three months up front

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.expiresAt(alice), block.timestamp + 3 * PERIOD);
        assertEq(billing.refundable(alice), 15_000_000);
        assertEq(billing.subscriberCount(), 1);
    }

    function test_subscribe_unknownOrClosedPlanReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NoSuchPlan.selector);
        billing.subscribe(99, 100_000_000);

        vm.prank(operator);
        billing.setPlanOpen(HOBBY_ID, false);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.PlanClosed.selector);
        billing.subscribe(HOBBY_ID, 100_000_000);
    }

    function test_deposit_onBehalfOfSomeoneElse() public {
        _subscribe(alice, HOBBY_ID, HOBBY);
        vm.prank(bob);
        billing.deposit(alice, 5_000_000);
        assertEq(billing.refundable(alice), 10_000_000);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCRUAL WITHOUT A CRON
    //////////////////////////////////////////////////////////////*/

    function test_chargeAccruesWithNoTransaction() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);

        vm.warp(block.timestamp + 15 days); // nobody sends anything in between

        assertEq(billing.pendingCharge(alice), 2_500_000); // half a month of $5
        assertEq(billing.refundable(alice), 12_500_000);
        assertTrue(billing.isSubscribed(alice));

        // Storage is still stale — reads apply accrual in memory.
        assertEq(billing.totalPrepaid(), 15_000_000);
        assertEq(billing.accruedRevenue(), 0);
    }

    function test_lapsesOnItsOwnWhenFundsRunOut() public {
        _subscribe(alice, HOBBY_ID, HOBBY); // exactly one month
        uint256 expiry = billing.expiresAt(alice);
        assertEq(expiry, block.timestamp + PERIOD);

        vm.warp(expiry - 1);
        assertTrue(billing.isSubscribed(alice));

        vm.warp(expiry);
        assertFalse(billing.isSubscribed(alice)); // no transaction was sent to make this happen
        assertEq(billing.refundable(alice), 0);
    }

    function test_lapsedGapIsNotBilled() public {
        _subscribe(alice, HOBBY_ID, HOBBY);
        vm.warp(block.timestamp + 100 days); // ran dry ~70 days ago

        assertEq(billing.pendingCharge(alice), HOBBY); // capped at balance: never in debt
        assertFalse(billing.isSubscribed(alice));

        vm.prank(alice);
        billing.deposit(alice, HOBBY); // top up to come back

        assertEq(billing.accruedRevenue(), HOBBY); // only the month they actually had
        assertEq(billing.refundable(alice), HOBBY);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.expiresAt(alice), block.timestamp + PERIOD);
    }

    function test_settleIsAccountingOnly_neverChangesWhatIsOwed() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);
        vm.warp(block.timestamp + 10 days);

        uint256 before = billing.refundable(alice);
        vm.prank(bob); // a stranger settles; permissionless
        billing.settle(alice);

        assertEq(billing.refundable(alice), before);
        assertEq(billing.accruedRevenue(), before == 0 ? 0 : 15_000_000 - before);
        assertEq(billing.pendingCharge(alice), 0);
    }

    function test_repeatedSettlementDoesNotOvercharge() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);
        uint256 start = block.timestamp;

        for (uint256 i = 0; i < 30; i++) {
            vm.warp(start + (i + 1) * 12 hours);
            billing.settle(alice);
        }

        // 15 days of a $5/month plan, minus at most one token unit of truncation per settlement.
        uint256 charged = billing.accruedRevenue();
        assertLe(charged, 2_500_000);
        assertGe(charged, 2_500_000 - 30);
    }

    /*//////////////////////////////////////////////////////////////
                          CANCEL AND REFUND
    //////////////////////////////////////////////////////////////*/

    function test_cancelRefundsUnusedTimeToTheSecond() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);
        vm.warp(block.timestamp + 7 days + 3 hours);

        uint256 used = ((7 days + 3 hours) * HOBBY) / PERIOD;
        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 got = billing.cancelAndWithdraw(alice);

        assertEq(got, 15_000_000 - used);
        assertEq(usdc.balanceOf(alice) - balBefore, 15_000_000 - used);
        assertEq(billing.accruedRevenue(), used);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.subscriberCount(), 0);
    }

    function test_cancelStopsTheMeter() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        billing.cancel();

        uint256 owedAtCancel = billing.accruedRevenue();
        vm.warp(block.timestamp + 365 days);

        assertEq(billing.accruedRevenue(), owedAtCancel);
        assertEq(billing.pendingCharge(alice), 0);
        assertEq(billing.refundable(alice), 15_000_000 - owedAtCancel);
    }

    function test_cancelWithoutSubscriptionReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_withdrawWhileSubscribedBringsExpiryForward() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);
        assertEq(billing.expiresAt(alice), block.timestamp + 3 * PERIOD);

        vm.prank(alice);
        billing.withdraw(alice, 10_000_000);

        assertEq(billing.expiresAt(alice), block.timestamp + PERIOD);
        assertTrue(billing.isSubscribed(alice));

        vm.prank(alice);
        billing.withdraw(alice, 5_000_000);
        assertFalse(billing.isSubscribed(alice)); // drained to zero: lapses immediately
    }

    function test_withdrawMoreThanBalanceReverts() public {
        _subscribe(alice, HOBBY_ID, HOBBY);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, HOBBY, HOBBY + 1));
        billing.withdraw(alice, HOBBY + 1);
    }

    /*//////////////////////////////////////////////////////////////
                            PLAN CHANGES
    //////////////////////////////////////////////////////////////*/

    function test_upgradeSettlesOldRateFirst() public {
        _subscribe(alice, HOBBY_ID, 100_000_000);
        vm.warp(block.timestamp + 10 days);

        uint256 atHobbyRate = (10 days * HOBBY) / PERIOD;
        _subscribe(alice, PRO_ID, 0);

        assertEq(billing.accruedRevenue(), atHobbyRate);
        assertEq(billing.expiresAt(alice), block.timestamp + ((100_000_000 - atHobbyRate) * PERIOD) / PRO);

        vm.warp(block.timestamp + 10 days);
        assertEq(billing.pendingCharge(alice), (10 days * PRO) / PERIOD); // new rate only from the switch
    }

    function test_switchingToTheSamePlanReverts() public {
        _subscribe(alice, HOBBY_ID, HOBBY);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.AlreadyOnPlan.selector);
        billing.subscribe(HOBBY_ID, 0);
    }

    function test_closedPlanKeepsExistingSubscribersAtTheirRate() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);

        vm.startPrank(operator);
        billing.setPlanOpen(HOBBY_ID, false);
        uint32 newHobby = billing.createPlan(8_000_000, true);
        vm.stopPrank();

        assertEq(newHobby, 3);
        vm.warp(block.timestamp + 30 days);
        assertEq(billing.pendingCharge(alice), HOBBY); // still $5, not $8
    }

    /// @dev There is deliberately no way to reprice a live plan. The only levers are createPlan
    ///      and setPlanOpen; nothing can re-rate balances people already paid in.
    function test_noRepricingEntryPointExists() public {
        vm.prank(operator);
        (bool ok,) = address(billing)
            .call(abi.encodeWithSelector(bytes4(keccak256("setPrice(uint32,uint128)")), HOBBY_ID, uint128(1)));
        assertFalse(ok); // no such function, and no fallback to catch it
    }

    function test_createPlanZeroPriceReverts() public {
        vm.prank(operator);
        vm.expectRevert(SubscriptionBilling.ZeroPrice.selector);
        billing.createPlan(0, true);
    }

    /*//////////////////////////////////////////////////////////////
                          OPERATOR BOUNDARIES
    //////////////////////////////////////////////////////////////*/

    function test_operatorCannotTouchPrepaidBalances() public {
        _subscribe(alice, HOBBY_ID, 100_000_000);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 0, 1));
        billing.withdrawRevenue(operator, 1);

        vm.prank(operator);
        vm.expectRevert(SubscriptionBilling.NothingToSweep.selector);
        billing.sweepStray(IERC20(address(usdc)), operator);
    }

    function test_operatorWithdrawsOnlyConsumedRevenue() public {
        _subscribe(alice, HOBBY_ID, 100_000_000);
        vm.warp(block.timestamp + 30 days);

        address[] memory who = new address[](1);
        who[0] = alice;
        billing.settleMany(who);

        assertEq(billing.accruedRevenue(), HOBBY);
        vm.prank(operator);
        billing.withdrawRevenue(operator, HOBBY);
        assertEq(usdc.balanceOf(operator), HOBBY);
        assertEq(billing.refundable(alice), 95_000_000);
    }

    function test_onlyOwnerFunctions() public {
        vm.startPrank(alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.createPlan(1, true);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.setPlanOpen(HOBBY_ID, false);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.withdrawRevenue(alice, 0);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.sweepStray(IERC20(address(usdc)), alice);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.transferOwnership(alice);
        vm.stopPrank();
    }

    function test_subscribersStillWorkIfTheOperatorKeyIsGone() public {
        _subscribe(alice, HOBBY_ID, 15_000_000);
        vm.warp(block.timestamp + 5 days);

        // Operator key lost: no more createPlan, no more revenue withdrawals. Users are unaffected.
        vm.prank(alice);
        uint256 refund = billing.cancelAndWithdraw(alice);
        assertGt(refund, 0);

        vm.prank(bob);
        billing.subscribe(PRO_ID, 100_000_000); // existing open plans still work
        assertTrue(billing.isSubscribed(bob));
    }

    function test_sweepStrayOnlyTakesSurplus() public {
        _subscribe(alice, HOBBY_ID, 100_000_000);
        usdc.mint(address(billing), 777); // someone transfers in by mistake

        vm.prank(operator);
        uint256 swept = billing.sweepStray(IERC20(address(usdc)), operator);
        assertEq(swept, 777);
        assertEq(billing.refundable(alice), 100_000_000);
    }

    function test_ownershipHandoverIsTwoStep() public {
        vm.prank(operator);
        billing.transferOwnership(bob);
        assertEq(billing.owner(), operator);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotPendingOwner.selector);
        billing.acceptOwnership();

        vm.prank(bob);
        billing.acceptOwnership();
        assertEq(billing.owner(), bob);
        assertEq(billing.pendingOwner(), address(0));
    }

    /*//////////////////////////////////////////////////////////////
                          OPERATOR BOOKKEEPING
    //////////////////////////////////////////////////////////////*/

    function test_claimableRevenueIncludesUnsettledAccrual() public {
        _subscribe(alice, HOBBY_ID, 100_000_000);
        _subscribe(bob, PRO_ID, 100_000_000);
        vm.warp(block.timestamp + 30 days);

        assertEq(billing.accruedRevenue(), 0);
        assertEq(billing.claimableRevenue(), uint256(HOBBY) + PRO);
    }

    function test_subscriberPagination() public {
        _subscribe(alice, HOBBY_ID, HOBBY);
        _subscribe(bob, PRO_ID, PRO);

        address[] memory page = billing.subscribers(0, 10);
        assertEq(page.length, 2);
        assertEq(billing.subscribers(1, 10).length, 1);
        assertEq(billing.subscribers(5, 10).length, 0);

        vm.prank(alice);
        billing.cancel();
        assertEq(billing.subscribers(0, 10).length, 1);
    }

    function test_accountOfMatchesTheIndividualReads() public {
        _subscribe(alice, PRO_ID, 60_000_000);
        vm.warp(block.timestamp + 11 days);

        (uint32 planId, uint256 balance, uint256 expiry, bool subscribed) = billing.accountOf(alice);
        assertEq(planId, PRO_ID);
        assertEq(balance, billing.refundable(alice));
        assertEq(expiry, billing.expiresAt(alice));
        assertEq(subscribed, billing.isSubscribed(alice));
    }

    /*//////////////////////////////////////////////////////////////
                                 FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @dev Whatever the timeline, a subscriber's money is either refundable to them or booked as
    ///      revenue for time they actually had. It never goes missing and never double-counts.
    function testFuzz_moneyIsConserved(uint96 topUp, uint32 elapsed, bool proPlan) public {
        uint32 planId = proPlan ? PRO_ID : HOBBY_ID;
        uint256 price = billing.plan(planId).pricePerPeriod;
        topUp = uint96(bound(topUp, price, 500_000_000));
        elapsed = uint32(bound(elapsed, 0, 400 days));

        usdc.mint(alice, topUp);
        _subscribe(alice, planId, topUp);
        vm.warp(block.timestamp + elapsed);

        uint256 owed = billing.pendingCharge(alice);
        assertLe(owed, topUp);
        assertEq(billing.refundable(alice) + owed, topUp);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 refund = billing.cancelAndWithdraw(alice);

        assertEq(refund, topUp - owed);
        assertEq(usdc.balanceOf(alice) - balBefore, refund);
        assertEq(billing.accruedRevenue(), owed);
        assertEq(usdc.balanceOf(address(billing)), billing.totalPrepaid() + billing.accruedRevenue());
    }

    /// @dev `isSubscribed` and `expiresAt` must agree at every instant, including the boundary.
    function testFuzz_expiryBoundaryIsExact(uint96 topUp) public {
        topUp = uint96(bound(topUp, HOBBY, 500_000_000));
        usdc.mint(alice, topUp);
        _subscribe(alice, HOBBY_ID, topUp);

        uint256 expiry = billing.expiresAt(alice);
        vm.warp(expiry - 1);
        assertTrue(billing.isSubscribed(alice));
        vm.warp(expiry);
        assertFalse(billing.isSubscribed(alice));
    }
}
