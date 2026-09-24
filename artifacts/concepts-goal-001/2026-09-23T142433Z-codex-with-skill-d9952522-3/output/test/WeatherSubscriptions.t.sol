// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WeatherSubscriptions} from "../contracts/WeatherSubscriptions.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

contract WeatherSubscriptionsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant USDC = 1e6;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant TREASURY = address(0x7000);

    MockUSDC private token;
    WeatherSubscriptions private subscriptions;

    function setUp() external {
        token = new MockUSDC();
        subscriptions = new WeatherSubscriptions(address(token), TREASURY);

        token.mint(ALICE, 100 * USDC);
        token.mint(BOB, 100 * USDC);

        vm.prank(ALICE);
        token.approve(address(subscriptions), type(uint256).max);

        vm.prank(BOB);
        token.approve(address(subscriptions), type(uint256).max);
    }

    function testTopUpSelectsPlanAndChecksSubscription() external {
        vm.startPrank(ALICE);
        subscriptions.topUp(10 * USDC);
        subscriptions.selectPlan(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();

        assertTrue(subscriptions.isSubscribed(ALICE), "subscribed");
        assertEq(subscriptions.balanceOf(ALICE), 10 * USDC, "balance");
        assertEq(subscriptions.paidThroughOf(ALICE), block.timestamp + 60 days, "paid through");
    }

    function testAccruesAndOwnerWithdrawsRevenue() external {
        vm.startPrank(ALICE);
        subscriptions.topUp(10 * USDC);
        subscriptions.selectPlan(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 15 days);

        uint256 charged = subscriptions.settle(ALICE);
        assertEq(charged, 2_500_000, "charged");
        assertEq(subscriptions.balanceOf(ALICE), 7_500_000, "remaining");
        assertEq(subscriptions.withdrawableRevenue(), 2_500_000, "withdrawable");

        subscriptions.withdrawRevenue(2_500_000);
        assertEq(token.balanceOf(TREASURY), 2_500_000, "treasury");
    }

    function testSubscriptionExpiresWithoutCron() external {
        vm.startPrank(ALICE);
        subscriptions.topUp(5 * USDC);
        subscriptions.selectPlan(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        assertFalse(subscriptions.isSubscribed(ALICE), "expired at paid-through timestamp");

        uint256 charged = subscriptions.settle(ALICE);
        assertEq(charged, 5 * USDC, "charged all");
        assertEq(subscriptions.balanceOf(ALICE), 0, "no balance");
        assertFalse(subscriptions.isSubscribed(ALICE), "not subscribed");
    }

    function testCancelRefundsUnusedCredit() external {
        vm.startPrank(ALICE);
        subscriptions.topUp(5 * USDC);
        subscriptions.selectPlan(WeatherSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 15 days);
        uint256 refund = subscriptions.cancel();
        vm.stopPrank();

        assertEq(refund, 2_500_000, "refund");
        assertEq(token.balanceOf(ALICE), 97_500_000, "alice keeps unspent credit");
        assertEq(subscriptions.withdrawableRevenue(), 2_500_000, "earned revenue");
        assertFalse(subscriptions.isSubscribed(ALICE), "canceled");
    }

    function testCanSwitchPlansAfterSettlingOldPlan() external {
        vm.startPrank(ALICE);
        subscriptions.topUp(25 * USDC);
        subscriptions.selectPlan(WeatherSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 15 days);
        subscriptions.selectPlan(WeatherSubscriptions.Plan.Pro);
        vm.stopPrank();

        (WeatherSubscriptions.Plan plan, bool active,, uint256 currentBalance,,,) = subscriptions.accountOf(ALICE);

        assertEq(uint256(plan), uint256(WeatherSubscriptions.Plan.Pro), "plan");
        assertTrue(active, "active");
        assertEq(currentBalance, 22_500_000, "remaining after hobby accrual");
    }

    function testSelectingPlanRequiresOneMonthPrepaid() external {
        vm.startPrank(ALICE);
        subscriptions.topUp(4 * USDC);

        vm.expectRevert(abi.encodeWithSelector(WeatherSubscriptions.InsufficientCredit.selector, 5 * USDC, 4 * USDC));
        subscriptions.selectPlan(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function assertFalse(bool value, string memory message) private pure {
        require(!value, message);
    }

    function assertTrue(bool value, string memory message) private pure {
        require(value, message);
    }
}
