// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {IYieldStrategy, YieldVault} from "../src/YieldVault.sol";
import {IAerodromeGauge, IAerodromePair} from "../src/interfaces/IAerodrome.sol";
import {TestBase} from "./TestBase.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockGauge} from "./mocks/MockGauge.sol";
import {MockPair} from "./mocks/MockPair.sol";
import {MockRouter} from "./mocks/MockRouter.sol";

contract YieldVaultTest is TestBase {
    address internal owner = address(0xA11CE);
    address internal keeper = address(0xB0B);
    address internal user = address(0xCAFE);
    address internal other = address(0xD00D);

    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockERC20 internal aero;
    MockPair internal pair;
    MockGauge internal gauge;
    MockRouter internal router;
    YieldVault internal vault;
    AerodromeUsdcWethStrategy internal strategy;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aero = new MockERC20("Aerodrome", "AERO", 18);
        pair = new MockPair(address(usdc), address(weth));
        router = new MockRouter(usdc, weth, aero, pair);
        gauge = new MockGauge(pair, aero);

        vault = new YieldVault(usdc, "Base USDC-WETH Yield Vault", "byvUSDC", owner);
        strategy = new AerodromeUsdcWethStrategy(
            address(vault),
            usdc,
            weth,
            aero,
            router,
            IAerodromeGauge(address(gauge)),
            IAerodromePair(address(pair)),
            false,
            false,
            owner,
            keeper
        );

        vm.prank(owner);
        vault.setStrategy(IYieldStrategy(address(strategy)));

        usdc.mint(user, 10_000e6);
        vm.prank(user);
        usdc.approve(address(vault), type(uint256).max);
    }

    function testDepositDeploysIntoAerodromeGauge() public {
        vm.prank(user);
        uint256 shares = vault.deposit(1_000e6, user);

        assertEq(shares, 1_000e6, "initial shares");
        assertEq(vault.balanceOf(user), 1_000e6, "share balance");
        assertEq(usdc.balanceOf(address(vault)), 0, "vault idle");
        assertGt(gauge.balanceOf(address(strategy)), 0, "staked lp");
        assertApproxEqAbs(vault.totalAssets(), 1_000e6, 1, "assets tracked");
    }

    function testKeeperHarvestClaimsAndCompoundsRewards() public {
        vm.prank(user);
        vault.deposit(1_000e6, user);

        uint256 beforeAssets = vault.totalAssets();
        uint256 beforeStake = gauge.balanceOf(address(strategy));
        gauge.setPendingReward(address(strategy), 100e18);

        vm.prank(keeper);
        strategy.harvest();

        assertEq(aero.balanceOf(address(strategy)), 0, "reward sold");
        assertGt(vault.totalAssets(), beforeAssets, "assets increased");
        assertGt(gauge.balanceOf(address(strategy)), beforeStake, "lp compounded");
    }

    function testWithdrawUnwindsLiquidityAndReturnsUsdc() public {
        vm.prank(user);
        vault.deposit(1_000e6, user);

        uint256 userBefore = usdc.balanceOf(user);
        vm.prank(user);
        uint256 sharesBurned = vault.withdraw(250e6, user, user);

        assertGt(sharesBurned, 0, "burned shares");
        assertEq(usdc.balanceOf(user), userBefore + 250e6, "withdrawal received");
        assertApproxEqAbs(vault.totalAssets(), 750e6, 2, "remaining assets");
    }

    function testHarvestAccessControl() public {
        vm.prank(user);
        vault.deposit(1_000e6, user);
        gauge.setPendingReward(address(strategy), 1e18);

        vm.prank(other);
        vm.expectRevert(AerodromeUsdcWethStrategy.Unauthorized.selector);
        strategy.harvest();

        vm.prank(owner);
        strategy.harvest();
    }

    function testSharePriceRisesAfterHarvest() public {
        vm.prank(user);
        vault.deposit(1_000e6, user);
        gauge.setPendingReward(address(strategy), 100e18);

        vm.prank(keeper);
        strategy.harvest();

        usdc.mint(other, 1_000e6);
        vm.startPrank(other);
        usdc.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(100e6, other);
        vm.stopPrank();

        assertGt(100e6, shares, "new depositor receives fewer shares after yield");
    }
}
