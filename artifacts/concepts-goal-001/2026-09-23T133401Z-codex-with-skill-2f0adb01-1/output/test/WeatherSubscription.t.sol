// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {WeatherSubscription, IERC20} from "../src/WeatherSubscription.sol";

interface Vm {
    function expectRevert(bytes4 revertData) external;
    function getBlockTimestamp() external view returns (uint256);
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address account => uint256 balance) public balanceOf;
    mapping(address account => mapping(address spender => uint256 amount)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract WeatherSubscriptionTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC internal usdc;
    WeatherSubscription internal subscription;

    address internal owner = address(0xA11CE);
    address internal customer = address(0xB0B);
    address internal treasury = address(0xCAFE);

    uint256 internal constant USDC = 1_000_000;

    function setUp() public {
        usdc = new MockUSDC();
        subscription = new WeatherSubscription(IERC20(address(usdc)), owner);

        usdc.mint(customer, 100 * USDC);
        vm.prank(customer);
        usdc.approve(address(subscription), type(uint256).max);
    }

    function testTopUpAndSubscribeMakesCustomerActive() public {
        uint8 hobby = subscription.PLAN_HOBBY();

        vm.prank(customer);
        subscription.topUpAndSubscribe(hobby, 10 * USDC);

        assertTrue(subscription.isSubscribed(customer));
        assertEq(usdc.balanceOf(address(subscription)), 10 * USDC);

        WeatherSubscription.AccountStatus memory status = subscription.accountStatus(customer);
        assertEq(uint256(status.plan), uint256(hobby));
        assertEq(status.remainingBalance, 10 * USDC);
        assertEq(status.paidThrough, block.timestamp + 60 days);
    }

    function testCancelRefundsUnusedCreditAndSettlesUsedTime() public {
        uint8 hobby = subscription.PLAN_HOBBY();

        vm.prank(customer);
        subscription.topUpAndSubscribe(hobby, 10 * USDC);

        vm.warp(block.timestamp + 15 days);

        vm.prank(customer);
        uint256 refund = subscription.cancel();

        assertEq(refund, 7_500_000);
        assertEq(subscription.providerBalance(), 2_500_000);
        assertFalse(subscription.isSubscribed(customer));
        assertEq(usdc.balanceOf(customer), 97_500_000);

        uint256 withdrawAmount = subscription.providerBalance();
        vm.prank(owner);
        subscription.withdraw(treasury, withdrawAmount);
        assertEq(usdc.balanceOf(treasury), 2_500_000);
    }

    function testSubscriptionExpiresWhenCreditRunsOutEvenBeforeSettlement() public {
        uint8 pro = subscription.PLAN_PRO();

        vm.prank(customer);
        subscription.topUpAndSubscribe(pro, 20 * USDC);

        uint256 start = vm.getBlockTimestamp();
        vm.warp(start + 30 days - 1);
        assertTrue(subscription.isSubscribed(customer));

        vm.warp(block.timestamp + 1);
        assertFalse(subscription.isSubscribed(customer));
        assertEq(subscription.providerBalance(), 0);

        subscription.settle(customer);

        assertEq(subscription.providerBalance(), 20 * USDC);
        assertFalse(subscription.isSubscribed(customer));
    }

    function testCanChangePlanAfterAccruingOldPlan() public {
        uint8 hobby = subscription.PLAN_HOBBY();
        uint8 pro = subscription.PLAN_PRO();

        vm.prank(customer);
        subscription.topUpAndSubscribe(hobby, 25 * USDC);

        uint256 start = vm.getBlockTimestamp();
        vm.warp(start + 30 days);

        vm.prank(customer);
        subscription.subscribe(pro);

        assertEq(subscription.providerBalance(), 5 * USDC);
        assertTrue(subscription.isSubscribed(customer));

        WeatherSubscription.AccountStatus memory status = subscription.accountStatus(customer);
        assertEq(uint256(status.plan), uint256(pro));
        assertEq(status.remainingBalance, 20 * USDC);
        assertEq(status.paidThrough, block.timestamp + 30 days);
    }

    function testSettleManyAccruesMultipleAccounts() public {
        uint8 hobby = subscription.PLAN_HOBBY();
        uint8 pro = subscription.PLAN_PRO();
        address second = address(0xDAD);
        usdc.mint(second, 50 * USDC);
        vm.prank(second);
        usdc.approve(address(subscription), type(uint256).max);

        vm.prank(customer);
        subscription.topUpAndSubscribe(hobby, 10 * USDC);
        vm.prank(second);
        subscription.topUpAndSubscribe(pro, 40 * USDC);

        vm.warp(block.timestamp + 30 days);

        address[] memory customers = new address[](2);
        customers[0] = customer;
        customers[1] = second;

        uint256 charged = subscription.settleMany(customers);

        assertEq(charged, 25 * USDC);
        assertEq(subscription.providerBalance(), 25 * USDC);
    }

    function testOnlyOwnerCanWithdraw() public {
        uint8 hobby = subscription.PLAN_HOBBY();

        vm.prank(customer);
        subscription.topUpAndSubscribe(hobby, 10 * USDC);
        vm.warp(block.timestamp + 30 days);
        subscription.settle(customer);

        vm.expectRevert(WeatherSubscription.NotOwner.selector);
        vm.prank(customer);
        subscription.withdraw(treasury, 5 * USDC);
    }

    function assertTrue(bool value) internal pure {
        require(value, "expected true");
    }

    function assertFalse(bool value) internal pure {
        require(!value, "expected false");
    }

    function assertEq(uint256 actual, uint256 expected) internal pure {
        require(actual == expected, "uint mismatch");
    }

}
