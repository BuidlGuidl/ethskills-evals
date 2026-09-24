// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20, WeatherSubscriptions} from "../contracts/WeatherSubscriptions.sol";
import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";

interface Vm {
    function prank(address caller) external;
    function startPrank(address caller) external;
    function stopPrank() external;
    function warp(uint256 timestamp) external;
}

contract WeatherSubscriptionsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    WeatherSubscriptions private billing;

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant TREASURY = address(0x1234);

    function setUp() public {
        usdc = new MockUSDC();
        billing = new WeatherSubscriptions(IERC20(address(usdc)), TREASURY);

        usdc.mint(ALICE, 100_000_000);
        usdc.mint(BOB, 100_000_000);

        vm.prank(ALICE);
        usdc.approve(address(billing), type(uint256).max);

        vm.prank(BOB);
        usdc.approve(address(billing), type(uint256).max);
    }

    function testTopUpAndSubscribeCreatesReadableStatus() public {
        vm.startPrank(ALICE);
        billing.topUp(10_000_000);
        billing.subscribe(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(ALICE), "alice should be active");
        assertEq(billing.availableBalance(ALICE), 10_000_000, "starting balance");
        assertEq(billing.activeUntil(ALICE), block.timestamp + 60 days, "two hobby months");

        (
            WeatherSubscriptions.Plan plan,
            string memory planName,
            uint256 balance,
            uint256 monthlyPrice,
            uint256 paidTotal,
            uint256 activeThrough,
            bool active
        ) = billing.subscriptionStatus(ALICE);

        assertEq(uint256(plan), uint256(WeatherSubscriptions.Plan.Hobby), "plan");
        assertStringEq(planName, "hobby", "plan name");
        assertEq(balance, 10_000_000, "status balance");
        assertEq(monthlyPrice, 5_000_000, "monthly price");
        assertEq(paidTotal, 0, "paid total");
        assertEq(activeThrough, block.timestamp + 60 days, "status active through");
        assertTrue(active, "status active");
    }

    function testSettlementAccruesEarnedFeesAndWithdraws() public {
        vm.startPrank(ALICE);
        billing.topUp(20_000_000);
        billing.subscribe(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 15 days);
        assertEq(billing.availableBalance(ALICE), 17_500_000, "half month preview");

        billing.settle(ALICE);
        assertEq(billing.availableBalance(ALICE), 17_500_000, "settled balance");
        assertEq(billing.withdrawable(), 2_500_000, "earned");

        billing.withdrawAll();
        assertEq(usdc.balanceOf(TREASURY), 2_500_000, "treasury received earned fees");
    }

    function testCancelRefundsUnusedBalance() public {
        vm.startPrank(ALICE);
        billing.topUp(5_000_000);
        billing.subscribe(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 15 days);

        vm.prank(ALICE);
        uint256 refund = billing.cancel();

        assertEq(refund, 2_500_000, "refund");
        assertEq(usdc.balanceOf(ALICE), 97_500_000, "alice balance after refund");
        assertEq(billing.withdrawable(), 2_500_000, "earned after cancel");
        assertFalse(billing.isSubscribed(ALICE), "alice canceled");
    }

    function testSubscriptionStopsWhenPrepaidBalanceRunsOut() public {
        vm.startPrank(ALICE);
        billing.topUp(20_000_000);
        billing.subscribe(WeatherSubscriptions.Plan.Pro);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days - 1);
        assertTrue(billing.isSubscribed(ALICE), "active before paid-through time");

        vm.warp(block.timestamp + 1);
        assertFalse(billing.isSubscribed(ALICE), "inactive once balance is consumed");

        billing.settle(ALICE);
        assertEq(billing.withdrawable(), 20_000_000, "all prepaid funds earned");
        assertEq(uint256(currentPlan(ALICE)), uint256(WeatherSubscriptions.Plan.None), "plan cleared");
    }

    function testCanTopUpForAnotherAccount() public {
        vm.prank(BOB);
        billing.topUpFor(ALICE, 5_000_000);

        vm.prank(ALICE);
        billing.subscribe(WeatherSubscriptions.Plan.Hobby);

        assertTrue(billing.isSubscribed(ALICE), "alice active");
        assertEq(usdc.balanceOf(BOB), 95_000_000, "bob paid");
    }

    function testCannotSubscribeWithoutBalance() public {
        vm.prank(ALICE);
        (bool ok,) =
            address(billing).call(abi.encodeCall(WeatherSubscriptions.subscribe, (WeatherSubscriptions.Plan.Hobby)));

        assertFalse(ok, "subscribe should revert without balance");
    }

    function testCanSwitchPlansAfterAccruingOldPlan() public {
        vm.startPrank(ALICE);
        billing.topUp(25_000_000);
        billing.subscribe(WeatherSubscriptions.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);

        vm.prank(ALICE);
        billing.subscribe(WeatherSubscriptions.Plan.Pro);

        assertEq(billing.withdrawable(), 5_000_000, "hobby month charged");
        assertEq(billing.availableBalance(ALICE), 20_000_000, "remaining pro credit");
        assertEq(uint256(currentPlan(ALICE)), uint256(WeatherSubscriptions.Plan.Pro), "switched to pro");
    }

    function currentPlan(address account) private view returns (WeatherSubscriptions.Plan plan) {
        (plan,,,,) = billing.subscriptions(account);
    }

    function assertTrue(bool value, string memory message) private pure {
        require(value, message);
    }

    function assertFalse(bool value, string memory message) private pure {
        require(!value, message);
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function assertStringEq(string memory actual, string memory expected, string memory message) private pure {
        require(keccak256(bytes(actual)) == keccak256(bytes(expected)), message);
    }
}
