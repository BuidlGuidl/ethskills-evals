// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AerodromeUsdcWethStrategy } from "../src/AerodromeUsdcWethStrategy.sol";
import { BaseUsdcVault } from "../src/BaseUsdcVault.sol";
import { Test } from "./Test.sol";
import { MockAerodromeGauge } from "./mocks/MockAerodromeGauge.sol";
import { MockAerodromePool } from "./mocks/MockAerodromePool.sol";
import { MockAerodromeRouter } from "./mocks/MockAerodromeRouter.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

contract BaseUsdcVaultTest is Test {
    address internal owner = address(0xA11CE);
    address internal keeper = address(0xB0B);
    address internal user = address(0xCAFE);
    address internal factory = address(0xFACADE);

    MockERC20 internal weth;
    MockERC20 internal usdc;
    MockERC20 internal aero;
    MockAerodromePool internal pool;
    MockAerodromeGauge internal gauge;
    MockAerodromeRouter internal router;
    AerodromeUsdcWethStrategy internal strategy;
    BaseUsdcVault internal vault;

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        aero = new MockERC20("Aerodrome", "AERO", 18);
        pool = new MockAerodromePool(address(weth), address(usdc), false);
        pool.seed(2_000 ether, 4_000_000e6, 2_000 ether);
        gauge = new MockAerodromeGauge(pool, aero);
        router = new MockAerodromeRouter(weth, usdc, aero, pool);

        strategy = new AerodromeUsdcWethStrategy(
            usdc, weth, aero, router, pool, gauge, factory, false, owner
        );
        vault = new BaseUsdcVault(usdc, strategy, owner, "Base USDC Yield Vault", "byvUSDC");

        vm.prank(owner);
        strategy.setVault(address(vault));
        vm.prank(owner);
        vault.setKeeper(keeper, true);

        usdc.mint(user, 10_000e6);
        vm.prank(user);
        usdc.approve(address(vault), type(uint256).max);
    }

    function testDepositPairsUsdcWithWethAndStakesLp() public {
        vm.prank(user);
        uint256 shares = vault.deposit(2_000e6, user, _depositParams(0));

        assertEq(shares, 2_000e6);
        assertEq(vault.balanceOf(user), 2_000e6);
        assertEq(usdc.balanceOf(user), 8_000e6);
        assertGt(gauge.balanceOf(address(strategy)), 0);
        assertGt(vault.totalAssets(), 0);
    }

    function testKeeperHarvestClaimsAeroAndCompounds() public {
        vm.prank(user);
        vault.deposit(2_000e6, user, _depositParams(0));

        uint256 stakedBefore = gauge.balanceOf(address(strategy));
        uint256 assetsBefore = vault.totalAssets();
        gauge.setRewardPerClaim(100e18);

        vm.prank(keeper);
        (uint256 rewardAmount, uint256 liquidityMinted) = vault.harvest(_harvestParams(0, 0));

        assertEq(rewardAmount, 100e18);
        assertGt(liquidityMinted, 0);
        assertGt(gauge.balanceOf(address(strategy)), stakedBefore);
        assertGt(vault.totalAssets(), assetsBefore);
    }

    function testOnlyKeeperOrOwnerCanHarvest() public {
        vm.prank(user);
        vault.deposit(2_000e6, user, _depositParams(0));

        vm.prank(user);
        vm.expectRevert(BaseUsdcVault.NotKeeper.selector);
        vault.harvest(_harvestParams(0, 0));
    }

    function testRedeemReturnsUsdcAfterCompounding() public {
        vm.prank(user);
        vault.deposit(2_000e6, user, _depositParams(0));

        gauge.setRewardPerClaim(100e18);
        vm.prank(keeper);
        vault.harvest(_harvestParams(0, 0));

        uint256 before = usdc.balanceOf(user);
        uint256 shares = vault.balanceOf(user);

        vm.prank(user);
        uint256 assetsOut = vault.redeem(shares, user, user, _withdrawParams(0));

        assertGt(assetsOut, 2_000e6);
        assertGt(usdc.balanceOf(user), before);
        assertEq(vault.balanceOf(user), 0);
    }

    function testDepositRevertsWhenSwapSlippageIsTooTight() public {
        vm.prank(user);
        vm.expectRevert();
        vault.deposit(2_000e6, user, _depositParams(2 ether));
    }

    function _depositParams(uint256 minWethOut)
        internal
        view
        returns (AerodromeUsdcWethStrategy.DepositParams memory)
    {
        return AerodromeUsdcWethStrategy.DepositParams({
            minWethOut: minWethOut,
            minWethToLp: 0,
            minUsdcToLp: 0,
            minLpOut: 0,
            deadline: block.timestamp + 1
        });
    }

    function _harvestParams(uint256 minUsdcFromReward, uint256 minWethOut)
        internal
        view
        returns (AerodromeUsdcWethStrategy.HarvestParams memory)
    {
        return AerodromeUsdcWethStrategy.HarvestParams({
            minUsdcFromReward: minUsdcFromReward,
            minWethOut: minWethOut,
            minWethToLp: 0,
            minUsdcToLp: 0,
            minLpOut: 0,
            deadline: block.timestamp + 1
        });
    }

    function _withdrawParams(uint256 minUsdcFromWeth)
        internal
        view
        returns (AerodromeUsdcWethStrategy.WithdrawParams memory)
    {
        return AerodromeUsdcWethStrategy.WithdrawParams({
            minWethFromLp: 0,
            minUsdcFromLp: 0,
            minUsdcFromWeth: minUsdcFromWeth,
            deadline: block.timestamp + 1
        });
    }
}
