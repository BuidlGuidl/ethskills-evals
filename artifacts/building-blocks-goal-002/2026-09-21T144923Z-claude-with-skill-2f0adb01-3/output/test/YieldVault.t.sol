// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {YieldVault} from "../src/YieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {IAerodromeRouter} from "../src/interfaces/IAerodrome.sol";
import {IStrategy} from "../src/interfaces/IStrategy.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";
import {MockPool, MockRouter, MockGauge} from "./mocks/MockAerodrome.sol";

contract YieldVaultTest is Test {
    MockERC20 usdc;
    MockERC20 weth;
    MockERC20 aero;
    MockPool pool;
    MockRouter router;
    MockGauge gauge;
    MockAggregator ethUsd;
    MockAggregator sequencer;

    YieldVault vault;
    AerodromeUsdcWethStrategy strategy;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");

    uint256 constant ETH_PRICE = 3000e8;

    function setUp() public {
        vm.warp(1_750_000_000);
        usdc = new MockERC20("USDC", 6);
        weth = new MockERC20("WETH", 18);
        aero = new MockERC20("AERO", 18);
        pool = new MockPool(address(weth), address(usdc));
        router = new MockRouter(pool);
        gauge = new MockGauge(IERC20(address(pool)), aero);
        ethUsd = new MockAggregator(8, int256(ETH_PRICE));
        sequencer = new MockAggregator(0, 0);
        sequencer.setStartedAt(block.timestamp - 2 hours);
        router.setRate(address(aero), address(usdc), 0.5e6); // 1 AERO = 0.5 USDC

        // Seed pool at the oracle price, roughly live depth: 1,500 WETH / 4,500,000 USDC
        weth.mint(address(pool), 1500e18);
        usdc.mint(address(pool), 4_500_000e6);
        pool.mint(address(this));

        vault = new YieldVault(IERC20(address(usdc)), owner, keeper, 10_000_000e6);
        strategy = new AerodromeUsdcWethStrategy(
            AerodromeUsdcWethStrategy.Config({
                vault: address(vault),
                usdc: address(usdc),
                weth: address(weth),
                aero: address(aero),
                router: address(router),
                poolFactory: address(0),
                pool: address(pool),
                gauge: address(gauge),
                ethUsdFeed: address(ethUsd),
                sequencerFeed: address(sequencer)
            }),
            owner
        );
        vm.prank(owner);
        vault.setStrategy(IStrategy(address(strategy)));

        for (uint256 i; i < 3; i++) {
            address u = [alice, bob, attacker][i];
            usdc.mint(u, 1_000_000e6);
            vm.prank(u);
            usdc.approve(address(vault), type(uint256).max);
        }
    }

    // ------------------------------------------------------------ helpers

    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
        vm.prank(user);
        shares = vault.deposit(amount, user);
    }

    function _harvest() internal returns (uint256) {
        vm.prank(keeper);
        return vault.harvest(0);
    }

    function _redeemAll(address user) internal returns (uint256) {
        uint256 shares = vault.balanceOf(user);
        vm.prank(user);
        return vault.redeem(shares, user, user);
    }

    /// @dev Swap on the pool to move its spot price (sells `usdcIn` USDC for WETH).
    function _pushPrice(address who, uint256 usdcIn) internal {
        usdc.mint(who, usdcIn);
        vm.startPrank(who);
        usdc.approve(address(router), usdcIn);
        IAerodromeRouter.Route[] memory r = new IAerodromeRouter.Route[](1);
        r[0] = IAerodromeRouter.Route(address(usdc), address(weth), false, address(0));
        router.swapExactTokensForTokens(usdcIn, 0, r, who, block.timestamp);
        vm.stopPrank();
    }

    /// @dev Stand-in for external arbitrageurs: swap the pool back to the oracle price.
    function _arbToOracle() internal {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (uint256 rWeth, uint256 rUsdc) = address(weth) < address(usdc) ? (r0, r1) : (r1, r0);
        // target WETH reserve at price P (USDC per wei = 3000e6/1e18): sqrt(k / P)
        uint256 targetWeth = Math.sqrt(rWeth * rUsdc * 1e18 / 3000e6);
        IAerodromeRouter.Route[] memory r = new IAerodromeRouter.Route[](1);
        vm.startPrank(attacker);
        if (targetWeth > rWeth) {
            uint256 amt = (targetWeth - rWeth) * 1003 / 1000;
            weth.mint(attacker, amt);
            weth.approve(address(router), amt);
            r[0] = IAerodromeRouter.Route(address(weth), address(usdc), false, address(0));
            router.swapExactTokensForTokens(amt, 0, r, attacker, block.timestamp);
        } else if (targetWeth < rWeth) {
            uint256 amt = (Math.sqrt(rWeth * rUsdc * 3000e6 / 1e18) - rUsdc) * 1003 / 1000;
            usdc.mint(attacker, amt);
            usdc.approve(address(router), amt);
            r[0] = IAerodromeRouter.Route(address(usdc), address(weth), false, address(0));
            router.swapExactTokensForTokens(amt, 0, r, attacker, block.timestamp);
        }
        vm.stopPrank();
    }

    function _refreshOracle() internal {
        ethUsd.set(int256(ETH_PRICE), block.timestamp);
    }

    // ------------------------------------------------------------ deposit / invest

    function test_depositStaysIdleUntilHarvest() public {
        uint256 shares = _deposit(alice, 10_000e6);
        assertEq(usdc.balanceOf(address(vault)), 10_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
        assertEq(vault.convertToAssets(shares), 10_000e6);
        assertEq(strategy.stakedLiquidity(), 0);
    }

    function test_harvestInvestsIdleIntoStakedLp() public {
        _deposit(alice, 20_000e6);
        _harvest();

        assertEq(usdc.balanceOf(address(vault)), 0);
        assertGt(strategy.stakedLiquidity(), 0);
        assertEq(pool.balanceOf(address(strategy)), 0);
        // Only entry cost: 0.3% fee on the half that was swapped + price impact
        assertApproxEqRel(vault.totalAssets(), 20_000e6, 0.003e18);
        assertLe(vault.totalAssets(), 20_000e6);
        // dust left behind is small
        assertLt(usdc.balanceOf(address(strategy)), 100e6);
    }

    function test_largeDepositDeployedOverSeveralHarvests() public {
        _deposit(alice, 100_000e6);
        _harvest();
        // Capped at maxInvestPerHarvest (20k); rest waits as loose USDC
        assertApproxEqAbs(usdc.balanceOf(address(strategy)), 80_000e6, 100e6);

        for (uint256 i; i < 4; i++) {
            _arbToOracle();
            _harvest();
        }
        assertLt(usdc.balanceOf(address(strategy)), 500e6);
        assertApproxEqRel(vault.totalAssets(), 100_000e6, 0.003e18);
    }

    function test_harvestWithoutArbRevertsOnOwnPriceImpact() public {
        // Each 20k chunk moves spot ~0.45%; without arbitrage in between, the slippage/deviation guards
        // stop the third push instead of buying WETH far above the oracle price.
        _deposit(alice, 100_000e6);
        _harvest();
        _harvest();
        vm.prank(keeper);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vault.harvest(0);
    }

    function test_harvestCompoundsRewardsWithLinearUnlock() public {
        _deposit(alice, 20_000e6);
        _harvest();
        uint256 before = vault.totalAssets();

        gauge.accrue(address(strategy), 2_000e18); // 2,000 AERO = 1,000 USDC
        vm.prank(keeper);
        uint256 profit = vault.harvest(999e6);
        assertEq(profit, 1_000e6);

        // Nothing visible yet — profit is locked
        assertApproxEqAbs(vault.totalAssets(), before, 10e6);

        vm.warp(block.timestamp + 3 hours);
        _refreshOracle();
        assertApproxEqAbs(vault.totalAssets(), before + 500e6, 10e6);

        vm.warp(block.timestamp + 3 hours);
        _refreshOracle();
        assertApproxEqAbs(vault.totalAssets(), before + 1_000e6, 10e6);
    }

    function test_harvestRewardSwapRespectsKeeperMin() public {
        _deposit(alice, 10_000e6);
        gauge.accrue(address(strategy), 2_000e18);
        vm.prank(keeper);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vault.harvest(1_001e6);
    }

    function test_onlyKeeperOrOwnerCanHarvest() public {
        vm.prank(alice);
        vm.expectRevert(YieldVault.OnlyKeeper.selector);
        vault.harvest(0);

        vm.prank(owner);
        vault.harvest(0);
    }

    function test_strategyOnlyCallableByVault() public {
        vm.startPrank(attacker);
        vm.expectRevert(AerodromeUsdcWethStrategy.OnlyVault.selector);
        strategy.harvest(0);
        vm.expectRevert(AerodromeUsdcWethStrategy.OnlyVault.selector);
        strategy.withdraw(1, 1);
        vm.expectRevert(AerodromeUsdcWethStrategy.OnlyVault.selector);
        strategy.exitAll(0);
        vm.stopPrank();
    }

    function test_setStrategyIsOneTime() public {
        vm.prank(owner);
        vm.expectRevert(YieldVault.BadStrategy.selector);
        vault.setStrategy(IStrategy(address(strategy)));
    }

    function test_depositCap() public {
        vm.prank(owner);
        vault.setDepositCap(50_000e6);
        _deposit(alice, 40_000e6);
        assertEq(vault.maxDeposit(bob), 10_000e6);
        vm.prank(bob);
        vm.expectRevert();
        vault.deposit(10_001e6, bob);
    }

    // ------------------------------------------------------------ withdrawals

    function test_redeemPaysAtLeastPreview() public {
        _deposit(alice, 100_000e6);
        _deposit(bob, 50_000e6);
        _harvest();

        uint256 shares = vault.balanceOf(alice);
        uint256 preview = vault.previewRedeem(shares);
        uint256 out = _redeemAll(alice);

        assertGe(out, preview);
        assertEq(usdc.balanceOf(alice), 1_000_000e6 - 100_000e6 + out);
        // Round trip costs ~0.3% (entry swap, exit swap)
        assertApproxEqRel(out, 100_000e6, 0.005e18);
        // Bob's position is not diluted by Alice's exit cost
        assertApproxEqRel(vault.convertToAssets(vault.balanceOf(bob)), 50_000e6, 0.003e18);
    }

    function test_withdrawExactAssets() public {
        _deposit(alice, 100_000e6);
        _harvest();

        uint256 balBefore = usdc.balanceOf(alice);
        uint256 sharesBefore = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 burned = vault.withdraw(20_000e6, alice, alice);

        assertEq(usdc.balanceOf(alice) - balBefore, 20_000e6);
        assertEq(vault.balanceOf(alice), sharesBefore - burned);
    }

    function test_withdrawViaAllowance() public {
        _deposit(alice, 10_000e6);
        uint256 shares = vault.balanceOf(alice);

        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(shares, bob, alice);

        vm.prank(alice);
        vault.approve(bob, shares);
        vm.prank(bob);
        vault.redeem(shares, bob, alice);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_lastUserExitsFully() public {
        _deposit(alice, 100_000e6);
        _harvest();
        _redeemAll(alice);
        assertEq(vault.totalSupply(), 0);
        assertEq(strategy.stakedLiquidity(), 0);
        assertLt(strategy.totalAssets(), 1e6);
    }

    // ------------------------------------------------------------ attacks

    function test_justInTimeDepositCannotStealHarvest() public {
        _deposit(alice, 500_000e6);
        _harvest();

        // Large reward accrued; attacker deposits right before harvest and exits right after.
        gauge.accrue(address(strategy), 20_000e18); // 10,000 USDC
        uint256 start = usdc.balanceOf(attacker);
        _deposit(attacker, 500_000e6);
        _harvest();
        _redeemAll(attacker);

        assertLe(usdc.balanceOf(attacker), start, "attacker profited");
    }

    function test_poolManipulationDoesNotMoveSharePrice() public {
        _deposit(alice, 100_000e6);
        _harvest();
        uint256 before = vault.totalAssets();

        // Dump 1.5M USDC into the pool: spot WETH price roughly doubles
        _pushPrice(attacker, 1_500_000e6);
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (uint256 rWeth, uint256 rUsdc) = address(weth) < address(usdc) ? (r0, r1) : (r1, r0);
        assertGt(rUsdc * 1e18 / rWeth, 5_000e6, "spot moved");

        // Fair LP pricing: only k grew by the swap fee, so value barely moves
        assertApproxEqRel(vault.totalAssets(), before, 0.01e18);
    }

    function test_harvestRevertsWhenPoolSpotIsManipulated() public {
        _deposit(alice, 100_000e6);
        _pushPrice(attacker, 100_000e6); // ~6.7% move
        vm.prank(keeper);
        vm.expectRevert(AerodromeUsdcWethStrategy.PriceDeviation.selector);
        vault.harvest(0);
    }

    function test_redeemRevertsIfUnwindIsSandwiched() public {
        _deposit(alice, 100_000e6);
        _harvest();
        _pushPrice(attacker, 1_000_000e6); // WETH now much more expensive in the pool than oracle
        // Selling WETH into the manipulated pool would actually be *better*; push the other way instead.
        weth.mint(attacker, 2_000e18);
        vm.startPrank(attacker);
        weth.approve(address(router), type(uint256).max);
        IAerodromeRouter.Route[] memory r = new IAerodromeRouter.Route[](1);
        r[0] = IAerodromeRouter.Route(address(weth), address(usdc), false, address(0));
        router.swapExactTokensForTokens(2_000e18, 0, r, attacker, block.timestamp);
        vm.stopPrank();

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vault.redeem(shares, alice, alice);
    }

    function test_inflationAttackUnprofitable() public {
        // Attacker front-runs the first deposit with 1 wei + a large donation.
        _deposit(attacker, 1);
        vm.prank(attacker);
        usdc.transfer(address(vault), 100_000e6);

        _deposit(alice, 100_000e6);
        assertGt(vault.balanceOf(alice), 0);
        assertApproxEqRel(vault.convertToAssets(vault.balanceOf(alice)), 100_000e6, 0.0001e18);
    }

    // ------------------------------------------------------------ oracle safety

    function test_staleOracleBlocksPricing() public {
        _deposit(alice, 10_000e6);
        _harvest();
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(AerodromeUsdcWethStrategy.StaleOracle.selector);
        vault.totalAssets();
    }

    function test_sequencerDownBlocksPricing() public {
        _deposit(alice, 10_000e6);
        _harvest();
        sequencer.set(1, block.timestamp); // 1 = down
        vm.expectRevert(AerodromeUsdcWethStrategy.SequencerDown.selector);
        vault.totalAssets();

        // Back up, but still inside the grace period
        sequencer.set(0, block.timestamp);
        sequencer.setStartedAt(block.timestamp - 10 minutes);
        vm.expectRevert(AerodromeUsdcWethStrategy.SequencerDown.selector);
        vault.totalAssets();
    }

    function test_shutdownUnwindsAndWithdrawalsWorkWithoutOracle() public {
        _deposit(alice, 100_000e6);
        _harvest();

        vm.prank(owner);
        vault.shutdown(99_000e6);
        assertEq(strategy.stakedLiquidity(), 0);
        assertEq(vault.maxDeposit(alice), 0);

        // Oracle dies after shutdown — withdrawals still work.
        vm.warp(block.timestamp + 1 days);
        uint256 out = _redeemAll(alice);
        assertApproxEqRel(out, 100_000e6, 0.005e18);

        vm.prank(keeper);
        vm.expectRevert(YieldVault.IsShutdown.selector);
        vault.harvest(0);
    }

    function test_adminParamBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(YieldVault.BadParam.selector);
        vault.setWithdrawSlippageBps(501);
        vm.expectRevert(YieldVault.BadParam.selector);
        vault.setProfitUnlockTime(0);
        vm.expectRevert(AerodromeUsdcWethStrategy.BadParam.selector);
        strategy.setParams(501, 100, 1 hours, 1 hours);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setKeeper(alice);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_roundTripNeverProfits(uint256 seed, uint256 amount) public {
        amount = bound(amount, 1e6, 500_000e6);
        _deposit(alice, bound(seed, 1e6, 500_000e6));
        _harvest();
        _arbToOracle(); // on mainnet, arbitrage re-aligns the pool with the oracle within blocks

        uint256 start = usdc.balanceOf(bob);
        _deposit(bob, amount);
        if (seed % 2 == 0) {
            // exit either from idle or from LP
            _harvest();
            _arbToOracle();
        }
        _redeemAll(bob);
        assertLe(usdc.balanceOf(bob), start);
    }
}
