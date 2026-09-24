// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WeatherBilling} from "../src/WeatherBilling.sol";
import {MockUSDC} from "../src/test/MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract WeatherBillingTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant PROVIDER = address(0xB11);
    address private constant CUSTOMER = address(0xCAFE);
    address private constant OTHER = address(0xD00D);

    MockUSDC private usdc;
    WeatherBilling private billing;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new WeatherBilling(address(usdc), PROVIDER);
        usdc.mint(CUSTOMER, 100_000_000);
    }

    function testCustomerCanTopUpAndStartHobbyPlan() public {
        _topUp(CUSTOMER, 10_000_000);

        vm.prank(CUSTOMER);
        billing.startSubscription(WeatherBilling.Plan.Hobby);

        assertTrue(billing.isSubscribed(CUSTOMER), "subscribed");
        assertEq(billing.availableBalanceOf(CUSTOMER), 10_000_000, "available balance");
        assertEq(billing.paidUntil(CUSTOMER), block.timestamp + 60 days, "paid until");
    }

    function testAccruesRevenueOverTimeAndAnyoneCanSettle() public {
        _startHobbyWithTenUsdc();

        vm.warp(block.timestamp + 30 days);
        assertTrue(billing.isSubscribed(CUSTOMER), "still has another month");
        assertEq(billing.availableBalanceOf(CUSTOMER), 5_000_000, "available after month");

        billing.settle(CUSTOMER);

        assertEq(billing.providerWithdrawable(), 5_000_000, "provider revenue");
        assertEq(billing.availableBalanceOf(CUSTOMER), 5_000_000, "remaining balance");
    }

    function testSubscriptionExpiresWhenBalanceRunsOut() public {
        _startHobbyWithTenUsdc();

        vm.warp(block.timestamp + 60 days);
        assertFalse(billing.isSubscribed(CUSTOMER), "expired at exact paid-until");

        billing.settle(CUSTOMER);

        assertEq(billing.providerWithdrawable(), 10_000_000, "all paid out");
        assertEq(billing.availableBalanceOf(CUSTOMER), 0, "nothing left");
        assertFalse(billing.isSubscribed(CUSTOMER), "inactive after settlement");
    }

    function testTopUpAfterExpirationDoesNotPayForInactiveGap() public {
        _startHobbyWithTenUsdc();

        vm.warp(block.timestamp + 90 days);
        _topUp(CUSTOMER, 5_000_000);

        assertEq(billing.providerWithdrawable(), 10_000_000, "only funded time charged");
        assertEq(billing.availableBalanceOf(CUSTOMER), 5_000_000, "new top-up is preserved");

        vm.prank(CUSTOMER);
        billing.startSubscription(WeatherBilling.Plan.Hobby);

        assertTrue(billing.isSubscribed(CUSTOMER), "can restart");
        assertEq(billing.paidUntil(CUSTOMER), block.timestamp + 30 days, "fresh month");
    }

    function testCancelRefundsUnusedBalanceAfterProratedUsage() public {
        _startHobbyWithTenUsdc();

        vm.warp(block.timestamp + 15 days);
        vm.prank(CUSTOMER);
        billing.cancel();

        assertEq(usdc.balanceOf(CUSTOMER), 97_500_000, "customer got unused funds back");
        assertEq(billing.providerWithdrawable(), 2_500_000, "provider earned half month");
        assertFalse(billing.isSubscribed(CUSTOMER), "cancelled");
    }

    function testCanChangeFromHobbyToProAfterSettlingOldPlan() public {
        _startHobbyWithTenUsdc();

        vm.warp(block.timestamp + 15 days);
        vm.prank(CUSTOMER);
        billing.startSubscription(WeatherBilling.Plan.Pro);

        assertEq(billing.providerWithdrawable(), 2_500_000, "hobby prorated");
        assertEq(billing.availableBalanceOf(CUSTOMER), 7_500_000, "credit remains");

        vm.warp(block.timestamp + 11 days + 6 hours);
        assertFalse(billing.isSubscribed(CUSTOMER), "pro balance exhausted");
    }

    function testProviderCanWithdrawRevenue() public {
        _startHobbyWithTenUsdc();
        vm.warp(block.timestamp + 30 days);
        billing.settle(CUSTOMER);

        vm.prank(PROVIDER);
        billing.withdrawProviderRevenue(PROVIDER, 5_000_000);

        assertEq(usdc.balanceOf(PROVIDER), 5_000_000, "withdrawn");
        assertEq(billing.providerWithdrawable(), 0, "accounted");
    }

    function testNonProviderCannotWithdrawRevenue() public {
        vm.prank(OTHER);
        vm.expectRevert(WeatherBilling.NotProvider.selector);
        billing.withdrawProviderRevenue(OTHER, 1);
    }

    function _startHobbyWithTenUsdc() private {
        _topUp(CUSTOMER, 10_000_000);
        vm.prank(CUSTOMER);
        billing.startSubscription(WeatherBilling.Plan.Hobby);
    }

    function _topUp(address customer, uint256 amount) private {
        vm.startPrank(customer);
        usdc.approve(address(billing), amount);
        billing.topUp(amount);
        vm.stopPrank();
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
