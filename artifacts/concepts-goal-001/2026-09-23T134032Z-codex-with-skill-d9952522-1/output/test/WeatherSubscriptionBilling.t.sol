// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WeatherSubscriptionBilling} from "../src/WeatherSubscriptionBilling.sol";

interface Vm {
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract WeatherSubscriptionBillingTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    WeatherSubscriptionBilling private billing;

    address private constant ALICE = address(0xA11CE);
    address private constant TREASURY = address(0x7E3A);
    uint256 private constant USDC = 1_000_000;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new WeatherSubscriptionBilling(address(usdc), TREASURY);
        usdc.mint(ALICE, 100 * USDC);
        vm.prank(ALICE);
        usdc.approve(address(billing), type(uint256).max);
    }

    function testTopUpSubscribeAndMonthlyStatus() public {
        vm.prank(ALICE);
        billing.topUpAndSubscribe(WeatherSubscriptionBilling.Plan.Hobby, 15 * USDC);

        (bool active, WeatherSubscriptionBilling.Plan plan, uint256 refundable, uint256 credit, uint256 activeUntil) =
            billing.subscriptionStatus(ALICE);
        require(active, "active");
        require(plan == WeatherSubscriptionBilling.Plan.Hobby, "hobby");
        require(refundable == 15 * USDC, "refundable");
        require(credit == 10 * USDC, "credit");
        require(activeUntil == block.timestamp + 30 days, "paid through");
        require(billing.withdrawableRevenue() == 0, "unearned revenue");

        vm.warp(block.timestamp + 45 days);

        (active,, refundable, credit, activeUntil) = billing.subscriptionStatus(ALICE);
        require(active, "virtually renewed");
        require(refundable == 7_500_000, "half second month plus credit");
        require(credit == 5 * USDC, "remaining credit");
        require(activeUntil == 60 days + 1, "second month end");
    }

    function testCancelRefundsUnusedValue() public {
        vm.prank(ALICE);
        billing.topUpAndSubscribe(WeatherSubscriptionBilling.Plan.Hobby, 10 * USDC);

        vm.warp(block.timestamp + 15 days);

        vm.prank(ALICE);
        billing.cancel();

        require(usdc.balanceOf(ALICE) == 97_500_000, "refund");
        require(billing.withdrawableRevenue() == 2_500_000, "earned half month");

        billing.withdrawRevenue(2_500_000);
        require(usdc.balanceOf(TREASURY) == 2_500_000, "treasury paid");
    }

    function testExpiresWhenCreditCannotCoverNextMonth() public {
        vm.prank(ALICE);
        billing.topUpAndSubscribe(WeatherSubscriptionBilling.Plan.Hobby, 5 * USDC);

        vm.warp(block.timestamp + 31 days);

        (bool active,,, uint256 credit, uint256 activeUntil) = billing.subscriptionStatus(ALICE);
        require(!active, "inactive");
        require(credit == 0, "no credit");
        require(activeUntil == 30 days + 1, "expired at first period");

        billing.settle(ALICE);
        (,,,, WeatherSubscriptionBilling.Plan plan) = _account(ALICE);
        require(plan == WeatherSubscriptionBilling.Plan.None, "plan cleared");
        require(billing.withdrawableRevenue() == 5 * USDC, "first month earned");
    }

    function testPlanChangeRefundsUnusedOldPlanIntoNewPlan() public {
        vm.prank(ALICE);
        billing.topUpAndSubscribe(WeatherSubscriptionBilling.Plan.Hobby, 25 * USDC);

        vm.prank(ALICE);
        billing.subscribe(WeatherSubscriptionBilling.Plan.Pro);

        (bool active, WeatherSubscriptionBilling.Plan plan, uint256 refundable, uint256 credit,) =
            billing.subscriptionStatus(ALICE);
        require(active, "active");
        require(plan == WeatherSubscriptionBilling.Plan.Pro, "pro");
        require(refundable == 25 * USDC, "all unused");
        require(credit == 5 * USDC, "credit left");
    }

    function _account(address customer)
        private
        view
        returns (
            uint128 credit,
            uint128 unearned,
            uint40 lastSettled,
            uint40 paidThrough,
            WeatherSubscriptionBilling.Plan plan
        )
    {
        (credit, unearned, lastSettled, paidThrough, plan) = billing.accounts(customer);
    }
}

