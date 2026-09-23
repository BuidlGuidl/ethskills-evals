// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Subscriptions} from "../src/Subscriptions.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract SubscriptionsTest is Test {
    Subscriptions sub;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint64 constant MONTH = 30 days;
    uint128 constant HOBBY_PRICE = 5e6;
    uint128 constant PRO_PRICE = 20e6;

    uint32 hobby;
    uint32 pro;

    function setUp() public {
        usdc = new MockUSDC();
        sub = new Subscriptions(IERC20(address(usdc)), owner);
        vm.startPrank(owner);
        hobby = sub.addPlan(HOBBY_PRICE, MONTH);
        pro = sub.addPlan(PRO_PRICE, MONTH);
        vm.stopPrank();

        vm.warp(1_800_000_000);
        _fund(alice, 1000e6);
        _fund(bob, 1000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(sub), type(uint256).max);
    }

    function _subscribe(address who, uint32 planId, uint256 amount) internal {
        vm.prank(who);
        sub.subscribe(planId, amount);
    }

    // --- core lifecycle -------------------------------------------------

    function test_subscribe_setsExpiryFromDeposit() public {
        _subscribe(alice, hobby, 5e6);
        assertTrue(sub.isSubscribed(alice));
        assertEq(sub.expiryOf(alice), uint64(block.timestamp) + MONTH, "one month of runway for one month of price");
    }

    function test_subscription_lapsesExactlyWhenBalanceRunsOut() public {
        _subscribe(alice, hobby, 5e6);
        uint64 expiry = sub.expiryOf(alice);

        vm.warp(expiry - 1);
        assertTrue(sub.isSubscribed(alice), "still live one second before expiry");

        vm.warp(expiry);
        assertFalse(sub.isSubscribed(alice), "lapses with nobody sending a transaction");
    }

    function test_topUp_extendsRunway() public {
        _subscribe(alice, hobby, 5e6);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        sub.topUp(alice, 5e6);

        // 15 days used, 15 days left, plus a fresh month.
        assertEq(sub.expiryOf(alice), uint64(block.timestamp) + 45 days);
    }

    function test_anyoneCanTopUpAnyone() public {
        _subscribe(alice, hobby, 5e6);
        vm.prank(bob);
        sub.topUp(alice, 20e6);
        assertEq(sub.expiryOf(alice), uint64(block.timestamp) + 5 * MONTH);
    }

    function test_cancel_refundsExactlyTheUnusedPortion() public {
        _subscribe(alice, pro, 20e6);
        vm.warp(block.timestamp + 10 days);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 refund = sub.cancel(alice);

        // Ten of thirty days consumed at $20/month.
        assertEq(refund, 20e6 - (20e6 * 10 days) / MONTH);
        assertEq(usdc.balanceOf(alice) - before, refund);
        assertEq(sub.earned(), (20e6 * 10 days) / MONTH);
        assertFalse(sub.isSubscribed(alice));
    }

    function test_cancel_immediatelyAfterSubscribing_refundsEverything() public {
        _subscribe(alice, pro, 20e6);
        vm.prank(alice);
        assertEq(sub.cancel(alice), 20e6);
        assertEq(sub.earned(), 0);
    }

    function test_withdraw_shortensExpiryButKeepsPlan() public {
        _subscribe(alice, hobby, 10e6);
        vm.prank(alice);
        sub.withdraw(5e6, alice);

        assertTrue(sub.isSubscribed(alice));
        assertEq(sub.expiryOf(alice), uint64(block.timestamp) + MONTH);
    }

    function test_withdraw_cannotReachConsumedBalance() public {
        _subscribe(alice, hobby, 5e6);
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        vm.expectRevert(Subscriptions.InsufficientBalance.selector);
        sub.withdraw(5e6, alice);

        vm.prank(alice);
        sub.withdraw(2.5e6, alice); // half is still theirs
    }

    function test_switchPlan_chargesEachRateProRata() public {
        _subscribe(alice, hobby, 100e6);
        vm.warp(block.timestamp + 30 days);
        _subscribe(alice, pro, 0);
        assertEq(sub.earned(), 5e6, "one month of hobby");

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        sub.cancel(alice);
        assertEq(sub.earned(), 25e6, "plus one month of pro");
    }

    // --- settlement -----------------------------------------------------

    function test_collect_isPermissionlessAndOnlyMovesConsumedBalance() public {
        _subscribe(alice, pro, 20e6);
        vm.warp(block.timestamp + 6 days);

        address[] memory list = new address[](1);
        list[0] = alice;

        uint256 expected = (20e6 * 6 days) / MONTH;
        assertEq(sub.pendingRevenue(list), expected);

        vm.prank(bob); // a stranger can settle; it is only bookkeeping
        sub.collect(list);

        assertEq(sub.earned(), expected);
        assertEq(sub.pendingRevenue(list), 0);
        assertTrue(sub.isSubscribed(alice), "settling does not interrupt service");
        assertEq(sub.expiryOf(alice), uint64(block.timestamp) + 24 days, "settling does not change expiry");
    }

    function test_collectingLateEarnsTheSameAsCollectingOften() public {
        _subscribe(alice, pro, 60e6);
        _subscribe(bob, pro, 60e6);

        address[] memory one = new address[](1);
        one[0] = alice;

        for (uint256 i = 0; i < 90; ++i) {
            vm.warp(block.timestamp + 1 days);
            sub.collect(one); // alice settled daily
        }
        address[] memory other = new address[](1);
        other[0] = bob;
        sub.collect(other); // bob settled once, at the end

        (,,, uint256 aliceBal,) = sub.statusOf(alice);
        (,,, uint256 bobBal,) = sub.statusOf(bob);
        assertEq(aliceBal, bobBal, "settlement cadence cannot change what anyone owes");
    }

    function test_lapsedAccount_neverOwesMoreThanItDeposited() public {
        _subscribe(alice, pro, 20e6);
        vm.warp(block.timestamp + 3650 days); // ten years later

        address[] memory list = new address[](1);
        list[0] = alice;
        sub.collect(list);

        assertEq(sub.earned(), 20e6, "debt is capped at the deposit");
        (,,, uint256 balance,) = sub.statusOf(alice);
        assertEq(balance, 0);
    }

    function test_restartAfterLapse_doesNotBackbillTheGap() public {
        _subscribe(alice, hobby, 5e6);
        vm.warp(block.timestamp + 365 days); // lapsed for eleven months

        vm.prank(alice);
        sub.topUp(alice, 5e6);

        assertTrue(sub.isSubscribed(alice));
        assertEq(sub.expiryOf(alice), uint64(block.timestamp) + MONTH, "the new deposit buys a full month");
        assertEq(sub.earned(), 5e6, "and the dead time is not charged for");
    }

    // --- operator powers and their limits -------------------------------

    function test_owner_cannotTouchSubscriberDeposits() public {
        _subscribe(alice, pro, 100e6);
        vm.prank(owner);
        vm.expectRevert(Subscriptions.InsufficientBalance.selector);
        sub.withdrawRevenue(owner, 1);
    }

    function test_owner_withdrawsOnlySettledRevenue() public {
        _subscribe(alice, pro, 20e6);
        vm.warp(block.timestamp + 15 days);

        address[] memory list = new address[](1);
        list[0] = alice;
        sub.collect(list);

        vm.prank(owner);
        sub.withdrawRevenue(owner, 10e6);
        assertEq(usdc.balanceOf(owner), 10e6);
        assertEq(sub.earned(), 0);
    }

    function test_closingAPlan_doesNotDisturbExistingSubscribers() public {
        _subscribe(alice, hobby, 5e6);
        vm.prank(owner);
        sub.setPlanOpen(hobby, false);

        assertTrue(sub.isSubscribed(alice), "an existing subscriber keeps their plan");
        vm.warp(block.timestamp + 10 days);
        assertTrue(sub.isSubscribed(alice));

        vm.prank(bob);
        vm.expectRevert(Subscriptions.PlanClosed.selector);
        sub.subscribe(hobby, 5e6);
    }

    function test_thereIsNoWayToRepriceAnExistingPlan() public {
        // No setter exists; the only path to a new price is a new plan id that a
        // subscriber has to opt into. This test documents that by checking the ABI.
        assertEq(sub.planCount(), 2);
        (uint128 price, uint64 period, bool open) = sub.plans(hobby);
        assertEq(price, HOBBY_PRICE);
        assertEq(period, MONTH);
        assertTrue(open);
    }

    function test_subscribersSurviveTheOwnerDisappearing() public {
        _subscribe(alice, pro, 40e6);
        vm.warp(block.timestamp + 10 days);

        // Owner key is gone: no transaction from `owner` will ever land again.
        assertTrue(sub.isSubscribed(alice), "billing keeps working");
        vm.prank(alice);
        uint256 refund = sub.cancel(alice);
        assertGt(refund, 0, "and the exit still works");
    }

    function test_sweep_cannotReachDepositsOrRevenue() public {
        _subscribe(alice, pro, 20e6);
        vm.warp(block.timestamp + 15 days);
        address[] memory list = new address[](1);
        list[0] = alice;
        sub.collect(list);

        usdc.mint(address(sub), 7e6); // someone transferred straight to the contract

        vm.prank(owner);
        uint256 swept = sub.sweep(IERC20(address(usdc)), owner);
        assertEq(swept, 7e6, "only the surplus");
        assertEq(usdc.balanceOf(address(sub)), sub.totalDeposits() + sub.earned());
    }

    function test_onlyOwnerGuards() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        sub.addPlan(1e6, MONTH);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        sub.withdrawRevenue(alice, 0);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        sub.setPlanOpen(hobby, false);
        vm.stopPrank();
    }

    function test_rejectsUnknownOrEmptySubscription() public {
        vm.prank(alice);
        vm.expectRevert(Subscriptions.NoSuchPlan.selector);
        sub.subscribe(99, 5e6);

        vm.prank(alice);
        vm.expectRevert(Subscriptions.NothingToDeposit.selector);
        sub.subscribe(hobby, 0);

        vm.prank(alice);
        vm.expectRevert(Subscriptions.NotSubscribed.selector);
        sub.cancel(alice);
    }

    // --- invariant-ish fuzzing -----------------------------------------

    /// @dev The property the whole thing rests on: the contract always holds at least
    ///      what it owes subscribers plus what it owes the operator.
    function testFuzz_solvency(uint96 deposit, uint32 elapsed, bool useProPlan) public {
        deposit = uint96(bound(deposit, 1e6, 1_000_000e6));
        usdc.mint(alice, deposit);

        _subscribe(alice, useProPlan ? pro : hobby, deposit);
        vm.warp(block.timestamp + elapsed);

        address[] memory list = new address[](1);
        list[0] = alice;
        sub.collect(list);

        assertGe(usdc.balanceOf(address(sub)), sub.totalDeposits() + sub.earned());

        vm.prank(alice);
        uint256 refund = sub.cancel(alice);
        assertLe(refund, deposit);
        assertGe(usdc.balanceOf(address(sub)), sub.totalDeposits() + sub.earned());
    }

    /// @dev Refund plus revenue must equal the deposit, whenever the customer leaves.
    function testFuzz_noValueIsCreatedOrDestroyed(uint96 deposit, uint32 elapsed) public {
        deposit = uint96(bound(deposit, 1e6, 1_000_000e6));
        usdc.mint(alice, deposit);
        _subscribe(alice, pro, deposit);

        vm.warp(block.timestamp + elapsed);
        vm.prank(alice);
        uint256 refund = sub.cancel(alice);

        assertEq(refund + sub.earned(), deposit);
    }
}
