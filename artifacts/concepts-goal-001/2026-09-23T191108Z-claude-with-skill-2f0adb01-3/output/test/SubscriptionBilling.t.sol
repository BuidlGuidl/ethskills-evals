// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal randomer = makeAddr("randomer");

    uint128 internal constant HOBBY = 5e6; // $5 / 30 days
    uint128 internal constant PRO = 20e6; // $20 / 30 days
    uint256 internal constant HOBBY_ID = 1;
    uint256 internal constant PRO_ID = 2;

    function setUp() public {
        usdc = new MockUSDC();
        uint128[] memory prices = new uint128[](2);
        prices[0] = HOBBY;
        prices[1] = PRO;
        billing = new SubscriptionBilling(IERC20(address(usdc)), treasury, owner, prices);

        vm.warp(1_700_000_000); // avoid timestamp 0 edge cases
        _fund(alice, 1_000e6);
        _fund(bob, 1_000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _subscribe(address who, uint256 amount, uint256 planId) internal {
        vm.startPrank(who);
        billing.deposit(amount);
        billing.subscribe(planId);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // The core question the backend asks
    // ------------------------------------------------------------------

    function test_isSubscribed_falseBeforeSubscribing() public view {
        assertFalse(billing.isSubscribed(alice));
    }

    function test_isSubscribed_trueWhileFunded_falseAfterRunsOut() public {
        _subscribe(alice, 10e6, HOBBY_ID); // $10 on a $5/mo plan = 60 days

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.subscribedUntil(alice), block.timestamp + 60 days);

        vm.warp(block.timestamp + 59 days);
        assertTrue(billing.isSubscribed(alice));

        // No transaction from anyone. The subscription lapses purely because time passed.
        vm.warp(block.timestamp + 1 days + 1);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_lapse_needsNoPoke_merchantStillCollectsEverything() public {
        _subscribe(alice, 10e6, HOBBY_ID);
        vm.warp(block.timestamp + 365 days); // a year of neglect

        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.pending(alice), 10e6, "accrual caps at prepaid balance");

        billing.settle(alice);
        assertEq(billing.collected(), 10e6);
        assertEq(billing.refundable(alice), 0);
    }

    // ------------------------------------------------------------------
    // Accrual / charging
    // ------------------------------------------------------------------

    function test_accrual_isProRataPerSecond() public {
        _subscribe(alice, 10e6, HOBBY_ID);

        vm.warp(block.timestamp + 30 days);
        assertEq(billing.pending(alice), HOBBY, "one full period = one month's price");

        assertEq(billing.refundable(alice), 10e6 - HOBBY);
    }

    function test_accrual_halfMonth() public {
        _subscribe(alice, 100e6, PRO_ID);
        vm.warp(block.timestamp + 15 days);
        assertEq(billing.pending(alice), PRO / 2);
    }

    function test_settle_movesRevenueAndResetsClock() public {
        _subscribe(alice, 100e6, PRO_ID);
        vm.warp(block.timestamp + 30 days);

        billing.settle(alice);
        assertEq(billing.collected(), PRO);
        assertEq(billing.pending(alice), 0);
        assertEq(billing.accountOf(alice).balance, 100e6 - PRO);

        // Settling twice in the same block must not double-charge.
        billing.settle(alice);
        assertEq(billing.collected(), PRO);
    }

    function test_settle_isPermissionless_andSweepOnlyPaysTreasury() public {
        _subscribe(alice, 100e6, PRO_ID);
        vm.warp(block.timestamp + 30 days);

        vm.prank(randomer); // merchant is offline; a stranger can still advance the books
        billing.settle(alice);

        vm.prank(randomer);
        billing.sweep();

        assertEq(usdc.balanceOf(treasury), PRO);
        assertEq(usdc.balanceOf(randomer), 0, "caller gains nothing, funds only go to treasury");
    }

    function test_settleMany() public {
        _subscribe(alice, 100e6, PRO_ID);
        _subscribe(bob, 100e6, HOBBY_ID);
        vm.warp(block.timestamp + 30 days);

        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        billing.settleMany(users);

        assertEq(billing.collected(), uint256(PRO) + HOBBY);
    }

    // ------------------------------------------------------------------
    // Cancellation and refunds
    // ------------------------------------------------------------------

    function test_cancel_refundsExactlyTheUnusedPortion() public {
        _subscribe(alice, 10e6, HOBBY_ID);
        vm.warp(block.timestamp + 15 days); // half a month used => $2.50

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancelAndWithdrawAll();

        assertEq(usdc.balanceOf(alice) - before, 10e6 - 2_500_000);
        assertEq(billing.collected(), 2_500_000);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancel_stopsTheClock() public {
        _subscribe(alice, 10e6, HOBBY_ID);
        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        billing.cancel();

        uint256 owedAtCancel = billing.collected();
        vm.warp(block.timestamp + 365 days);

        assertEq(billing.collected(), owedAtCancel, "no accrual after cancel");
        assertEq(billing.refundable(alice), 10e6 - 2_500_000, "refund does not decay");
    }

    function test_cancel_cannotBeBlockedByOwner() public {
        _subscribe(alice, 10e6, HOBBY_ID);
        // Owner closes every plan and walks away.
        vm.startPrank(owner);
        billing.setPlanOpen(HOBBY_ID, false);
        billing.setPlanOpen(PRO_ID, false);
        vm.stopPrank();

        vm.prank(alice);
        billing.cancelAndWithdrawAll();
        assertEq(usdc.balanceOf(alice), 1_000e6 - 0 - billing.collected());
    }

    function test_cancel_revertsIfNotSubscribed() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    function test_withdraw_whileSubscribedEndsCoverageImmediately() public {
        _subscribe(alice, 10e6, HOBBY_ID);
        assertTrue(billing.isSubscribed(alice));

        uint256 all = billing.refundable(alice);
        vm.prank(alice);
        billing.withdraw(all);

        assertFalse(billing.isSubscribed(alice), "drained balance = no coverage");
    }

    function test_withdraw_cannotTakeAccruedRevenue() public {
        _subscribe(alice, 10e6, HOBBY_ID);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.InsufficientBalance.selector);
        billing.withdraw(10e6); // the $2.50 already earned is not hers to take
    }

    // ------------------------------------------------------------------
    // Plans
    // ------------------------------------------------------------------

    function test_switchPlan_chargesOldPriceUpToTheSwitch() public {
        _subscribe(alice, 100e6, HOBBY_ID);
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        billing.subscribe(PRO_ID);
        assertEq(billing.collected(), HOBBY, "charged $5 for the hobby month");

        vm.warp(block.timestamp + 30 days);
        billing.settle(alice);
        assertEq(billing.collected(), uint256(HOBBY) + PRO, "then $20 for the pro month");
    }

    function test_subscribe_revertsWithoutMinimumRunway() public {
        vm.startPrank(alice);
        billing.deposit(1e5); // $0.10 on a $5/mo plan = ~14 hours
        vm.expectRevert(SubscriptionBilling.InsufficientRunway.selector);
        billing.subscribe(HOBBY_ID);
        vm.stopPrank();
    }

    function test_subscribe_revertsOnClosedOrUnknownPlan() public {
        vm.prank(owner);
        billing.setPlanOpen(HOBBY_ID, false);

        vm.startPrank(alice);
        billing.deposit(100e6);
        vm.expectRevert(SubscriptionBilling.PlanClosed.selector);
        billing.subscribe(HOBBY_ID);
        vm.expectRevert(SubscriptionBilling.NoSuchPlan.selector);
        billing.subscribe(99);
        vm.expectRevert(SubscriptionBilling.NoSuchPlan.selector);
        billing.subscribe(0);
        vm.stopPrank();
    }

    function test_closingAPlanDoesNotAffectExistingSubscribers() public {
        _subscribe(alice, 100e6, HOBBY_ID);
        vm.prank(owner);
        billing.setPlanOpen(HOBBY_ID, false);

        vm.warp(block.timestamp + 10 days);
        assertTrue(billing.isSubscribed(alice), "existing subscriber keeps their plan");
    }

    function test_ownerCannotRepriceExistingSubscribers() public {
        // There is simply no function to mutate a plan's price. Repricing = a new plan, opt-in.
        _subscribe(alice, 100e6, HOBBY_ID);
        vm.prank(owner);
        uint256 newPlan = billing.addPlan(50e6);

        vm.warp(block.timestamp + 30 days);
        billing.settle(alice);
        assertEq(billing.collected(), HOBBY, "still billed at the price she signed up for");
        assertEq(billing.planOf(newPlan).price, 50e6);
    }

    function test_onlyOwnerCanManagePlans() public {
        vm.startPrank(randomer);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, randomer)
        );
        billing.addPlan(1e6);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, randomer)
        );
        billing.setPlanOpen(HOBBY_ID, false);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, randomer)
        );
        billing.setTreasury(randomer);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Top-ups and the lapse/resume edge case
    // ------------------------------------------------------------------

    function test_topUpAfterLapse_doesNotBackbillTheGap() public {
        _subscribe(alice, 10e6, HOBBY_ID); // 60 days of runway
        vm.warp(block.timestamp + 120 days); // lapsed 60 days ago, nobody settled

        vm.prank(alice);
        billing.deposit(10e6);

        // She owes the original $10 and nothing for the 60 unfunded days.
        assertEq(billing.collected(), 10e6);
        assertEq(billing.refundable(alice), 10e6);
        assertTrue(billing.isSubscribed(alice), "top-up resumes the subscription from now");
        assertEq(billing.subscribedUntil(alice), block.timestamp + 60 days);
    }

    function test_depositFor_creditsTheRecipient() public {
        vm.prank(bob);
        billing.depositFor(alice, 10e6);
        assertEq(billing.accountOf(alice).balance, 10e6);
        assertEq(usdc.balanceOf(address(billing)), 10e6);
    }

    function test_depositWhileUnsubscribed_doesNotAccrue() public {
        vm.prank(alice);
        billing.deposit(10e6);
        vm.warp(block.timestamp + 365 days);
        assertEq(billing.pending(alice), 0);
        assertEq(billing.refundable(alice), 10e6);
    }

    // ------------------------------------------------------------------
    // Solvency invariant
    // ------------------------------------------------------------------

    function testFuzz_contractAlwaysCoversBalancesPlusCollected(
        uint96 depositA,
        uint96 depositB,
        uint32 elapsed
    ) public {
        depositA = uint96(bound(depositA, 1e6, 500e6));
        depositB = uint96(bound(depositB, 1e6, 500e6));
        elapsed = uint32(bound(elapsed, 0, 400 days));

        _subscribe(alice, depositA, HOBBY_ID);
        _subscribe(bob, depositB, PRO_ID);
        vm.warp(block.timestamp + elapsed);

        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        billing.settleMany(users);

        uint256 liabilities =
            billing.accountOf(alice).balance + billing.accountOf(bob).balance + billing.collected();
        assertEq(usdc.balanceOf(address(billing)), liabilities, "no money created or destroyed");
    }

    function testFuzz_refundPlusRevenueEqualsDeposit(uint96 amount, uint32 elapsed) public {
        amount = uint96(bound(amount, 1e6, 500e6));
        elapsed = uint32(bound(elapsed, 0, 400 days));

        _subscribe(alice, amount, HOBBY_ID);
        vm.warp(block.timestamp + elapsed);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancelAndWithdrawAll();

        assertEq(usdc.balanceOf(alice) - before + billing.collected(), amount);
    }
}
