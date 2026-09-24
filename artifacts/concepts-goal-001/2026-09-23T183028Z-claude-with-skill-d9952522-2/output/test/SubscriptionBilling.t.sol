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

    uint16 internal constant HOBBY = 1;
    uint16 internal constant PRO = 2;
    uint128 internal constant HOBBY_PRICE = 5_000_000; // $5
    uint128 internal constant PRO_PRICE = 20_000_000; // $20

    uint256 internal MONTH;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner);
        MONTH = billing.MONTH();

        vm.startPrank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, true);
        billing.setPlan(PRO, PRO_PRICE, true);
        vm.stopPrank();

        vm.warp(1_800_000_000); // any non-zero start
        _fund(alice, 1000e6);
        _fund(bob, 1000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _subscribe(address who, uint256 amount, uint16 planId) internal {
        vm.prank(who);
        billing.depositAndSubscribe(amount, planId);
    }

    function _settle(address who) internal {
        address[] memory a = new address[](1);
        a[0] = who;
        billing.settle(a);
    }

    /*//////////////////////////////////////////////////////////////
                          THE CORE HAPPY PATH
    //////////////////////////////////////////////////////////////*/

    function test_subscribeThenGateIsTrue() public {
        _subscribe(alice, 60e6, HOBBY);
        assertTrue(billing.isSubscribed(alice));
        // $60 at $5/month == 12 months of runway, no transaction needed to maintain it.
        assertEq(billing.activeUntil(alice), block.timestamp + 12 * MONTH);
    }

    function test_unknownAddressIsNotSubscribed() public view {
        assertFalse(billing.isSubscribed(stranger));
        assertEq(billing.activeUntil(stranger), 0);
    }

    function test_depositAloneDoesNotSubscribe() public {
        vm.prank(alice);
        billing.deposit(100e6);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_chargedOverTimeAtPlanRate() public {
        _subscribe(alice, 60e6, HOBBY);
        skip(MONTH);

        // One month of the $5 plan, to the token unit (rounding is sub-unit).
        assertApproxEqAbs(billing.refundableOf(alice), 55e6, 1);
        _settle(alice);
        assertApproxEqAbs(billing.collectedRevenue(), 5e6, 1);
    }

    function test_proPlanCostsFourTimesHobby() public {
        _subscribe(alice, 100e6, HOBBY);
        _subscribe(bob, 100e6, PRO);
        skip(MONTH);
        assertApproxEqAbs(100e6 - billing.refundableOf(bob), 4 * (100e6 - billing.refundableOf(alice)), 4);
    }

    /*//////////////////////////////////////////////////////////////
                     CANCEL AND GET THE REMAINDER BACK
    //////////////////////////////////////////////////////////////*/

    function test_cancelRefundsExactlyTheUnusedPortion() public {
        _subscribe(alice, 60e6, HOBBY);
        skip(MONTH / 2);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 refunded = billing.cancelAndWithdraw(alice);

        assertApproxEqAbs(refunded, 60e6 - 2.5e6, 1); // half a month used
        assertEq(usdc.balanceOf(alice) - before, refunded);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancelMidMonthStopsTheMeter() public {
        _subscribe(alice, 60e6, HOBBY);
        skip(MONTH / 2);
        vm.prank(alice);
        billing.cancel();

        uint256 owedAtCancel = billing.refundableOf(alice);
        skip(365 days);
        assertEq(billing.refundableOf(alice), owedAtCancel, "meter kept running after cancel");
        assertEq(billing.collectedRevenue(), 60e6 - owedAtCancel);
    }

    function test_cancelImmediatelyRefundsNearlyEverything() public {
        _subscribe(alice, 60e6, HOBBY);
        vm.prank(alice);
        uint256 refunded = billing.cancelAndWithdraw(alice);
        assertEq(refunded, 60e6);
    }

    function test_cannotCancelWhenNotSubscribed() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    /*//////////////////////////////////////////////////////////////
                      RUNNING OUT OF MONEY (NO KEEPER)
    //////////////////////////////////////////////////////////////*/

    function test_gateFlipsFalseOnItsOwnWhenFundsRunOut() public {
        _subscribe(alice, HOBBY_PRICE, HOBBY); // exactly one month
        skip(MONTH - 1);
        assertTrue(billing.isSubscribed(alice));
        skip(2);
        // Nobody has sent any transaction. The gate is already closed.
        assertFalse(billing.isSubscribed(alice));
    }

    function test_lapsedAccountIsNeverOverchargedForDeadTime() public {
        _subscribe(alice, HOBBY_PRICE, HOBBY);
        skip(MONTH + 365 days); // ran dry a year ago, nobody settled

        _settle(alice);
        assertEq(billing.collectedRevenue(), HOBBY_PRICE, "charged for unserved time");
        assertEq(billing.refundableOf(alice), 0);
        assertEq(billing.totalSubscriberBalance(), 0);
    }

    function test_topUpAfterLapseDoesNotRetroactivelyBill() public {
        _subscribe(alice, HOBBY_PRICE, HOBBY);
        skip(MONTH + 180 days);

        vm.prank(alice);
        billing.deposit(50e6);

        // The dead 180 days are written off, not charged against the new money.
        assertEq(billing.refundableOf(alice), 50e6);
        assertEq(billing.collectedRevenue(), HOBBY_PRICE);
        assertFalse(billing.isSubscribed(alice), "lapsed plan must be re-subscribed");

        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.activeUntil(alice), block.timestamp + 10 * MONTH);
    }

    function test_settleIsIdempotent() public {
        _subscribe(alice, 60e6, HOBBY);
        skip(MONTH);
        _settle(alice);
        uint256 revenue = billing.collectedRevenue();
        _settle(alice);
        _settle(alice);
        assertEq(billing.collectedRevenue(), revenue);
    }

    function test_settleDoesNotChangeExpiry() public {
        _subscribe(alice, 60e6, HOBBY);
        uint256 until = billing.activeUntil(alice);
        skip(MONTH / 3);
        _settle(alice);
        assertApproxEqAbs(billing.activeUntil(alice), until, 1, "settle moved a subscriber's expiry");
    }

    function test_anyoneMaySettle() public {
        _subscribe(alice, 60e6, HOBBY);
        skip(MONTH);
        vm.prank(stranger);
        _settle(alice);
        assertApproxEqAbs(billing.collectedRevenue(), 5e6, 1);
    }

    function test_settleBatch() public {
        _subscribe(alice, 60e6, HOBBY);
        _subscribe(bob, 60e6, PRO);
        skip(MONTH);

        address[] memory batch = new address[](3);
        batch[0] = alice;
        batch[1] = bob;
        batch[2] = stranger; // never subscribed; must be a harmless no-op
        billing.settle(batch);

        assertApproxEqAbs(billing.collectedRevenue(), 25e6, 2);
    }

    /*//////////////////////////////////////////////////////////////
                           PLANS AND SWITCHING
    //////////////////////////////////////////////////////////////*/

    function test_switchPlanSettlesOldRateFirst() public {
        _subscribe(alice, 100e6, HOBBY);
        skip(MONTH);
        vm.prank(alice);
        billing.subscribe(PRO);

        assertApproxEqAbs(billing.collectedRevenue(), 5e6, 1, "old plan not settled at old rate");
        skip(MONTH);
        assertApproxEqAbs(billing.refundableOf(alice), 100e6 - 25e6, 2);
    }

    function test_needAtLeastOneMonthPrepaid() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientPrepayment.selector, PRO_PRICE, 10e6)
        );
        billing.depositAndSubscribe(10e6, PRO);
    }

    function test_cannotSubscribeToClosedOrUnknownPlan() public {
        vm.prank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, false);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.PlanClosed.selector, HOBBY));
        billing.depositAndSubscribe(60e6, HOBBY);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.PlanClosed.selector, uint16(99)));
        billing.depositAndSubscribe(60e6, 99);
    }

    function test_closingAPlanLeavesExistingSubscribersAlone() public {
        _subscribe(alice, 60e6, HOBBY);
        uint256 until = billing.activeUntil(alice);

        vm.prank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, false);

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.activeUntil(alice), until);
    }

    function test_priceRiseDoesNotTouchExistingSubscribers() public {
        _subscribe(alice, 60e6, HOBBY);
        uint256 until = billing.activeUntil(alice);

        vm.prank(owner);
        billing.setPlan(HOBBY, 50_000_000, true); // 10x price hike

        assertEq(billing.activeUntil(alice), until, "owner repriced an existing subscription");
        skip(MONTH);
        assertApproxEqAbs(billing.refundableOf(alice), 55e6, 1);
    }

    /*//////////////////////////////////////////////////////////////
                         OPERATOR POWER LIMITS
    //////////////////////////////////////////////////////////////*/

    function test_ownerCannotTouchSubscriberBalances() public {
        _subscribe(alice, 600e6, HOBBY);
        skip(MONTH);
        _settle(alice);

        uint256 revenue = billing.collectedRevenue();
        assertApproxEqAbs(revenue, 5e6, 1);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 600e6, revenue)
        );
        billing.withdrawRevenue(owner, 600e6);

        vm.prank(owner);
        billing.withdrawRevenue(owner, 0); // 0 == everything available
        assertEq(usdc.balanceOf(owner), revenue);
        assertEq(billing.collectedRevenue(), 0);

        // Alice's money is untouched and still withdrawable.
        vm.prank(alice);
        uint256 refunded = billing.cancelAndWithdraw(alice);
        assertApproxEqAbs(refunded, 595e6, 1);
    }

    function test_ownerCannotRescueTheBillingToken() public {
        _subscribe(alice, 600e6, HOBBY);
        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.CannotRescueBillingToken.selector);
        billing.rescueToken(IERC20(address(usdc)), owner);
    }

    function test_onlyOwnerCanConfigureOrCollect() public {
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        billing.setPlan(3, 1e6, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        billing.withdrawRevenue(stranger, 0);
        vm.stopPrank();
    }

    /// @dev The key liveness property: if the owner key vanishes, subscribers are
    /// not locked in. They can still cancel and take their unused money home.
    function test_subscribersSurviveAnAbsentOperator() public {
        _subscribe(alice, 600e6, HOBBY);
        skip(90 days);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancelAndWithdraw(alice);
        assertApproxEqAbs(usdc.balanceOf(alice) - before, 600e6 - 15e6, 2);
    }

    /*//////////////////////////////////////////////////////////////
                               WITHDRAWALS
    //////////////////////////////////////////////////////////////*/

    function test_partialWithdrawShortensRunway() public {
        _subscribe(alice, 60e6, HOBBY);
        vm.prank(alice);
        billing.withdraw(30e6, alice);
        assertTrue(billing.isSubscribed(alice));
        assertApproxEqAbs(billing.activeUntil(alice), block.timestamp + 6 * MONTH, 1);
    }

    function test_withdrawingEverythingEndsTheSubscription() public {
        _subscribe(alice, 60e6, HOBBY);
        vm.prank(alice);
        billing.withdraw(60e6, alice);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.activeUntil(alice), 0);
    }

    function test_cannotWithdrawAccruedMoney() public {
        _subscribe(alice, 60e6, HOBBY);
        skip(MONTH);
        vm.prank(alice);
        vm.expectRevert();
        billing.withdraw(60e6, alice); // $5 already belongs to the operator
    }

    function test_depositForSomeoneElse() public {
        vm.prank(bob);
        billing.depositFor(alice, 60e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        assertTrue(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(bob), 940e6);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNTING INVARIANTS
    //////////////////////////////////////////////////////////////*/

    function test_contractAlwaysCoversWhatItOwes() public {
        _subscribe(alice, 600e6, HOBBY);
        _subscribe(bob, 300e6, PRO);

        for (uint256 i; i < 10; ++i) {
            skip(17 days);
            _settle(alice);
            assertEq(billing.solvencySurplus(), 0);
        }
        _settle(bob);
        assertEq(billing.solvencySurplus(), 0);
        assertEq(
            usdc.balanceOf(address(billing)),
            billing.totalSubscriberBalance() + billing.collectedRevenue()
        );
    }

    function testFuzz_refundPlusRevenueEqualsDeposit(uint96 deposited, uint32 elapsed, bool pro) public {
        uint16 planId = pro ? PRO : HOBBY;
        uint256 price = pro ? PRO_PRICE : HOBBY_PRICE;
        deposited = uint96(bound(deposited, price, 1_000_000e6));
        usdc.mint(alice, deposited);

        _subscribe(alice, deposited, planId);
        skip(elapsed);

        vm.prank(stranger);
        _settle(alice);

        uint256 refund = billing.refundableOf(alice);
        assertEq(refund + billing.collectedRevenue(), deposited, "money created or destroyed");
        assertLe(billing.collectedRevenue(), deposited);
    }

    function testFuzz_gateMatchesRunway(uint96 deposited, uint32 elapsed) public {
        deposited = uint96(bound(deposited, HOBBY_PRICE, 1_000_000e6));
        usdc.mint(alice, deposited);
        _subscribe(alice, deposited, HOBBY);

        uint256 expectedUntil = block.timestamp + (uint256(deposited) * 1e12 / billing.ratePerSecondOf(HOBBY));
        skip(elapsed);
        assertEq(billing.isSubscribed(alice), block.timestamp < expectedUntil);
    }
}
