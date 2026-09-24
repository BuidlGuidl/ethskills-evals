// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {IAeroRouter} from "../src/interfaces/IAerodrome.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";
import {MockPool, MockRouter, MockGauge} from "./mocks/MockAerodrome.sol";

contract AeroUsdcWethVaultTest is Test {
    MockERC20 usdc;
    MockERC20 weth;
    MockERC20 aero;
    MockPool pool;
    MockPool aeroPool;
    MockRouter router;
    MockGauge gauge;
    MockAggregator ethUsd;
    MockAggregator usdcUsd;
    MockAggregator sequencer;
    AeroUsdcWethVault vault;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");
    address factory = makeAddr("factory");

    uint256 constant ETH_PRICE = 3000;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aero = new MockERC20("Aerodrome", "AERO", 18);

        router = new MockRouter(factory);
        pool = new MockPool(address(usdc), address(weth));
        aeroPool = new MockPool(address(aero), address(usdc));
        router.register(address(pool));
        router.register(address(aeroPool));
        gauge = new MockGauge(address(pool), address(aero));

        // Seed pools: $30M WETH/USDC at 3000, $2M AERO/USDC at $1.
        _seed(pool, usdc, weth, 15_000_000e6, 5_000e18);
        _seed(aeroPool, usdc, aero, 1_000_000e6, 1_000_000e18);

        ethUsd = new MockAggregator(8, int256(ETH_PRICE * 1e8));
        usdcUsd = new MockAggregator(8, 1e8);
        sequencer = new MockAggregator(0, 0);
        sequencer.setRound(0, block.timestamp - 2 hours, block.timestamp - 2 hours);

        vault = new AeroUsdcWethVault(
            AeroUsdcWethVault.Config({
                usdc: address(usdc),
                weth: address(weth),
                aero: address(aero),
                router: address(router),
                pool: address(pool),
                gauge: address(gauge),
                ethUsdFeed: address(ethUsd),
                usdcUsdFeed: address(usdcUsd),
                sequencerFeed: address(sequencer),
                ethUsdHeartbeat: 1200,
                usdcUsdHeartbeat: 86400,
                owner: owner,
                keeper: keeper,
                depositCap: 1_000_000e6
            })
        );
    }

    // ------------------------------------------------------------------ helpers

    function _seed(MockPool p, MockERC20 a, MockERC20 b, uint256 amtA, uint256 amtB) internal {
        a.mint(address(p), amtA);
        b.mint(address(p), amtB);
        p.mint(address(this));
    }

    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
        usdc.mint(user, amount);
        vm.startPrank(user);
        usdc.approve(address(vault), amount);
        shares = vault.deposit(amount, user);
        vm.stopPrank();
    }

    function _harvest() internal {
        vm.prank(keeper);
        vault.harvest(0, type(uint256).max);
    }

    function _pumpWeth(uint256 usdcIn) internal {
        usdc.mint(attacker, usdcIn);
        vm.startPrank(attacker);
        usdc.approve(address(router), usdcIn);
        MockRouter.Route[] memory r = new MockRouter.Route[](1);
        r[0] = MockRouter.Route(address(usdc), address(weth), false, factory);
        router.swapExactTokensForTokens(usdcIn, 0, r, attacker, block.timestamp);
        vm.stopPrank();
    }

    /// @dev Plays the arbitrageur: sells WETH until pool spot is back at the oracle price.
    function _arbBackToOracle() internal {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (uint256 rU, uint256 rW) = pool.token0() == address(usdc) ? (r0, r1) : (r1, r0);
        uint256 targetW = Math.sqrt(rU * rW * 1e30 / (ETH_PRICE * 1e18));
        if (targetW <= rW) return;
        uint256 wethIn = (targetW - rW) * 10_000 / 9_970;
        weth.mint(attacker, wethIn);
        vm.startPrank(attacker);
        weth.approve(address(router), wethIn);
        MockRouter.Route[] memory r = new MockRouter.Route[](1);
        r[0] = MockRouter.Route(address(weth), address(usdc), false, factory);
        router.swapExactTokensForTokens(wethIn, 0, r, attacker, block.timestamp);
        vm.stopPrank();
    }

    function _spotPrice() internal view returns (uint256) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (uint256 rU, uint256 rW) = pool.token0() == address(usdc) ? (r0, r1) : (r1, r0);
        return rU * 1e30 / rW;
    }

    // ------------------------------------------------------------------ deposit / invest

    function test_depositMintsSharesAndStaysIdle() public {
        uint256 shares = _deposit(alice, 10_000e6);
        assertEq(shares, 10_000e6 * 1e12);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), 10_000e6);
        assertEq(vault.lpBalance(), 0);
    }

    function test_harvestInvestsIdleIntoStakedLp() public {
        _deposit(alice, 10_000e6);
        _harvest();

        assertGt(gauge.balanceOf(address(vault)), 0);
        assertEq(pool.balanceOf(address(vault)), 0);
        // Only the swap fee on ~half the deposit is lost (0.3% * 50% = 0.15%) plus tiny price impact.
        assertApproxEqRel(vault.totalAssets(), 10_000e6, 0.003e18);
        // Leftover idle is dust.
        assertLt(usdc.balanceOf(address(vault)), 20e6);
    }

    function test_secondDepositorGetsFairShares() public {
        _deposit(alice, 10_000e6);
        _harvest();
        uint256 taBefore = vault.totalAssets();
        uint256 supplyBefore = vault.totalSupply();

        uint256 shares = _deposit(bob, 5_000e6);
        assertApproxEqRel(shares, 5_000e6 * supplyBefore / taBefore, 1e12);
    }

    function test_depositCap() public {
        vm.prank(owner);
        vault.setDepositCap(1_000e6);
        usdc.mint(alice, 1_001e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_001e6);
        vm.expectRevert(AeroUsdcWethVault.CapExceeded.selector);
        vault.deposit(1_001e6, alice);
        vault.deposit(1_000e6, alice);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ harvest / compound

    function test_harvestCompoundsRewards() public {
        _deposit(alice, 100_000e6);
        _harvest();
        uint256 before = vault.totalAssets();

        gauge.setEarned(address(vault), 1_000e18); // ~$1,000 of AERO
        vm.prank(keeper);
        (uint256 fromRewards, uint256 lp) = vault.harvest(990e6, type(uint256).max);

        assertGt(fromRewards, 990e6);
        assertGt(lp, 0);
        assertEq(aero.balanceOf(address(vault)), 0);
        assertApproxEqRel(vault.totalAssets(), before + 1_000e6, 0.003e18);

        // Alice now redeems more than she deposited.
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice, 0);
        assertGt(out, 100_000e6);
    }

    function test_harvestRewardMinOutEnforced() public {
        _deposit(alice, 10_000e6);
        gauge.setEarned(address(vault), 1_000e18);
        vm.prank(keeper);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vault.harvest(1_000e6, type(uint256).max);
    }

    function test_harvestOnlyKeeperOrOwner() public {
        vm.expectRevert(AeroUsdcWethVault.NotKeeper.selector);
        vm.prank(alice);
        vault.harvest(0, type(uint256).max);

        _deposit(alice, 10_000e6);
        vm.prank(owner);
        vault.harvest(0, type(uint256).max);
    }

    function test_harvestChunksLargeIdleBalance() public {
        _deposit(alice, 900_000e6);

        // Investing everything at once would swap $450k into a $30M pool: > 1% impact, so it reverts.
        vm.prank(keeper);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vault.harvest(0, type(uint256).max);

        // Keeper chunks it instead; arbitrage restores the pool price between calls.
        for (uint256 i; i < 9; ++i) {
            vm.prank(keeper);
            vault.harvest(0, 100_000e6);
            _arbBackToOracle();
        }
        assertLt(usdc.balanceOf(address(vault)), 1_000e6);
        assertApproxEqRel(vault.totalAssets(), 900_000e6, 0.01e18);
    }

    function test_harvestSkipsInvestBelowMinimum() public {
        _deposit(alice, 5e6);
        _harvest();
        assertEq(vault.lpBalance(), 0);
    }

    // ------------------------------------------------------------------ redeem

    function test_redeemReturnsUsdc() public {
        _deposit(alice, 10_000e6);
        _harvest();

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice, 9_900e6);

        assertEq(usdc.balanceOf(alice), out);
        assertGe(out, 9_950e6); // two half-size swaps at 0.3% fee
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.lpBalance(), 0);
    }

    function test_redeemRespectsUserMin() public {
        _deposit(alice, 10_000e6);
        _harvest();
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice, 10_000e6);
    }

    function test_redeemWithAllowance() public {
        uint256 shares = _deposit(alice, 1_000e6);
        vm.prank(alice);
        vault.approve(bob, shares);
        vm.prank(bob);
        vault.redeem(shares, bob, alice, 0);
        assertEq(usdc.balanceOf(bob), 1_000e6);

        _deposit(alice, 1_000e6);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(1, bob, alice, 0);
    }

    function test_redeemInKindWorksWithStaleOracleAndPaused() public {
        _deposit(alice, 10_000e6);
        _harvest();
        vm.prank(owner);
        vault.pause();
        vm.warp(block.timestamp + 2 days); // feeds now stale

        vm.expectRevert(AeroUsdcWethVault.StaleOracle.selector);
        vault.totalAssets();

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        (uint256 u, uint256 w) = vault.redeemInKind(shares, alice, alice, 0, 0);
        assertApproxEqRel(u + w * ETH_PRICE / 1e12, 10_000e6, 0.003e18);
        assertEq(weth.balanceOf(alice), w);
    }

    // ------------------------------------------------------------------ manipulation resistance

    function test_totalAssetsIgnoresSpotManipulation() public {
        _deposit(alice, 100_000e6);
        _harvest();
        uint256 before = vault.totalAssets();

        _pumpWeth(3_000_000e6); // moves spot ~+44%
        assertGt(_spotPrice(), 4000e18);

        // Fair-reserve pricing only grows with k (fees), not with the ratio.
        assertApproxEqRel(vault.totalAssets(), before, 0.002e18);
        assertGe(vault.totalAssets(), before);
    }

    function test_harvestRevertsWhenPoolManipulated() public {
        _deposit(alice, 10_000e6);
        _pumpWeth(300_000e6); // ~ +4% spot move
        vm.prank(keeper);
        vm.expectPartialRevert(AeroUsdcWethVault.PoolPriceDeviation.selector);
        vault.harvest(0, type(uint256).max);
    }

    function test_redeemRevertsWhenSandwiched() public {
        _deposit(alice, 100_000e6);
        _harvest();

        // Attacker dumps WETH to crash the price the vault would sell into.
        uint256 wethIn = 200e18;
        weth.mint(attacker, wethIn);
        vm.startPrank(attacker);
        weth.approve(address(router), wethIn);
        MockRouter.Route[] memory r = new MockRouter.Route[](1);
        r[0] = MockRouter.Route(address(weth), address(usdc), false, factory);
        router.swapExactTokensForTokens(wethIn, 0, r, attacker, block.timestamp);
        vm.stopPrank();

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectPartialRevert(AeroUsdcWethVault.InsufficientOutput.selector);
        vault.redeem(shares, alice, alice, 0);

        // In-kind exit still works and is not affected by the swap price.
        vm.prank(alice);
        vault.redeemInKind(shares, alice, alice, 0, 0);
    }

    function test_inflationAttackUnprofitable() public {
        // Attacker front-runs the first deposit with 1 wei and a large donation.
        _deposit(attacker, 1);
        usdc.mint(attacker, 10_000e6);
        vm.prank(attacker);
        usdc.transfer(address(vault), 10_000e6);

        uint256 victimShares = _deposit(alice, 10_000e6);
        assertGt(victimShares, 0);

        vm.prank(alice);
        (uint256 u,) = vault.redeemInKind(victimShares, alice, alice, 0, 0);
        assertGe(u, 10_000e6 - 1);

        uint256 attackerShares = vault.balanceOf(attacker);
        vm.prank(attacker);
        (uint256 a,) = vault.redeemInKind(attackerShares, attacker, attacker, 0, 0);
        assertLt(a, 10_000e6);
    }

    // ------------------------------------------------------------------ oracle safety

    function test_staleEthFeedBlocksDeposit() public {
        vm.warp(block.timestamp + 1201);
        usdcUsd.set(1e8);
        usdc.mint(alice, 1e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1e6);
        vm.expectRevert(AeroUsdcWethVault.StaleOracle.selector);
        vault.deposit(1e6, alice);
        vm.stopPrank();
    }

    function test_badPriceReverts() public {
        ethUsd.set(0);
        vm.expectRevert(AeroUsdcWethVault.BadOraclePrice.selector);
        vault.totalAssets();
    }

    function test_sequencerDownAndGracePeriod() public {
        sequencer.setRound(1, block.timestamp, block.timestamp);
        vm.expectRevert(AeroUsdcWethVault.SequencerDown.selector);
        vault.ethPriceInUsdc();

        // Back up, but inside the grace period.
        sequencer.setRound(0, block.timestamp - 10 minutes, block.timestamp);
        vm.expectRevert(AeroUsdcWethVault.SequencerDown.selector);
        vault.ethPriceInUsdc();

        sequencer.setRound(0, block.timestamp - 61 minutes, block.timestamp);
        assertEq(vault.ethPriceInUsdc(), ETH_PRICE * 1e18);
    }

    function test_usdcDepegAdjustsPrice() public {
        usdcUsd.set(0.99e8);
        assertApproxEqRel(vault.ethPriceInUsdc(), uint256(3000e18) * 100 / 99, 1e9);
    }

    // ------------------------------------------------------------------ admin

    function test_emergencyExitUnwindsAndPauses() public {
        _deposit(alice, 10_000e6);
        _harvest();
        uint256 before = vault.totalAssets();

        vm.prank(owner);
        vault.emergencyExit(0, 0);

        assertTrue(vault.paused());
        assertEq(vault.lpBalance(), 0);
        assertApproxEqRel(vault.totalAssets(), before, 0.001e18);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(keeper);
        vault.harvest(0, type(uint256).max);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice, 0);
        assertGe(out, 9_950e6);
    }

    function test_adminFunctionsOnlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setKeeper(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.emergencyExit(0, 0);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setMaxSlippageBps(10);
        vm.stopPrank();
    }

    function test_slippageCap() public {
        vm.prank(owner);
        vm.expectRevert(AeroUsdcWethVault.SlippageTooHigh.selector);
        vault.setMaxSlippageBps(501);
    }

    function test_rewardRouteValidation() public {
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](2);
        r[0] = IAeroRouter.Route(address(aero), address(weth), false, factory);
        r[1] = IAeroRouter.Route(address(weth), address(usdc), false, factory);

        vm.startPrank(owner);
        vault.setRewardRoutes(r);
        assertEq(vault.getRewardRoutes().length, 2);

        // Foreign factory (attacker-controlled pool) is rejected.
        r[1].factory = attacker;
        vm.expectRevert(AeroUsdcWethVault.InvalidRoute.selector);
        vault.setRewardRoutes(r);

        // Non-contiguous route is rejected.
        r[1] = IAeroRouter.Route(address(aero), address(usdc), false, factory);
        vm.expectRevert(AeroUsdcWethVault.InvalidRoute.selector);
        vault.setRewardRoutes(r);

        // Must end at USDC.
        IAeroRouter.Route[] memory bad = new IAeroRouter.Route[](1);
        bad[0] = IAeroRouter.Route(address(aero), address(weth), false, factory);
        vm.expectRevert(AeroUsdcWethVault.InvalidRoute.selector);
        vault.setRewardRoutes(bad);
        vm.stopPrank();
    }

    function test_sweepProtectsVaultTokens() public {
        MockERC20 junk = new MockERC20("Junk", "J", 18);
        junk.mint(address(vault), 5e18);
        vm.startPrank(owner);
        vault.sweep(address(junk), owner);
        assertEq(junk.balanceOf(owner), 5e18);

        address[4] memory protected = [address(usdc), address(weth), address(aero), address(pool)];
        for (uint256 i; i < protected.length; ++i) {
            vm.expectRevert(AeroUsdcWethVault.ProtectedToken.selector);
            vault.sweep(protected[i], owner);
        }
        vm.stopPrank();
    }

    function test_constructorRejectsWrongPool() public {
        MockPool other = new MockPool(address(usdc), address(aero));
        AeroUsdcWethVault.Config memory c = AeroUsdcWethVault.Config({
            usdc: address(usdc),
            weth: address(weth),
            aero: address(aero),
            router: address(router),
            pool: address(other),
            gauge: address(gauge),
            ethUsdFeed: address(ethUsd),
            usdcUsdFeed: address(usdcUsd),
            sequencerFeed: address(sequencer),
            ethUsdHeartbeat: 1200,
            usdcUsdHeartbeat: 86400,
            owner: owner,
            keeper: keeper,
            depositCap: 1
        });
        vm.expectRevert(AeroUsdcWethVault.InvalidConfig.selector);
        new AeroUsdcWethVault(c);
    }

    // ------------------------------------------------------------------ fuzz

    /// A depositor who joins after others and exits right away cannot take value from existing holders.
    function testFuzz_depositRedeemNoFreeValue(uint256 a, uint256 b, uint256 reward) public {
        a = bound(a, 100e6, 100_000e6);
        b = bound(b, 1e6, 800_000e6);
        reward = bound(reward, 0, 10_000e18);

        _deposit(alice, a);
        _harvest();
        gauge.setEarned(address(vault), reward);
        _harvest();

        uint256 aliceValueBefore = vault.previewRedeem(vault.balanceOf(alice));
        uint256 bobShares = _deposit(bob, b);
        vm.prank(bob);
        (uint256 u, uint256 w) = vault.redeemInKind(bobShares, bob, bob, 0, 0);

        // Fair-reserve LP pricing is a lower bound of the in-kind value when pool spot != oracle
        // (gap ~ deviation^2 / 8 of the LP value). Harvest keeps spot within 1% of the oracle, so a
        // round trip can gain at most ~0.00125% of LP value, which is what we allow here.
        uint256 tolerance = aliceValueBefore / 50_000 + 1;
        assertLe(u + w * ETH_PRICE / 1e12, b + tolerance);
        assertGe(vault.previewRedeem(vault.balanceOf(alice)) + tolerance, aliceValueBefore);
    }
}
