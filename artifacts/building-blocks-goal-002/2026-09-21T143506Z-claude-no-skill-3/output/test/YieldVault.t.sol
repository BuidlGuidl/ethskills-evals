// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {IStrategy} from "../src/interfaces/IStrategy.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockStrategy} from "./mocks/MockStrategy.sol";

/// Offline unit tests of vault accounting with a mock strategy.
contract YieldVaultTest is Test {
    MockUSDC usdc;
    YieldVault vault;
    MockStrategy strategy;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new YieldVault(IERC20(address(usdc)), address(this), 1_000_000e6);
        strategy = new MockStrategy(address(vault), IERC20(address(usdc)));
        vault.setStrategy(strategy);
        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_DepositForwardsToStrategy() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        assertEq(usdc.balanceOf(address(strategy)), 1_000e6);
        assertEq(vault.totalAssets(), 1_000e6);
        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(alice)), 1_000e6, 1);
    }

    function test_RedeemPullsFromStrategy() public {
        vm.startPrank(alice);
        vault.deposit(1_000e6, alice);
        uint256 got = vault.redeem(vault.balanceOf(alice), alice, alice);
        vm.stopPrank();
        assertApproxEqAbs(got, 1_000e6, 1);
        assertEq(usdc.balanceOf(alice), 1_000_000e6 - 1_000e6 + got);
    }

    function test_ExitCostBorneByWithdrawer() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        vm.prank(bob);
        vault.deposit(1_000e6, bob);

        strategy.setExitCostBps(50); // 0.5%
        vm.startPrank(alice);
        uint256 got = vault.redeem(vault.balanceOf(alice), alice, alice);
        vm.stopPrank();
        assertApproxEqAbs(got, 995e6, 1);
        // Bob's share value untouched.
        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(bob)), 1_000e6, 1);
    }

    function test_RevertWhen_ExitCostAboveMaxLoss() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        strategy.setExitCostBps(200); // 2% > 1% default
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice);
    }

    function test_DepositCap() public {
        vault.setDepositCap(1_500e6);
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        assertEq(vault.maxDeposit(bob), 500e6);
        vm.prank(bob);
        vm.expectRevert();
        vault.deposit(501e6, bob);
    }

    function test_InflationAttackUnprofitable() public {
        // Attacker deposits 1 wei then donates a lot to the strategy.
        vm.prank(bob);
        vault.deposit(1, bob);
        vm.prank(bob);
        usdc.transfer(address(strategy), 10_000e6);

        vm.prank(alice);
        uint256 shares = vault.deposit(10_000e6, alice);
        assertGt(shares, 0);
        // Victim keeps their deposit; attacker's donation is mostly captured by the virtual shares.
        assertGt(vault.convertToAssets(shares), 9_990e6);
        assertLt(vault.convertToAssets(vault.balanceOf(bob)), 5_001e6);
    }

    function test_SetStrategyOnce() public {
        MockStrategy other = new MockStrategy(address(vault), IERC20(address(usdc)));
        vm.expectRevert(YieldVault.StrategyAlreadySet.selector);
        vault.setStrategy(other);
    }

    function test_SetStrategyChecksVault() public {
        YieldVault v2 = new YieldVault(IERC20(address(usdc)), address(this), 1e12);
        vm.expectRevert(YieldVault.StrategyVaultMismatch.selector);
        v2.setStrategy(IStrategy(address(strategy)));
    }

    function test_OnlyOwnerAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setDepositCap(0);
        vm.expectRevert(YieldVault.MaxLossTooHigh.selector);
        vault.setMaxLossBps(1_001);
    }
}
