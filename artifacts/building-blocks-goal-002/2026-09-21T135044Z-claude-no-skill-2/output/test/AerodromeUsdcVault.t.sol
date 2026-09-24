// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AerodromeUsdcVault} from "../src/AerodromeUsdcVault.sol";
import {MockERC20, MockFeed, MockPool, MockRouter, MockGauge} from "./mocks/Mocks.sol";

contract AerodromeUsdcVaultTest is Test {
    MockERC20 usdc;
    MockERC20 weth;
    MockERC20 aero;
    MockPool pool; // WETH/USDC
    MockPool aeroPool; // AERO/USDC
    MockRouter router;
    MockGauge gauge;
    MockFeed ethFeed;
    MockFeed usdcFeed;
    MockFeed seqFeed;
    AerodromeUsdcVault vault;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");

    int256 constant ETH_PRICE = 2500e8;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockERC20("USDC", 6);
        weth = new MockERC20("WETH", 18);
        aero = new MockERC20("AERO", 18);
        router = new MockRouter();

        pool = new MockPool(address(weth), address(usdc));
        aeroPool = new MockPool(address(aero), address(usdc));
        router.register(pool);
        router.register(aeroPool);
        _seed(pool, weth, 10_000e18, 25_000_000e6); // $2500/ETH, $50M TVL
        _seed(aeroPool, aero, 1_000_000e18, 700_000e6); // $0.70/AERO

        gauge = new MockGauge(address(pool), aero);
        ethFeed = new MockFeed(8, ETH_PRICE);
        usdcFeed = new MockFeed(8, 1e8);
        seqFeed = new MockFeed(0, 0);
        seqFeed.setStartedAt(block.timestamp - 2 hours);

        vault = new AerodromeUsdcVault(
            AerodromeUsdcVault.Config({
                usdc: address(usdc),
                weth: address(weth),
                aero: address(aero),
                router: address(router),
                pool: address(pool),
                gauge: address(gauge),
                ethUsdFeed: address(ethFeed),
                usdcUsdFeed: address(usdcFeed),
                sequencerUptimeFeed: address(seqFeed),
                ethFeedMaxAge: 1 hours,
                usdcFeedMaxAge: 25 hours,
                keeper: keeper,
                feeRecipient: treasury
            }),
            10_000_000e6,
            owner
        );
    }

    // ------------------------------------------------------------ helpers

    function _seed(MockPool p, MockERC20 token, uint256 tokenAmt, uint256 usdcAmt) internal {
        token.mint(address(p), tokenAmt);
        usdc.mint(address(p), usdcAmt);
        p.mint(address(this));
    }

    function _deposit(address user, uint256 amt) internal returns (uint256 shares) {
        usdc.mint(user, amt);
        vm.startPrank(user);
        usdc.approve(address(vault), amt);
        shares = vault.deposit(amt, user);
        vm.stopPrank();
    }

    function _harvest() internal {
        vm.prank(keeper);
        vault.harvest(0, type(uint256).max);
    }

    function _refreshFeeds() internal {
        ethFeed.set(ETH_PRICE, block.timestamp);
        usdcFeed.set(1e8, block.timestamp);
    }

    /// @dev Sell `amt` WETH into the pool (moves spot price down).
    function _dumpWeth(uint256 amt) internal {
        weth.mint(address(pool), amt);
        pool.swap(address(weth), amt, attacker);
    }

    // ------------------------------------------------------------ deposit

    function test_deposit_mintsShares() public {
        uint256 shares = _deposit(alice, 1_000e6);
        assertEq(shares, 1_000e6 * 1e6);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), 1_000e6);
        assertEq(vault.decimals(), 12);
    }

    function test_deposit_revertsWhenPaused() public {
        vm.prank(owner);
        vault.setDepositsPaused(true);
        usdc.mint(alice, 1e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1e6);
        vm.expectRevert(AerodromeUsdcVault.DepositsPaused.selector);
        vault.deposit(1e6, alice);
        vm.stopPrank();
    }

    function test_deposit_revertsOverCap() public {
        vm.prank(owner);
        vault.setDepositCap(100e6);
        usdc.mint(alice, 101e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 101e6);
        vm.expectRevert(AerodromeUsdcVault.DepositCapExceeded.selector);
        vault.deposit(101e6, alice);
        vm.stopPrank();
    }

    function test_deposit_revertsOnStaleOracle() public {
        vm.warp(block.timestamp + 2 hours);
        usdc.mint(alice, 1e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1e6);
        vm.expectRevert(AerodromeUsdcVault.OracleUnavailable.selector);
        vault.deposit(1e6, alice);
        vm.stopPrank();
    }

    function test_deposit_revertsWhenSequencerDownOrInGrace() public {
        seqFeed.set(1, block.timestamp); // down
        vm.expectRevert(AerodromeUsdcVault.OracleUnavailable.selector);
        vault.totalAssets();

        seqFeed.set(0, block.timestamp);
        seqFeed.setStartedAt(block.timestamp - 10 minutes); // just came back up
        vm.expectRevert(AerodromeUsdcVault.OracleUnavailable.selector);
        vault.totalAssets();
    }

    function test_inflationAttack_mitigated() public {
        // attacker front-runs the first deposit: 1 wei deposit + large donation
        _deposit(attacker, 1);
        usdc.mint(attacker, 1_000_000e6);
        vm.prank(attacker);
        usdc.transfer(address(vault), 1_000_000e6);

        uint256 shares = _deposit(alice, 10_000e6);
        assertGt(shares, 0);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, 0);
        // alice loses at most one share of rounding (~$0.50) while the attacker burns ~half the donation
        assertApproxEqAbs(out, 10_000e6, 1e6);
        uint256 attackerShares = vault.balanceOf(attacker);
        vm.prank(attacker);
        uint256 attackerOut = vault.redeem(attackerShares, attacker, 0);
        assertLt(attackerOut, 600_000e6);
    }

    // ------------------------------------------------------------ harvest / deploy

    function test_harvest_deploysIdleIntoGauge() public {
        _deposit(alice, 100_000e6);
        _harvest();

        assertGt(gauge.balanceOf(address(vault)), 0);
        assertLt(usdc.balanceOf(address(vault)), 100e6, "idle left after zap should be tiny"); // <0.1%
        // deploying costs ~ half the 0.3% swap fee
        assertApproxEqRel(vault.totalAssets(), 100_000e6, 0.003e18);
    }

    function test_harvest_compoundsRewards_withFeeAndLinearUnlock() public {
        _deposit(alice, 100_000e6);
        _harvest();
        uint256 before = vault.totalAssets();

        gauge.addReward(address(vault), 1_000e18); // ~$700 of AERO
        vm.prank(keeper);
        uint256 profit = vault.harvest(600e6, type(uint256).max);

        assertGt(profit, 600e6);
        assertEq(usdc.balanceOf(treasury), profit / 10, "10% perf fee");
        // profit is locked -> no instant share-price jump
        assertApproxEqRel(vault.totalAssets(), before, 0.002e18);

        vm.warp(block.timestamp + 12 hours);
        _refreshFeeds();
        assertApproxEqRel(vault.totalAssets(), before + profit - profit / 10, 0.002e18);
    }

    function test_harvest_rewardSlippageFloor() public {
        _deposit(alice, 10_000e6);
        gauge.addReward(address(vault), 1_000e18);
        vm.prank(keeper);
        vm.expectRevert("Router: insufficient output");
        vault.harvest(800e6, type(uint256).max); // 1000 AERO @ $0.70 cannot yield 800 USDC
    }

    function test_harvest_onlyKeeperOrOwner() public {
        vm.prank(alice);
        vm.expectRevert(AerodromeUsdcVault.NotKeeper.selector);
        vault.harvest(0, type(uint256).max);

        vm.prank(owner);
        vault.harvest(0, type(uint256).max);
    }

    function test_harvest_zapSlippageBound_andChunkedDeploy() public {
        _deposit(alice, 600_000e6);
        // one-shot zap of $600k into a $50M pool moves price too far -> oracle floor rejects it
        vm.prank(keeper);
        vm.expectRevert("Router: insufficient output");
        vault.harvest(0, type(uint256).max);

        // keeper deploys in chunks instead
        vm.startPrank(keeper);
        vault.harvest(0, 100_000e6);
        vault.harvest(0, 100_000e6);
        vm.stopPrank();
        assertApproxEqAbs(usdc.balanceOf(address(vault)), 400_000e6, 100e6);
        assertApproxEqRel(vault.totalAssets(), 600_000e6, 0.005e18);
    }

    function test_harvest_revertsWhenPoolSkewed() public {
        _deposit(alice, 10_000e6);
        _dumpWeth(500e18); // ~10% price move
        vm.prank(keeper);
        vm.expectRevert(AerodromeUsdcVault.PoolPriceDeviation.selector);
        vault.harvest(0, type(uint256).max);
    }

    // ------------------------------------------------------------ redeem

    function test_redeem_fromIdle_exact() public {
        uint256 shares = _deposit(alice, 1_000e6);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, 1_000e6);
        assertEq(out, 1_000e6);
        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(vault.totalSupply(), 0);
    }

    function test_redeem_afterDeploy_redeemerPaysExitCost() public {
        uint256 aShares = _deposit(alice, 50_000e6);
        _deposit(bob, 50_000e6);
        _harvest();

        uint256 bobValueBefore = vault.convertToAssets(vault.balanceOf(bob));
        vm.prank(alice);
        uint256 out = vault.redeem(aShares, alice, 0);

        assertApproxEqRel(out, 50_000e6, 0.005e18);
        assertLt(out, 50_000e6);
        // bob is not diluted by alice's exit costs
        assertGe(vault.convertToAssets(vault.balanceOf(bob)), bobValueBefore - 1);
    }

    function test_redeem_userMinOut() public {
        uint256 shares = _deposit(alice, 10_000e6);
        _harvest();
        vm.prank(alice);
        vm.expectRevert(AerodromeUsdcVault.InsufficientOutput.selector);
        vault.redeem(shares, alice, 10_000e6);
    }

    function test_redeem_oracleFloorBlocksSandwich() public {
        uint256 shares = _deposit(alice, 10_000e6);
        _harvest();
        _dumpWeth(500e18); // attacker pushes WETH price down ~10% before alice's exit
        vm.prank(alice);
        vm.expectRevert("Router: insufficient output");
        vault.redeem(shares, alice, 0);
    }

    function test_redeem_oracleDown_proRataFallback() public {
        uint256 aShares = _deposit(alice, 10_000e6);
        _deposit(bob, 10_000e6);
        _harvest();
        _deposit(bob, 1_000e6); // some idle USDC

        ethFeed.setBroken(true);
        vm.startPrank(alice);
        vm.expectRevert(AerodromeUsdcVault.MinOutRequired.selector);
        vault.redeem(aShares, alice, 0);

        uint256 out = vault.redeem(aShares, alice, 9_900e6);
        vm.stopPrank();
        assertApproxEqRel(out, 10_000e6, 0.005e18);
    }

    function test_rewardSniping_unprofitable() public {
        _deposit(alice, 100_000e6);
        _harvest();
        gauge.addReward(address(vault), 5_000e18); // ~$3.5k pending

        uint256 snipe = 100_000e6;
        uint256 shares = _deposit(attacker, snipe);
        _harvest();
        vm.prank(attacker);
        uint256 out = vault.redeem(shares, attacker, 0);
        assertLe(out, snipe, "sniper must not capture locked rewards");
    }

    function test_fairPricing_resistsReserveManipulation() public {
        _deposit(alice, 100_000e6);
        _harvest();
        uint256 before = vault.totalAssets();
        _dumpWeth(3_000e18); // huge skew
        assertApproxEqRel(vault.totalAssets(), before, 0.001e18);
    }

    function testFuzz_depositRedeem_neverProfits(uint256 amt, bool deploy) public {
        amt = bound(amt, 1e6, 200_000e6);
        _deposit(alice, 50_000e6);
        uint256 shares = _deposit(bob, amt);
        if (deploy) _harvest();
        vm.prank(bob);
        uint256 out = vault.redeem(shares, bob, 0);
        assertLe(out, amt);
        if (!deploy) assertApproxEqAbs(out, amt, 1);
    }

    // ------------------------------------------------------------ admin

    function test_admin_boundsAndAccess() public {
        vm.startPrank(owner);
        vm.expectRevert(AerodromeUsdcVault.ValueTooHigh.selector);
        vault.setPerformanceFee(2_001);
        vm.expectRevert(AerodromeUsdcVault.ValueTooHigh.selector);
        vault.setMaxSlippage(501);
        vm.expectRevert(AerodromeUsdcVault.ZeroAddress.selector);
        vault.setKeeper(address(0));
        vault.setKeeper(bob);
        vm.stopPrank();
        assertEq(vault.keeper(), bob);

        vm.prank(alice);
        vm.expectRevert();
        vault.setPerformanceFee(0);
    }
}
