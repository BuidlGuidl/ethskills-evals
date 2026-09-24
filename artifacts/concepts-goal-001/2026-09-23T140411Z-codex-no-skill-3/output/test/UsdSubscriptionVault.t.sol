// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20, UsdSubscriptionVault} from "../src/UsdSubscriptionVault.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function warp(uint256 newTimestamp) external;
}

contract UsdSubscriptionVaultTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant USDC = 1_000_000;
    address private constant OWNER = address(0xA11CE);
    address private constant TREASURY = address(0xB0B);
    address private constant ALICE = address(0xCAFE);

    MockUSDC private token;
    UsdSubscriptionVault private vault;

    function setUp() public {
        token = new MockUSDC();
        vault = new UsdSubscriptionVault(IERC20(address(token)), OWNER, TREASURY);
        token.mint(ALICE, 100 * USDC);

        vm.prank(ALICE);
        token.approve(address(vault), type(uint256).max);
    }

    function testHobbySubscriptionStaysActiveAcrossLazyRenewal() public {
        vm.startPrank(ALICE);
        vault.deposit(15 * USDC);
        vault.selectPlan(vault.PLAN_HOBBY());
        vm.stopPrank();

        assertTrue(vault.isSubscribed(ALICE), "subscribed after first charge");

        vm.warp(block.timestamp + 31 days);
        assertTrue(vault.isSubscribed(ALICE), "credit should cover lazy second month");

        vault.settle(ALICE);
        (uint128 balance, uint128 unearned,,,,,, bool active) = vault.accounts(ALICE);

        assertTrue(active, "account stays active");
        assertEq(uint256(balance), 5 * USDC, "one more month of credit left");
        assertTrue(unearned < 5 * USDC && unearned > 4 * USDC, "second month accrues pro rata");
    }

    function testCancelRefundsUnusedCurrentPeriod() public {
        vm.startPrank(ALICE);
        vault.deposit(5 * USDC);
        vault.selectPlan(vault.PLAN_HOBBY());
        vm.stopPrank();

        vm.warp(block.timestamp + 15 days);

        vm.prank(ALICE);
        uint256 refunded = vault.cancel();

        assertEq(refunded, 2_500_000, "half of month refunded");
        assertEq(token.balanceOf(ALICE), 97_500_000, "alice only paid earned half");
        assertEq(vault.accruedRevenue(), 2_500_000, "half of month became earned revenue");
        assertFalse(vault.isSubscribed(ALICE), "canceled account is not subscribed");
    }

    function testSubscriptionLapsesWhenCreditRunsOut() public {
        vm.startPrank(ALICE);
        vault.deposit(5 * USDC);
        vault.selectPlan(vault.PLAN_HOBBY());
        vm.stopPrank();

        vm.warp(block.timestamp + 31 days);

        assertFalse(vault.isSubscribed(ALICE), "no credit for month two");
        vault.settle(ALICE);

        (,,,,,,, bool active) = vault.accounts(ALICE);
        assertFalse(active, "settle marks the subscription lapsed");
        assertEq(vault.accruedRevenue(), 5 * USDC, "first month fully earned");
    }

    function testProPlanCostsTwentyDollars() public {
        vm.startPrank(ALICE);
        vault.deposit(20 * USDC);
        vault.selectPlan(vault.PLAN_PRO());
        vm.stopPrank();

        (uint128 balance, uint128 unearned,,,,,, bool active) = vault.accounts(ALICE);
        assertTrue(active, "pro is active");
        assertEq(uint256(balance), 0, "all credit reserved for pro month");
        assertEq(uint256(unearned), 20 * USDC, "pro month costs twenty");
    }

    function testOwnerCanWithdrawOnlyEarnedRevenue() public {
        vm.startPrank(ALICE);
        vault.deposit(5 * USDC);
        vault.selectPlan(vault.PLAN_HOBBY());
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        vault.settle(ALICE);

        vm.prank(OWNER);
        vault.withdrawAllRevenue();

        assertEq(token.balanceOf(TREASURY), 5 * USDC, "treasury received earned revenue");
        assertEq(vault.accruedRevenue(), 0, "revenue bucket emptied");
    }

    function assertTrue(bool value, string memory reason) internal pure {
        require(value, reason);
    }

    function assertFalse(bool value, string memory reason) internal pure {
        require(!value, reason);
    }

    function assertEq(uint256 actual, uint256 expected, string memory reason) internal pure {
        require(actual == expected, reason);
    }
}
