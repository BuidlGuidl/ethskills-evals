// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling billing;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address stranger = makeAddr("stranger");

    uint8 constant HOBBY = 1;
    uint8 constant PRO = 2;
    uint128 constant HOBBY_PRICE = 5e6; // $5
    uint128 constant PRO_PRICE = 20e6; // $20
    uint256 constant PERIOD = 30 days;

    function setUp() public {
        usdc = new MockUSDC();

        uint8[] memory ids = new uint8[](2);
        uint128[] memory prices = new uint128[](2);
        (ids[0], prices[0]) = (HOBBY, HOBBY_PRICE);
        (ids[1], prices[1]) = (PRO, PRO_PRICE);

        billing = new SubscriptionBilling(IERC20(address(usdc)), owner, ids, prices);

        vm.warp(1_800_000_000); // a plausible non-zero clock
        _fund(alice);
        _fund(bob);
    }

    function _fund(address who) internal {
        usdc.mint(who, 10_000e6);
        vm.prank(who);
        usdc.approve(address(billing), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                          THE HAPPY PATH
    //////////////////////////////////////////////////////////////*/

    function test_topUpThenSubscribe_isActive() public {
        vm.startPrank(alice);
        billing.deposit(20e6);
        billing.subscribe(HOBBY);
        vm.stopPrank();

        assertTrue(billing.isActive(alice));
        // $20 of runway at $5/30d == 4 periods == 120 days.
        assertEq(billing.activeUntil(alice), uint64(block.timestamp + 4 * PERIOD));
    }

    function test_subscribeWithDeposit_oneTransaction() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, 60e6);
        assertTrue(billing.isActive(alice));
        assertEq(billing.activeUntil(alice), uint64(block.timestamp + 3 * PERIOD));
    }

    function test_chargeAccruesContinuously_noTransactionSent() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 60e6);

        vm.warp(block.timestamp + 15 days); // nobody sends anything
        assertEq(billing.accrued(alice), 2.5e6, "half a month at $5 is $2.50");
        assertEq(billing.withdrawable(alice), 57.5e6);

        vm.warp(block.timestamp + 15 days);
        assertEq(billing.accrued(alice), 5e6, "a full month is $5");
    }

    function test_monthlyRateIsExactOverTwelvePeriods() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, 240e6);
        vm.warp(block.timestamp + 12 * PERIOD);
        assertEq(billing.accrued(alice), 240e6, "12 periods of $20 is exactly $240");
        assertFalse(billing.isActive(alice), "and the runway is exactly used up");
    }

    /*//////////////////////////////////////////////////////////////
              LAPSING: HAPPENS BY ITSELF, NOBODY SENDS A TX
    //////////////////////////////////////////////////////////////*/

    function test_runsOutOfMoney_lapsesWithNoTransaction() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 5e6);

        uint64 until = billing.activeUntil(alice);
        assertEq(until, uint64(block.timestamp + PERIOD));

        vm.warp(until - 1);
        assertTrue(billing.isActive(alice));

        vm.warp(until);
        assertFalse(billing.isActive(alice), "lapsed on the second, with no keeper");
    }

    function test_lapsedTimeIsNotChargedRetroactively() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 5e6);

        // One month of service, then six months of being locked out.
        vm.warp(block.timestamp + 210 days);
        assertFalse(billing.isActive(alice));
        assertEq(billing.accrued(alice), 5e6, "capped at what they prepaid");

        // They come back and top up. The dead months must not be billed.
        vm.prank(alice);
        billing.deposit(5e6);

        assertEq(billing.revenue(), 5e6, "operator earned one month, not seven");
        assertEq(billing.withdrawable(alice), 5e6, "the new $5 is entirely unspent");
        assertTrue(billing.isActive(alice));
        assertEq(billing.activeUntil(alice), uint64(block.timestamp + PERIOD));
    }

    /*//////////////////////////////////////////////////////////////
                     CANCEL AND GET THE UNUSED PART BACK
    //////////////////////////////////////////////////////////////*/

    function test_cancelMidPeriod_refundsUnusedPortion() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 60e6); // a year up front

        vm.warp(block.timestamp + 45 days); // 1.5 periods used == $7.50

        uint256 before = usdc.balanceOf(alice);
        vm.startPrank(alice);
        billing.cancel();
        uint256 refund = billing.withdrawable(alice);
        billing.withdraw(refund, alice);
        vm.stopPrank();

        assertEq(refund, 52.5e6, "$60 minus $7.50");
        assertEq(usdc.balanceOf(alice) - before, 52.5e6);
        assertEq(billing.revenue(), 7.5e6);
        assertFalse(billing.isActive(alice));
    }

    function test_closeAccount_isASingleExitTransaction() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, 100e6);
        vm.warp(block.timestamp + PERIOD);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 refunded = billing.closeAccount(alice);

        assertEq(refunded, 80e6);
        assertEq(usdc.balanceOf(alice) - before, 80e6);
        assertEq(billing.accrued(alice), 0);
        assertFalse(billing.isActive(alice));
    }

    function test_exitWorksWithNoCooperationFromTheOperator() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, 100e6);
        vm.warp(block.timestamp + 10 days);

        // Pretend the operator is gone: key lost, never calls anything again.
        vm.prank(alice);
        uint256 refunded = billing.closeAccount(alice);
        assertGt(refunded, 0);
        assertEq(usdc.balanceOf(alice), 10_000e6 - 100e6 + refunded);
    }

    function test_clockStopsAtCancel() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 60e6);
        vm.warp(block.timestamp + PERIOD);
        vm.prank(alice);
        billing.cancel();

        uint256 owedAtCancel = billing.withdrawable(alice);
        vm.warp(block.timestamp + 365 days);
        assertEq(billing.withdrawable(alice), owedAtCancel, "no charges after cancelling");
        assertEq(billing.accrued(alice), 0);
    }

    /*//////////////////////////////////////////////////////////////
                              PLAN CHANGES
    //////////////////////////////////////////////////////////////*/

    function test_upgradeSettlesTheOldRateFirst() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 100e6);
        vm.warp(block.timestamp + PERIOD);

        vm.prank(alice);
        billing.subscribe(PRO);

        assertEq(billing.revenue(), 5e6, "the hobby month is booked at $5");
        vm.warp(block.timestamp + PERIOD);
        assertEq(billing.accrued(alice), 20e6, "the next month is at the pro rate");
    }

    function test_operatorRepricingDoesNotReachExistingSubscribers() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 100e6);

        vm.prank(owner);
        billing.setPlan(HOBBY, 500e6, true); // $500/mo, hostile repricing

        vm.warp(block.timestamp + PERIOD);
        assertEq(billing.accrued(alice), 5e6, "alice keeps the rate she signed up at");

        (, uint128 rate,,) = billing.accounts(alice);
        assertEq(rate, HOBBY_PRICE);
    }

    function test_closingAPlanBlocksNewSignupsOnly() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 100e6);

        vm.prank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, false);

        vm.prank(bob);
        vm.expectRevert(SubscriptionBilling.PlanClosed.selector);
        billing.subscribeWithDeposit(HOBBY, 100e6);

        vm.warp(block.timestamp + 10 days);
        assertTrue(billing.isActive(alice), "alice is undisturbed");
    }

    /*//////////////////////////////////////////////////////////////
                            REVENUE / SETTLE
    //////////////////////////////////////////////////////////////*/

    function test_settleIsPermissionlessAndOnlyMovesMoneyBetweenBuckets() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 60e6);
        vm.warp(block.timestamp + 45 days);

        uint256 withdrawableBefore = billing.withdrawable(alice);

        address[] memory who = new address[](1);
        who[0] = alice;
        vm.prank(stranger); // anyone
        billing.settle(who);

        assertEq(billing.withdrawable(alice), withdrawableBefore, "customer unaffected");
        assertEq(billing.revenue(), 7.5e6);
    }

    function test_neverSettling_changesNobodysEntitlement() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 60e6);

        vm.warp(block.timestamp + 300 days);
        assertEq(billing.revenue(), 0, "nothing booked; nobody called settle");
        assertEq(billing.accrued(alice), 50e6, "but the charge is known anyway");
        assertEq(billing.withdrawable(alice), 10e6);

        // The operator wakes up a year later and loses nothing.
        address[] memory who = new address[](1);
        who[0] = alice;
        billing.settle(who);
        assertEq(billing.revenue(), 50e6);
        assertEq(billing.withdrawable(alice), 10e6);
    }

    function test_settleIsIdempotentWithinABlock() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 60e6);
        vm.warp(block.timestamp + PERIOD);

        address[] memory who = new address[](1);
        who[0] = alice;
        billing.settle(who);
        billing.settle(who);
        billing.settle(who);
        assertEq(billing.revenue(), 5e6, "charged once, not three times");
    }

    function test_ownerCollectsRevenue() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, 100e6);
        vm.warp(block.timestamp + PERIOD);

        address[] memory who = new address[](1);
        who[0] = alice;
        billing.settle(who);

        vm.prank(owner);
        uint256 got = billing.collectRevenue(owner, 0); // 0 == everything
        assertEq(got, 20e6);
        assertEq(usdc.balanceOf(owner), 20e6);
        assertEq(billing.revenue(), 0);
    }

    function test_ownerCannotCollectMoreThanEarned() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, 1000e6);
        vm.warp(block.timestamp + PERIOD);

        address[] memory who = new address[](1);
        who[0] = alice;
        billing.settle(who);

        vm.prank(owner);
        uint256 got = billing.collectRevenue(owner, 1000e6); // asks for everything in the contract
        assertEq(got, 20e6, "clamped to booked revenue");
        assertEq(usdc.balanceOf(address(billing)), 980e6);
    }

    function test_settleAndCollect_isTheWholeOperatorRoutine() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 100e6);
        vm.prank(bob);
        billing.subscribeWithDeposit(PRO, 100e6);
        vm.warp(block.timestamp + PERIOD);

        address[] memory who = new address[](2);
        (who[0], who[1]) = (alice, bob);

        vm.prank(owner);
        uint256 got = billing.settleAndCollect(who, owner);

        assertEq(got, 25e6, "$5 + $20 in one transaction");
        assertEq(usdc.balanceOf(owner), 25e6);
        assertEq(billing.revenue(), 0);
        assertTrue(billing.isActive(alice));
        assertTrue(billing.isActive(bob));
    }

    function test_settleAndCollect_withNothingAccruedIsANoOpNotAnError() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 100e6);

        address[] memory who = new address[](1);
        who[0] = alice;
        vm.prank(owner);
        uint256 got = billing.settleAndCollect(who, owner); // same block, nothing elapsed
        assertEq(got, 0, "running the routine early should not revert");
        assertTrue(billing.isActive(alice));
    }

    function test_settleAndCollect_isOwnerOnly() public {
        address[] memory who = new address[](1);
        who[0] = alice;
        vm.prank(stranger);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.settleAndCollect(who, stranger);
    }

    /*//////////////////////////////////////////////////////////////
                    THE OPERATOR CANNOT TOUCH CUSTOMER MONEY
    //////////////////////////////////////////////////////////////*/

    function test_rescueCannotReachCustomerEscrow() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 100e6);

        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.rescue(IERC20(address(usdc)), owner, 100e6);

        assertEq(billing.withdrawable(alice), 100e6);
    }

    function test_rescueTakesStrayTransfersOnly() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 100e6);

        vm.prank(bob); // fat-fingers a direct transfer into the contract
        usdc.transfer(address(billing), 7e6);
        assertEq(billing.unaccountedBalance(), 7e6);

        vm.prank(owner);
        billing.rescue(IERC20(address(usdc)), owner, 0);
        assertEq(usdc.balanceOf(owner), 7e6);
        assertEq(billing.withdrawable(alice), 100e6, "escrow untouched");
    }

    function test_onlyOwnerFunctions() public {
        vm.startPrank(stranger);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.setPlan(3, 1e6, true);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.collectRevenue(stranger, 0);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.rescue(IERC20(address(usdc)), stranger, 0);
        vm.expectRevert(SubscriptionBilling.NotOwner.selector);
        billing.transferOwnership(stranger);
        vm.stopPrank();
    }

    function test_twoStepOwnershipHandover() public {
        vm.prank(owner);
        billing.transferOwnership(bob);
        assertEq(billing.owner(), owner, "not yet");

        vm.prank(stranger);
        vm.expectRevert(SubscriptionBilling.NotPendingOwner.selector);
        billing.acceptOwnership();

        vm.prank(bob);
        billing.acceptOwnership();
        assertEq(billing.owner(), bob);
        assertEq(billing.pendingOwner(), address(0));
    }

    /*//////////////////////////////////////////////////////////////
                              ODDS AND ENDS
    //////////////////////////////////////////////////////////////*/

    function test_depositForSomeoneElse() public {
        vm.prank(bob);
        billing.depositFor(alice, 50e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);

        assertTrue(billing.isActive(alice));
        assertEq(billing.withdrawable(alice), 50e6, "and alice controls it");
    }

    function test_withdrawingWhileSubscribedShortensRunway() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 50e6);
        assertEq(billing.activeUntil(alice), uint64(block.timestamp + 10 * PERIOD));

        vm.prank(alice);
        billing.withdraw(45e6, alice);
        assertEq(billing.activeUntil(alice), uint64(block.timestamp + PERIOD));
        assertTrue(billing.isActive(alice));
    }

    function test_withdrawingEverythingLapsesImmediately() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 50e6);
        vm.startPrank(alice);
        billing.withdraw(50e6, alice);
        vm.stopPrank();
        assertFalse(billing.isActive(alice));
        assertEq(billing.activeUntil(alice), uint64(block.timestamp));
    }

    function test_subscribingWithNoMoneyIsInactiveNotAnError() public {
        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertFalse(billing.isActive(alice), "subscribed but unfunded == not served");
        assertEq(billing.accrued(alice), 0);
    }

    function test_cannotWithdrawAccruedPortion() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 10e6);
        vm.warp(block.timestamp + PERIOD);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.withdraw(10e6, alice);

        vm.prank(alice);
        billing.withdraw(5e6, alice); // the unused half is fine
    }

    function test_unknownPlanReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NoSuchPlan.selector);
        billing.subscribe(9);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NoSuchPlan.selector);
        billing.subscribe(0);
    }

    function test_cancelWhenNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_statusOfMany_isOneRoundTripForTheBackend() public {
        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, 5e6);
        vm.prank(bob);
        billing.subscribeWithDeposit(PRO, 100e6);

        address[] memory who = new address[](3);
        (who[0], who[1], who[2]) = (alice, bob, stranger);
        SubscriptionBilling.Status[] memory s = billing.statusOfMany(who);

        assertTrue(s[0].active);
        assertEq(s[0].planId, HOBBY);
        assertTrue(s[1].active);
        assertEq(s[1].activeUntil, uint64(block.timestamp + 5 * PERIOD));
        assertFalse(s[2].active, "never seen this address");
        assertEq(s[2].activeUntil, 0);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @dev The refund promise, at arbitrary amounts and arbitrary cancellation moments.
    function testFuzz_cancelAlwaysRefundsExactlyTheUnusedPart(uint96 amount, uint32 elapsed) public {
        amount = uint96(bound(amount, 1e6, 5_000e6));
        elapsed = uint32(bound(elapsed, 0, 3650 days));

        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, amount);
        vm.warp(block.timestamp + elapsed);

        uint256 expectedUsed = (uint256(PRO_PRICE) * elapsed) / PERIOD;
        if (expectedUsed > amount) expectedUsed = amount;

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.closeAccount(alice);

        assertEq(usdc.balanceOf(alice) - before, amount - expectedUsed, "refund == prepaid - used");
        assertEq(billing.revenue(), expectedUsed);
    }

    /// @dev Nobody can end up with a claim the contract cannot honour.
    function testFuzz_contractIsAlwaysSolvent(uint96 aliceAmt, uint96 bobAmt, uint32 elapsed) public {
        aliceAmt = uint96(bound(aliceAmt, 1e6, 5_000e6));
        bobAmt = uint96(bound(bobAmt, 1e6, 5_000e6));
        elapsed = uint32(bound(elapsed, 0, 3650 days));

        vm.prank(alice);
        billing.subscribeWithDeposit(HOBBY, aliceAmt);
        vm.prank(bob);
        billing.subscribeWithDeposit(PRO, bobAmt);

        vm.warp(block.timestamp + elapsed);
        address[] memory who = new address[](2);
        (who[0], who[1]) = (alice, bob);
        billing.settle(who);

        assertGe(
            usdc.balanceOf(address(billing)),
            uint256(billing.totalEscrowed()) + billing.revenue(),
            "held >= owed"
        );
        assertEq(
            uint256(billing.totalEscrowed()) + billing.revenue(),
            uint256(aliceAmt) + bobAmt,
            "no value created or destroyed"
        );
    }

    /// @dev Splitting a period into N settlements must not cost the customer more than one
    ///      settlement at the end. (It can cost fractionally less, from flooring — never more.)
    function testFuzz_frequentSettlementNeverOvercharges(uint8 chunks) public {
        chunks = uint8(bound(chunks, 1, 60));

        vm.prank(alice);
        billing.subscribeWithDeposit(PRO, 1000e6);
        vm.prank(bob);
        billing.subscribeWithDeposit(PRO, 1000e6);

        address[] memory a = new address[](1);
        a[0] = alice;

        uint256 step = PERIOD / chunks;
        for (uint256 i; i < chunks; ++i) {
            vm.warp(block.timestamp + step);
            billing.settle(a); // alice gets settled constantly, bob never
        }

        assertLe(billing.accrued(alice) + _booked(alice), billing.accrued(bob), "no death by rounding");
    }

    function _booked(address who) internal view returns (uint256) {
        (uint128 bal,,,) = billing.accounts(who);
        return 1000e6 - bal;
    }
}
