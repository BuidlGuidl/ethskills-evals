// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {MockERC20, MockFeed, MockPool, MockRouter, MockUniRouter, MockGauge} from "./mocks/Mocks.sol";

contract AeroUsdcWethVaultTest is Test {
    MockERC20 usdc;
    MockERC20 weth;
    MockERC20 aero;
    MockPool pool;
    MockPool aeroPool;
    MockRouter router;
    MockUniRouter uniRouter;
    MockGauge gauge;
    MockFeed ethUsd;
    MockFeed sequencer;
    AeroUsdcWethVault vault;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");

    uint256 constant ETH_PRICE = 2500e8;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockERC20("USDC", 6);
        weth = new MockERC20("WETH", 18);
        aero = new MockERC20("AERO", 18);
        router = new MockRouter();

        pool = new MockPool(address(usdc), address(weth));
        _seed(pool, usdc, 5_000_000e6, weth, 2000e18);
        aeroPool = new MockPool(address(usdc), address(aero));
        _seed(aeroPool, usdc, 1_000_000e6, aero, 2_000_000e18); // AERO = $0.50
        // deep "Uniswap V3" market for USDC<->WETH swaps
        MockPool uniPool = new MockPool(address(usdc), address(weth));
        _seed(uniPool, usdc, 250_000_000e6, weth, 100_000e18);
        uniRouter = new MockUniRouter(uniPool);
        router.register(pool);
        router.register(aeroPool);

        gauge = new MockGauge(address(pool), address(aero));
        ethUsd = new MockFeed(8, int256(ETH_PRICE));
        sequencer = new MockFeed(0, 0);
        sequencer.setTimes(block.timestamp - 2 hours, block.timestamp);

        vault = new AeroUsdcWethVault(
            AeroUsdcWethVault.Addresses({
                usdc: address(usdc),
                weth: address(weth),
                aero: address(aero),
                router: address(router),
                factory: address(0xFAC),
                uniRouter: address(uniRouter),
                uniFee: 500,
                pool: address(pool),
                gauge: address(gauge),
                ethUsdFeed: address(ethUsd),
                sequencerFeed: address(sequencer),
                owner: owner,
                keeper: keeper
            }),
            10_000_000e6
        );

        for (uint256 i; i < 3; i++) {
            address u = [alice, bob, attacker][i];
            usdc.mint(u, 1_000_000e6);
            vm.prank(u);
            usdc.approve(address(vault), type(uint256).max);
        }
    }

    function _seed(MockPool p, MockERC20 a, uint256 amtA, MockERC20 b, uint256 amtB) internal {
        a.mint(address(p), amtA);
        b.mint(address(p), amtB);
        p.mint(address(0xdead));
    }

    function _deposit(address u, uint256 amt) internal returns (uint256) {
        vm.prank(u);
        return vault.deposit(amt, u);
    }

    function _reward(uint256 aeroAmt) internal {
        aero.mint(address(gauge), aeroAmt);
        gauge.accrue(address(vault), aeroAmt);
    }

    function _refreshOracle() internal {
        ethUsd.set(int256(ETH_PRICE));
    }

    // ---------------------------------------------------------------- deposits

    function test_depositMintsSharesAndStaysIdle() public {
        uint256 shares = _deposit(alice, 10_000e6);
        assertEq(shares, 10_000e6 * 1e6);
        assertEq(vault.totalAssets(), 10_000e6);
        assertEq(usdc.balanceOf(address(vault)), 10_000e6);
        assertEq(vault.lpBalance(), 0);
    }

    function test_depositCapAndPause() public {
        vm.prank(owner);
        vault.setParams(1000e6, 100, 100, 30, 25 minutes, 6 hours);
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(1001e6, alice);
        _deposit(alice, 1000e6);
        assertEq(vault.maxDeposit(alice), 0);

        vm.prank(owner);
        vault.pause();
        assertEq(vault.maxDeposit(bob), 0);
        // withdrawals still work while paused
        vm.prank(alice);
        vault.withdraw(500e6, alice, alice);
    }

    function test_inflationAttackUnprofitable() public {
        _deposit(attacker, 1);
        vm.prank(attacker);
        usdc.transfer(address(vault), 100_000e6); // donation to inflate share price
        _deposit(alice, 50_000e6);
        uint256 aliceAssets = vault.previewRedeem(vault.balanceOf(alice));
        assertApproxEqRel(aliceAssets, 50_000e6, 1e14); // alice loses < 0.01%
        uint256 attackerAssets = vault.previewRedeem(vault.balanceOf(attacker));
        assertLt(attackerAssets, 100_000e6);
    }

    // ---------------------------------------------------------------- harvest / invest

    function test_harvestInvestsIdleIntoStakedLp() public {
        _deposit(alice, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);

        assertGt(gauge.balanceOf(address(vault)), 0);
        assertLt(usdc.balanceOf(address(vault)), 1000e6); // most USDC deployed
        // book value = deposit - swap fee on half - haircut (<= ~0.7%)
        assertApproxEqRel(vault.totalAssets(), 100_000e6, 0.007e18);
    }

    function test_onlyKeeperOrOwnerCanHarvest() public {
        vm.prank(alice);
        vm.expectRevert(AeroUsdcWethVault.NotKeeper.selector);
        vault.harvest(0);
        vm.prank(owner);
        vault.harvest(0);
    }

    function test_harvestCompoundsRewardsWithLinearUnlock() public {
        _deposit(alice, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        uint256 before = vault.totalAssets();

        _reward(2000e18); // ~$1000 of AERO
        assertEq(vault.pendingRewards(), 2000e18);
        vm.prank(keeper);
        vault.harvest(990e6);

        assertEq(aero.balanceOf(address(vault)), 0);
        assertApproxEqAbs(vault.totalAssets(), before, 10e6); // profit locked right after harvest
        assertGt(vault.currentLockedProfit(), 990e6);

        skip(3 hours);
        _refreshOracle();
        uint256 mid = vault.totalAssets();
        assertApproxEqRel(mid - before, 500e6, 0.02e18);

        skip(3 hours);
        _refreshOracle();
        assertEq(vault.currentLockedProfit(), 0);
        assertApproxEqRel(vault.totalAssets() - before, 1000e6, 0.02e18);
    }

    function test_harvestMinOutEnforced() public {
        _deposit(alice, 10_000e6);
        _reward(2000e18);
        vm.prank(keeper);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vault.harvest(1100e6);
    }

    function test_harvestSandwichGetsNoProfit() public {
        _deposit(alice, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        _reward(20_000e18);

        uint256 start = usdc.balanceOf(attacker);
        uint256 shares = _deposit(attacker, 500_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        vm.prank(attacker);
        vault.redeem(shares, attacker, attacker);
        assertLe(usdc.balanceOf(attacker), start);
    }

    // ---------------------------------------------------------------- withdrawals

    function test_withdrawFromIdleNoUnwind() public {
        _deposit(alice, 10_000e6);
        vm.prank(alice);
        vault.withdraw(4000e6, alice, alice);
        assertEq(usdc.balanceOf(alice), 1_000_000e6 - 6000e6);
    }

    function test_withdrawUnwindsLp() public {
        _deposit(alice, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        uint256 lpBefore = vault.lpBalance();

        vm.prank(alice);
        vault.withdraw(50_000e6, alice, alice);
        assertEq(usdc.balanceOf(alice), 950_000e6);
        assertLt(vault.lpBalance(), lpBefore);
        assertEq(weth.balanceOf(address(vault)), 0);
    }

    function test_everyoneCanFullyRedeem() public {
        _deposit(alice, 100_000e6);
        _deposit(bob, 300_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        _reward(10_000e18);
        vm.prank(keeper);
        vault.harvest(0);
        skip(6 hours);
        _refreshOracle();

        uint256 aShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aShares, alice, alice);
        uint256 bShares = vault.balanceOf(bob);
        vm.prank(bob);
        vault.redeem(bShares, bob, bob);

        assertEq(vault.totalSupply(), 0);
        // exit costs come out of the haircut, so remaining holders are never diluted
        assertGe(usdc.balanceOf(bob) - 700_000e6, usdc.balanceOf(alice) - 900_000e6);
        assertGt(usdc.balanceOf(alice) + usdc.balanceOf(bob), 2_000_000e6 - 400_000e6 + 399_000e6);
    }

    function test_withdrawDoesNotDiluteRemainingHolders() public {
        _deposit(alice, 100_000e6);
        _deposit(bob, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        uint256 bobValue = vault.previewRedeem(vault.balanceOf(bob));

        uint256 aShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aShares, alice, alice);
        assertGe(vault.previewRedeem(vault.balanceOf(bob)), bobValue);
    }

    // ---------------------------------------------------------------- oracle / manipulation

    function test_manipulatedPoolBlocksInvestAndUnwind() public {
        _deposit(alice, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        _deposit(bob, 30_000e6);

        // attacker dumps WETH into the pool to crash spot price ~10%
        weth.mint(address(pool), 110e18);
        pool.swap(address(weth), attacker);

        vm.prank(keeper);
        vm.expectPartialRevert(AeroUsdcWethVault.PriceDeviation.selector);
        vault.harvest(0);

        vm.prank(alice);
        vm.expectPartialRevert(AeroUsdcWethVault.PriceDeviation.selector);
        vault.withdraw(90_000e6, alice, alice);
    }

    function test_totalAssetsResistsSpotManipulation() public {
        _deposit(alice, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);
        uint256 before = vault.totalAssets();

        // large one-sided swap moves spot a lot but k barely changes
        usdc.mint(address(pool), 2_000_000e6);
        pool.swap(address(usdc), attacker);
        assertApproxEqRel(vault.totalAssets(), before, 0.002e18);
    }

    function test_staleOracleReverts() public {
        _deposit(alice, 1000e6);
        skip(26 minutes);
        vm.expectRevert(AeroUsdcWethVault.StaleOracle.selector);
        vault.totalAssets();
    }

    function test_sequencerDownReverts() public {
        _deposit(alice, 1000e6);
        sequencer.set(1);
        vm.expectRevert(AeroUsdcWethVault.SequencerDown.selector);
        vault.totalAssets();

        sequencer.set(0);
        sequencer.setTimes(block.timestamp - 10 minutes, block.timestamp); // just restarted
        vm.expectRevert(AeroUsdcWethVault.SequencerDown.selector);
        vault.totalAssets();
    }

    // ---------------------------------------------------------------- admin

    function test_emergencyExitThenWithdraw() public {
        _deposit(alice, 100_000e6);
        vm.prank(keeper);
        vault.harvest(0);

        vm.prank(alice);
        vm.expectRevert();
        vault.emergencyExit(0, 0);

        vm.prank(owner);
        vault.emergencyExit(0, 0);
        assertTrue(vault.paused());
        assertEq(vault.lpBalance(), 0);
        assertGt(weth.balanceOf(address(vault)), 0);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertApproxEqRel(usdc.balanceOf(alice), 1_000_000e6, 0.007e18);
    }

    function test_setParamsBounds() public {
        vm.prank(owner);
        vm.expectRevert(AeroUsdcWethVault.BadParam.selector);
        vault.setParams(1, 501, 100, 50, 1, 1 hours);
        vm.prank(alice);
        vm.expectRevert();
        vault.setParams(1, 100, 100, 50, 1, 1 hours);
    }

    function test_constructorRejectsWrongGauge() public {
        MockGauge bad = new MockGauge(address(aeroPool), address(aero));
        vm.expectRevert(AeroUsdcWethVault.BadParam.selector);
        new AeroUsdcWethVault(
            AeroUsdcWethVault.Addresses({
                usdc: address(usdc),
                weth: address(weth),
                aero: address(aero),
                router: address(router),
                factory: address(0xFAC),
                uniRouter: address(uniRouter),
                uniFee: 500,
                pool: address(pool),
                gauge: address(bad),
                ethUsdFeed: address(ethUsd),
                sequencerFeed: address(sequencer),
                owner: owner,
                keeper: keeper
            }),
            0
        );
    }

    function testFuzz_depositRedeemIdleIsLossless(uint256 amt) public {
        amt = bound(amt, 1, 1_000_000e6);
        uint256 shares = _deposit(alice, amt);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertEq(usdc.balanceOf(alice), 1_000_000e6);
    }
}
