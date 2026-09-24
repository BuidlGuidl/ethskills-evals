// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {YieldVault} from "../src/YieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {IAeroRouter, IAeroGauge, IAeroVoter, IAeroPool} from "../src/interfaces/IAerodrome.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AggregatorV3Interface} from "../src/interfaces/IChainlink.sol";
import {BaseAddresses as A} from "../src/BaseAddresses.sol";
import {Deploy} from "../script/Deploy.s.sol";

/// Fork tests against live Base contracts at a pinned block.
/// Set BASE_RPC_URL to an archive-capable Base RPC (defaults to the public endpoint).
contract YieldVaultForkTest is Test {
    uint256 constant FORK_BLOCK = 51_600_000; // 2026-09-21

    YieldVault vault;
    AerodromeUsdcWethStrategy strategy;
    IERC20 usdc = IERC20(A.USDC);
    IERC20 weth = IERC20(A.WETH);
    IAeroGauge gauge = IAeroGauge(A.VAMM_WETH_USDC_GAUGE);

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org")), FORK_BLOCK);
        vault = new YieldVault(usdc, owner, keeper, 1_000_000e6);
        strategy = new AerodromeUsdcWethStrategy(new Deploy().config(address(vault)), owner);
        vm.prank(owner);
        vault.setStrategy(strategy);
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    function _deposit(address who, uint256 amount) internal returns (uint256 shares) {
        deal(A.USDC, who, amount);
        vm.startPrank(who);
        usdc.approve(address(vault), amount);
        shares = vault.deposit(amount, who);
        vm.stopPrank();
    }

    function _harvest() internal returns (uint256) {
        vm.prank(keeper);
        return vault.harvest();
    }

    /// Chainlink rounds stop at the fork block; re-serve the latest answer as fresh after a warp.
    function _refreshOracles() internal {
        address[3] memory feeds = [A.CL_ETH_USD, A.CL_USDC_USD, A.CL_AERO_USD];
        for (uint256 i; i < feeds.length; i++) {
            (uint80 id, int256 answer,,,) = AggregatorV3Interface(feeds[i]).latestRoundData();
            vm.mockCall(
                feeds[i],
                abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
                abi.encode(id, answer, block.timestamp, block.timestamp, id)
            );
        }
    }

    function _skip(uint256 secs) internal {
        skip(secs);
        vm.roll(block.number + secs / 2);
        _refreshOracles();
        _arbToOracle();
    }

    /// A fork has no arbitrageurs; move the pool back to the Chainlink price like live Base would.
    function _arbToOracle() internal {
        (uint256 r0, uint256 r1,) = IAeroPool(A.VAMM_WETH_USDC).getReserves(); // token0 = WETH
        (, int256 eth,,,) = AggregatorV3Interface(A.CL_ETH_USD).latestRoundData();
        (, int256 usd,,,) = AggregatorV3Interface(A.CL_USDC_USD).latestRoundData();
        // target WETH reserve: sqrt(k / p), p = USDC units per wei
        uint256 targetWeth = Math.sqrt(Math.mulDiv(r0 * r1, uint256(usd) * 1e12, uint256(eth)));
        address arb = makeAddr("arb");
        if (targetWeth > r0) _swap(A.WETH, A.USDC, (targetWeth - r0) * 10_015 / 10_000, arb);
        else if (targetWeth < r0) _swap(A.USDC, A.WETH, (r1 - Math.mulDiv(r0 * r1, 1, targetWeth)) * 10_015 / 10_000, arb);
    }

    function _swap(address from, address to, uint256 amountIn, address who) internal {
        deal(from, who, amountIn);
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
        r[0] = IAeroRouter.Route({from: from, to: to, stable: false, factory: A.AERO_POOL_FACTORY});
        vm.startPrank(who);
        IERC20(from).approve(A.AERO_ROUTER, amountIn);
        IAeroRouter(A.AERO_ROUTER).swapExactTokensForTokens(amountIn, 0, r, who, block.timestamp);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // live-state sanity: the assumptions the strategy is built on
    // ------------------------------------------------------------------

    function test_liveIntegrationAssumptions() public view {
        assertTrue(IAeroVoter(A.AERO_VOTER).isAlive(A.VAMM_WETH_USDC_GAUGE), "gauge alive");
        assertEq(gauge.stakingToken(), A.VAMM_WETH_USDC);
        assertEq(gauge.rewardToken(), A.AERO);
        assertEq(AggregatorV3Interface(A.CL_ETH_USD).decimals(), 8);
        assertEq(AggregatorV3Interface(A.CL_USDC_USD).decimals(), 8);
        assertEq(AggregatorV3Interface(A.CL_AERO_USD).decimals(), 8);
        assertGt(usdc.balanceOf(A.VAMM_WETH_USDC), 1_000_000e6, "pool depth");
        assertGt(usdc.balanceOf(A.VAMM_USDC_AERO), 1_000_000e6, "reward route depth");
    }

    // ------------------------------------------------------------------
    // happy path
    // ------------------------------------------------------------------

    function test_depositIdleUntilHarvest_thenInvestedAndStaked() public {
        _deposit(alice, 10_000e6);
        assertEq(usdc.balanceOf(address(vault)), 10_000e6);
        assertEq(strategy.lpBalance(), 0);

        _harvest();

        assertEq(usdc.balanceOf(address(vault)), 0);
        assertGt(gauge.balanceOf(address(strategy)), 0, "LP staked");
        assertEq(IERC20(A.VAMM_WETH_USDC).balanceOf(address(strategy)), 0, "no loose LP");
        // zap costs ~half the pool fee; dust left over is still counted
        assertApproxEqRel(vault.totalAssets(), 10_000e6, 0.003e18);
        assertLt(usdc.balanceOf(address(strategy)), 20e6, "little USDC dust");
    }

    function test_largeDepositInvestedInChunks() public {
        _deposit(alice, 300_000e6);
        _harvest();
        uint256 idle = usdc.balanceOf(address(strategy));
        assertGt(idle, 200_000e6, "cap: only ~1% of pool USDC reserve zapped per call");

        for (uint256 i; i < 10 && usdc.balanceOf(address(strategy)) >= strategy.minInvest(); i++) {
            _skip(1 hours);
            _harvest();
        }
        assertLt(usdc.balanceOf(address(strategy)), strategy.minInvest() + 100e6);
        assertApproxEqRel(vault.totalAssets(), 300_000e6, 0.01e18);
    }

    function test_harvestClaimsAndCompoundsAero() public {
        _deposit(alice, 100_000e6);
        _harvest();
        uint256 lpBefore = strategy.lpBalance();

        _skip(1 days);
        uint256 pending = strategy.pendingRewards();
        assertGt(pending, 0, "AERO accrued");

        uint256 profit = _harvest();
        assertGt(profit, 0, "rewards sold");
        assertEq(IERC20(A.AERO).balanceOf(address(strategy)), 0, "no AERO left");
        assertGt(strategy.lpBalance(), lpBefore, "compounded into LP");
        assertEq(vault.lockedProfit(), profit, "profit locked");

        uint256 priceLocked = vault.convertToAssets(1e12);
        _skip(1 days);
        assertEq(vault.lockedProfit(), 0);
        assertGt(vault.convertToAssets(1e12), priceLocked, "share price up once unlocked");
    }

    function test_redeemAfterInvest_returnsFundsMinusExitCost() public {
        uint256 shares = _deposit(alice, 50_000e6);
        _harvest();

        vm.prank(alice);
        uint256 got = vault.redeem(shares, alice, alice);

        assertEq(usdc.balanceOf(alice), got);
        assertEq(vault.balanceOf(alice), 0);
        assertApproxEqRel(got, 50_000e6, 0.01e18, "within 1% round trip");
    }

    function test_redeemExitCostNotSocialized() public {
        uint256 aShares = _deposit(alice, 50_000e6);
        _deposit(bob, 50_000e6);
        _harvest();
        uint256 bobValueBefore = vault.convertToAssets(vault.balanceOf(bob));

        vm.prank(alice);
        vault.redeem(aShares, alice, alice);

        // Bob's claim must not drop because Alice exited (tiny tolerance for pool fee accrual/rounding).
        assertGe(vault.convertToAssets(vault.balanceOf(bob)) * 10_001 / 10_000, bobValueBefore);
    }

    function test_withdrawFromIdle_exact() public {
        _deposit(alice, 1_000e6);
        vm.prank(alice);
        vault.withdraw(400e6, alice, alice);
        assertEq(usdc.balanceOf(alice), 400e6);
    }

    function test_withdrawExact_revertsOnShortfall() public {
        _deposit(alice, 10_000e6);
        _harvest();
        uint256 max = vault.maxWithdraw(alice);
        vm.prank(alice);
        vm.expectRevert(); // exit swap fee makes the full amount undeliverable
        vault.withdraw(max, alice, alice);
    }

    function test_jitDepositBeforeHarvest_getsNoInstantProfit() public {
        _deposit(alice, 100_000e6);
        _harvest();
        _skip(1 days);

        uint256 bobShares = _deposit(bob, 100_000e6);
        uint256 bobBefore = vault.convertToAssets(bobShares);
        _harvest();
        assertLe(vault.convertToAssets(bobShares), bobBefore, "no jump in share price at harvest");
    }

    // ------------------------------------------------------------------
    // failure behaviour
    // ------------------------------------------------------------------

    function test_investRevertsWhenPoolPriceManipulated() public {
        _deposit(alice, 10_000e6);
        _swap(A.WETH, A.USDC, 60 ether, makeAddr("attacker")); // ~3.5% of reserves
        vm.prank(keeper);
        vm.expectPartialRevert(AerodromeUsdcWethStrategy.PoolPriceDeviation.selector);
        vault.harvest();
    }

    function test_lpValuationResistsManipulation() public {
        _deposit(alice, 50_000e6);
        _harvest();
        uint256 before = vault.totalAssets();
        _swap(A.USDC, A.WETH, 500_000e6, makeAddr("attacker"));
        // spot moved >10%, fair-value pricing barely changes (k grows slightly from fees)
        assertApproxEqRel(vault.totalAssets(), before, 0.001e18);
    }

    function test_staleOracleBlocksHarvest() public {
        _deposit(alice, 10_000e6);
        skip(2 hours); // ETH/USD older than ethMaxAge
        vm.prank(keeper);
        vm.expectPartialRevert(AerodromeUsdcWethStrategy.StaleOracle.selector);
        vault.harvest();
    }

    function test_sequencerDownBlocksPricing() public {
        _deposit(alice, 10_000e6);
        vm.mockCall(
            A.CL_SEQUENCER_UPTIME,
            abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
            abi.encode(uint80(1), int256(1), block.timestamp, block.timestamp, uint80(1))
        );
        vm.prank(keeper);
        vm.expectRevert(AerodromeUsdcWethStrategy.SequencerDown.selector);
        vault.harvest();
    }

    function test_killedGauge_keepsLpUnstaked() public {
        vm.mockCall(A.AERO_VOTER, abi.encodeWithSelector(IAeroVoter.isAlive.selector), abi.encode(false));
        _deposit(alice, 10_000e6);
        _harvest();
        assertEq(gauge.balanceOf(address(strategy)), 0);
        assertGt(IERC20(A.VAMM_WETH_USDC).balanceOf(address(strategy)), 0);
    }

    function test_emergencyExit_thenUsersRedeem() public {
        uint256 shares = _deposit(alice, 20_000e6);
        _harvest();

        vm.prank(owner);
        vault.pause();
        vm.prank(owner);
        strategy.emergencyExit(0, 0);
        assertEq(strategy.lpBalance(), 0);

        _harvest(); // keeper still works while paused: no invest
        vm.prank(alice);
        uint256 got = vault.redeem(shares, alice, alice);
        assertApproxEqRel(got, 20_000e6, 0.01e18);
    }

    // ------------------------------------------------------------------
    // access control & limits
    // ------------------------------------------------------------------

    function test_onlyKeeperHarvests() public {
        vm.expectRevert(YieldVault.NotKeeper.selector);
        vault.harvest();
    }

    function test_strategyOnlyCallableByVault() public {
        vm.expectRevert(AerodromeUsdcWethStrategy.NotVault.selector);
        strategy.invest();
        vm.expectRevert(AerodromeUsdcWethStrategy.NotVault.selector);
        strategy.withdraw(1);
        vm.expectRevert(AerodromeUsdcWethStrategy.NotVault.selector);
        strategy.harvest();
    }

    function test_strategyCannotBeReplaced() public {
        vm.prank(owner);
        vm.expectRevert(YieldVault.StrategyAlreadySet.selector);
        vault.setStrategy(strategy);
    }

    function test_depositCapAndPause() public {
        vm.prank(owner);
        vault.setDepositCap(1_000e6);
        deal(A.USDC, alice, 2_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.expectRevert();
        vault.deposit(1_001e6, alice);
        vault.deposit(1_000e6, alice);
        vm.stopPrank();

        vm.prank(owner);
        vault.pause();
        assertEq(vault.maxDeposit(alice), 0);
        vm.prank(alice); // withdrawals still open when paused
        vault.withdraw(100e6, alice, alice);
    }

    function test_setParamsBounded() public {
        vm.prank(owner);
        vm.expectRevert(AerodromeUsdcWethStrategy.BadParam.selector);
        strategy.setParams(501, 100, 0);
        vm.expectRevert();
        strategy.setParams(100, 100, 0); // not owner
    }

    function test_inflationAttackUnprofitable() public {
        address attacker = makeAddr("attacker");
        _deposit(attacker, 1);
        deal(A.USDC, attacker, 10_000e6);
        vm.prank(attacker);
        usdc.transfer(address(vault), 10_000e6); // donation
        uint256 aliceShares = _deposit(alice, 10_000e6);
        assertGt(aliceShares, 0);
        assertApproxEqRel(vault.convertToAssets(aliceShares), 10_000e6, 0.001e18);
    }
}
