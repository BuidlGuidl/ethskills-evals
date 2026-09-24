// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { WeatherApiBilling, IERC20 } from "../src/WeatherApiBilling.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function expectRevert(bytes4 revertData) external;
}

contract MockUSDC is IERC20 {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external
        override
        returns (bool)
    {
        uint256 approved = allowance[from][msg.sender];
        if (approved != type(uint256).max) {
            allowance[from][msg.sender] = approved - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract WeatherApiBillingTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant USDC = 1e6;
    address internal constant OWNER = address(0xA11CE);
    address internal constant CUSTOMER = address(0xB0B);
    address internal constant PAYOUT = address(0xCAFE);

    MockUSDC internal token;
    WeatherApiBilling internal billing;

    function setUp() external {
        token = new MockUSDC();
        billing = new WeatherApiBilling(IERC20(address(token)), OWNER);
        token.mint(CUSTOMER, 100 * USDC);

        vm.prank(CUSTOMER);
        token.approve(address(billing), type(uint256).max);
    }

    function testTopUpThenSubscribeMakesCustomerCurrentForOneMonth() external {
        vm.startPrank(CUSTOMER);
        billing.topUp(5 * USDC);
        billing.subscribe(WeatherApiBilling.Plan.Hobby);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(CUSTOMER));
        WeatherApiBilling.SubscriptionView memory status = billing.subscriptionOf(CUSTOMER);
        assertEq(uint256(status.plan), uint256(WeatherApiBilling.Plan.Hobby));
        assertEq64(status.paidThrough, uint64(block.timestamp + 30 days));
        assertEq(status.refundableNow, 5 * USDC);

        vm.warp(block.timestamp + 30 days);
        assertFalse(billing.isSubscribed(CUSTOMER));
    }

    function testProviderCanCollectAccruedRevenueWithoutCron() external {
        vm.startPrank(CUSTOMER);
        billing.topUp(10 * USDC);
        billing.subscribe(WeatherApiBilling.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 15 days);
        assertEq(billing.providerBalance(), 0);

        billing.collect(CUSTOMER);
        assertEq(billing.providerBalance(), 2_500_000);

        vm.prank(OWNER);
        billing.withdrawProviderBalance(PAYOUT, 2_500_000);

        assertEq(token.balanceOf(PAYOUT), 2_500_000);
        assertEq(billing.providerBalance(), 0);
    }

    function testCancelRefundsUnusedTimeAndLeavesEarnedWithdrawable() external {
        vm.startPrank(CUSTOMER);
        billing.topUp(20 * USDC);
        billing.subscribe(WeatherApiBilling.Plan.Pro);
        vm.stopPrank();

        vm.warp(block.timestamp + 15 days);

        vm.prank(CUSTOMER);
        uint256 refund = billing.cancel();

        assertEq(refund, 10 * USDC);
        assertEq(token.balanceOf(CUSTOMER), 90 * USDC);
        assertEq(billing.providerBalance(), 10 * USDC);
        assertFalse(billing.isSubscribed(CUSTOMER));
    }

    function testPlanChangeKeepsUnusedValue() external {
        vm.startPrank(CUSTOMER);
        billing.topUp(20 * USDC);
        billing.subscribe(WeatherApiBilling.Plan.Pro);
        vm.stopPrank();

        vm.warp(block.timestamp + 15 days);

        vm.prank(CUSTOMER);
        billing.subscribe(WeatherApiBilling.Plan.Hobby);

        WeatherApiBilling.SubscriptionView memory status = billing.subscriptionOf(CUSTOMER);
        assertEq64(status.paidThrough, uint64(block.timestamp + 60 days));
        assertEq(billing.providerBalance(), 10 * USDC);
    }

    function testExpiredSubscriberCanTopUpToReactivateSamePlan() external {
        vm.startPrank(CUSTOMER);
        billing.topUp(5 * USDC);
        billing.subscribe(WeatherApiBilling.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 31 days);
        assertFalse(billing.isSubscribed(CUSTOMER));

        vm.prank(CUSTOMER);
        billing.topUp(5 * USDC);

        assertTrue(billing.isSubscribed(CUSTOMER));
        WeatherApiBilling.SubscriptionView memory status = billing.subscriptionOf(CUSTOMER);
        assertEq64(status.paidThrough, uint64(block.timestamp + 30 days));
        assertEq(billing.providerBalance(), 5 * USDC);
    }

    function testOnlyOwnerCanWithdrawProviderBalance() external {
        vm.startPrank(CUSTOMER);
        billing.topUp(5 * USDC);
        billing.subscribe(WeatherApiBilling.Plan.Hobby);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        billing.collect(CUSTOMER);

        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherApiBilling.NotOwner.selector);
        billing.withdrawProviderBalance(CUSTOMER, 1);
    }

    function assertTrue(bool value) internal pure {
        if (!value) revert("expected true");
    }

    function assertFalse(bool value) internal pure {
        if (value) revert("expected false");
    }

    function assertEq(uint256 actual, uint256 expected) internal pure {
        if (actual != expected) revert("unexpected uint256");
    }

    function assertEq64(uint64 actual, uint64 expected) internal pure {
        if (actual != expected) revert("unexpected uint64");
    }
}
