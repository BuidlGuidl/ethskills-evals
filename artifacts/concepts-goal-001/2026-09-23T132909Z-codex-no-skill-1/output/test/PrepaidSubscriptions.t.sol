// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PrepaidSubscriptions} from "../contracts/PrepaidSubscriptions.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address msgSender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
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

contract PrepaidSubscriptionsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    PrepaidSubscriptions private billing;

    address private owner = address(0xA11CE);
    address private customer = address(0xB0B);
    address private treasury = address(0xC0FFEE);

    uint256 private constant USDC = 1_000_000;

    function setUp() external {
        usdc = new MockUSDC();
        billing = new PrepaidSubscriptions(address(usdc), owner);

        usdc.mint(customer, 100 * USDC);
        vm.prank(customer);
        usdc.approve(address(billing), type(uint256).max);
    }

    function testCustomerCanPrepayAndSubscribe() external {
        vm.prank(customer);
        billing.deposit(5 * USDC);

        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Hobby);

        require(billing.isSubscribed(customer), "customer should be active");

        (bool active, PrepaidSubscriptions.Plan plan, uint256 prepaid, uint256 accrued, uint256 available,) =
            billing.accountStatus(customer);

        require(active, "status active");
        require(plan == PrepaidSubscriptions.Plan.Hobby, "hobby plan");
        require(prepaid == 5 * USDC, "prepaid balance");
        require(accrued == 0, "no immediate charge");
        require(available == 5 * USDC, "available balance");
    }

    function testMonthlyChargeAccruesAndCanBeWithdrawn() external {
        vm.prank(customer);
        billing.deposit(10 * USDC);
        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 30 days);

        require(billing.isSubscribed(customer), "still has a second month funded");
        (,,, uint256 accrued, uint256 available,) = billing.accountStatus(customer);
        require(accrued == 5 * USDC, "one month accrued");
        require(available == 5 * USDC, "one month remains");

        billing.settle(customer);
        require(billing.merchantAccrued() == 5 * USDC, "merchant revenue accrued");

        vm.prank(owner);
        billing.withdrawMerchantRevenue(treasury, 5 * USDC);

        require(usdc.balanceOf(treasury) == 5 * USDC, "treasury paid");
        require(billing.merchantAccrued() == 0, "merchant revenue withdrawn");
    }

    function testCancellationRefundsUnusedBalance() external {
        vm.prank(customer);
        billing.deposit(20 * USDC);
        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Pro);

        vm.warp(block.timestamp + 15 days);

        uint256 beforeCancel = usdc.balanceOf(customer);
        vm.prank(customer);
        billing.cancel();

        require(usdc.balanceOf(customer) == beforeCancel + 10 * USDC, "unused half month refunded");
        require(!billing.isSubscribed(customer), "cancelled");
        require(billing.merchantAccrued() == 10 * USDC, "used half month retained");
    }

    function testSubscriptionExpiresWhenPrepaidBalanceRunsOut() external {
        vm.prank(customer);
        billing.deposit(5 * USDC);
        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 30 days);
        require(!billing.isSubscribed(customer), "credit exhausted exactly at one month");

        billing.settle(customer);
        (PrepaidSubscriptions.Plan plan, uint256 balance,) = billing.accountOf(customer);
        require(plan == PrepaidSubscriptions.Plan.None, "plan lapsed");
        require(balance == 0, "balance exhausted");
    }

    function testPlanChangeSettlesOldRateBeforeSwitching() external {
        vm.prank(customer);
        billing.deposit(40 * USDC);
        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 15 days);

        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Pro);

        require(billing.merchantAccrued() == 2_500_000, "half hobby month charged");
        (bool active, PrepaidSubscriptions.Plan plan,, uint256 accrued, uint256 available,) =
            billing.accountStatus(customer);

        require(active, "still active");
        require(plan == PrepaidSubscriptions.Plan.Pro, "pro plan");
        require(accrued == 0, "new plan starts fresh");
        require(available == 37_500_000, "remaining credit carried forward");
    }

    function testSubscribeRequiresEnoughForOneMonth() external {
        vm.prank(customer);
        billing.deposit(4 * USDC);

        vm.expectRevert(
            abi.encodeWithSelector(PrepaidSubscriptions.InsufficientPrepaidBalance.selector, 5 * USDC, 4 * USDC)
        );
        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Hobby);
    }

    function testOnlyOwnerCanWithdrawMerchantRevenue() external {
        vm.prank(customer);
        billing.deposit(10 * USDC);
        vm.prank(customer);
        billing.subscribe(PrepaidSubscriptions.Plan.Hobby);

        vm.warp(block.timestamp + 30 days);
        billing.settle(customer);

        vm.expectRevert(PrepaidSubscriptions.NotOwner.selector);
        vm.prank(customer);
        billing.withdrawMerchantRevenue(treasury, 5 * USDC);
    }
}
