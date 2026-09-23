// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, WeatherSubscriptions} from "../contracts/WeatherSubscriptions.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata revertData) external;
}

contract WeatherSubscriptionsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant OWNER = address(0xA11CE);
    address private constant CUSTOMER = address(0xB0B);
    address private constant TREASURY = address(0xCAFE);

    MockUSDC private usdc;
    WeatherSubscriptions private subscriptions;

    function setUp() external {
        usdc = new MockUSDC();
        subscriptions = new WeatherSubscriptions(IERC20(address(usdc)), OWNER);

        usdc.mint(CUSTOMER, 100_000000);
        vm.prank(CUSTOMER);
        usdc.approve(address(subscriptions), type(uint256).max);
    }

    function testHobbySubscriptionExpiresAfterPrepaidMonth() external {
        vm.prank(CUSTOMER);
        subscriptions.depositAndSubscribe(5_000000, WeatherSubscriptions.Plan.Hobby);

        assertTrue(subscriptions.isSubscribed(CUSTOMER), "customer starts subscribed");

        vm.warp(block.timestamp + 30 days - 1);
        assertTrue(subscriptions.isSubscribed(CUSTOMER), "customer is subscribed before expiry");

        vm.warp(block.timestamp + 1);
        assertFalse(subscriptions.isSubscribed(CUSTOMER), "customer is not subscribed at expiry");
    }

    function testCancelRefundsUnusedPrepaidBalance() external {
        vm.prank(CUSTOMER);
        subscriptions.depositAndSubscribe(5_000000, WeatherSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 15 days);

        vm.prank(CUSTOMER);
        uint256 refund = subscriptions.cancel();

        assertEq(refund, 2_500000, "refund");
        assertEq(usdc.balanceOf(CUSTOMER), 97_500000, "customer balance");
        assertEq(subscriptions.serviceBalance(), 2_500000, "service balance");
        assertFalse(subscriptions.isSubscribed(CUSTOMER), "canceled");
    }

    function testOwnerCanWithdrawOnlyEarnedServiceBalance() external {
        vm.prank(CUSTOMER);
        subscriptions.depositAndSubscribe(20_000000, WeatherSubscriptions.Plan.Pro);

        vm.warp(block.timestamp + 30 days);
        subscriptions.settleAccount(CUSTOMER);

        vm.prank(CUSTOMER);
        vm.expectRevert(bytes("ONLY_OWNER"));
        subscriptions.withdrawServiceBalance(TREASURY, 1);

        vm.prank(OWNER);
        subscriptions.withdrawServiceBalance(TREASURY, 20_000000);

        assertEq(usdc.balanceOf(TREASURY), 20_000000, "treasury received earned USDC");
        assertEq(subscriptions.serviceBalance(), 0, "service balance withdrawn");
    }

    function testBackendReadShowsLapsedAccountWithoutSettlement() external {
        vm.prank(CUSTOMER);
        subscriptions.depositAndSubscribe(20_000000, WeatherSubscriptions.Plan.Pro);

        vm.warp(block.timestamp + 31 days);

        assertFalse(subscriptions.isSubscribed(CUSTOMER), "lapsed account is not subscribed");

        (WeatherSubscriptions.Plan plan, uint256 prepaid,, uint256 paidThrough, bool subscribed) =
            subscriptions.accountOf(CUSTOMER);

        assertEq(uint256(plan), uint256(WeatherSubscriptions.Plan.Pro), "plan");
        assertEq(prepaid, 20_000000, "unsettled prepaid still escrowed");
        assertTrue(paidThrough < block.timestamp, "paid through is in the past");
        assertFalse(subscribed, "status");
    }

    function testPlanSwitchSettlesOldPlanThenUsesNewRate() external {
        vm.prank(CUSTOMER);
        subscriptions.depositAndSubscribe(25_000000, WeatherSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 30 days);

        vm.prank(CUSTOMER);
        subscriptions.subscribe(WeatherSubscriptions.Plan.Pro);

        assertEq(subscriptions.serviceBalance(), 5_000000, "old hobby month accrued");
        assertTrue(subscriptions.isSubscribed(CUSTOMER), "new pro plan funded");

        vm.warp(block.timestamp + 30 days);
        assertFalse(subscriptions.isSubscribed(CUSTOMER), "remaining 20 USDC buys one pro month");
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function assertTrue(bool value, string memory message) private pure {
        require(value, message);
    }

    function assertFalse(bool value, string memory message) private pure {
        require(!value, message);
    }
}
