// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {YieldVault, IStrategy} from "../src/YieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {IAeroRouter, IAeroVoter, IAeroGauge} from "../src/interfaces/IAerodrome.sol";

interface IVoterAdmin {
    function emergencyCouncil() external view returns (address);
    function killGauge(address gauge) external;
}

/// @notice Fork tests against real Aerodrome contracts on Base mainnet.
///         RPC: $BASE_RPC_URL (archive), falls back to the public Base endpoint.
contract YieldVaultForkTest is Test {
    uint256 constant FORK_BLOCK = 51_605_000; // 2026-09-21

    IERC20 constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    IERC20 constant WETH = IERC20(0x4200000000000000000000000000000000000006);
    IERC20 constant AERO = IERC20(0x940181a94A35A4569E4529A3CDfB74e38FD98631);
    IAeroRouter constant ROUTER = IAeroRouter(0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43);
    address constant VOTER = 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5;
    address constant EXPECTED_POOL = 0xcDAC0d6c6C59727a65F871236188350531885C43;
    address constant EXPECTED_GAUGE = 0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025;

    YieldVault vault;
    AerodromeUsdcWethStrategy strategy;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org")), FORK_BLOCK);

        vault = new YieldVault(USDC, owner, keeper, 10_000_000e6);
        strategy = new AerodromeUsdcWethStrategy(address(vault), owner, ROUTER, IAeroVoter(VOTER), USDC, WETH, AERO);
        vm.prank(owner);
        vault.setStrategy(IStrategy(address(strategy)));

        for (uint256 i; i < 3; i++) {
            address u = [alice, bob, attacker][i];
            deal(address(USDC), u, 5_000_000e6);
            vm.prank(u);
            USDC.approve(address(vault), type(uint256).max);
        }
    }

    // ---------------------------------------------------------------- helpers

    function _deposit(address u, uint256 amt) internal returns (uint256) {
        vm.prank(u);
        return vault.deposit(amt, u, 0);
    }

    function _redeemAll(address u) internal returns (uint256) {
        uint256 s = vault.balanceOf(u);
        vm.prank(u);
        return vault.redeem(s, u, 0);
    }

    function _harvest() internal {
        vm.prank(keeper);
        vault.harvest();
    }

    function _swap(address who, IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn) internal {
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
        r[0] = IAeroRouter.Route(address(tokenIn), address(tokenOut), false, ROUTER.defaultFactory());
        vm.startPrank(who);
        tokenIn.approve(address(ROUTER), amountIn);
        ROUTER.swapExactTokensForTokens(amountIn, 0, r, who, block.timestamp);
        vm.stopPrank();
    }

    function _pumpWeth(uint256 usdcIn) internal {
        _swap(attacker, USDC, WETH, usdcIn);
    }

    function _dumpWeth(uint256 wethIn) internal {
        deal(address(WETH), attacker, wethIn);
        _swap(attacker, WETH, USDC, wethIn);
    }

    /// @dev Stand-in for external arbitrage: push pool spot back to TWAP after our own zap moved it.
    function _arb() internal {
        (uint256 r0, uint256 r1,) = strategy.pool().getReserves(); // token0 = WETH
        uint256 target = Math.sqrt(r0 * r1 * 1e18 / strategy.twapPrice()); // WETH reserve at TWAP price
        address arber = makeAddr("arber");
        if (target > r0) {
            deal(address(WETH), arber, (target - r0) * 1003 / 1000);
            _swap(arber, WETH, USDC, (target - r0) * 1003 / 1000);
        } else if (target < r0) {
            uint256 usdcIn = (r0 * r1 / target - r1) * 1003 / 1000;
            deal(address(USDC), arber, usdcIn);
            _swap(arber, USDC, WETH, usdcIn);
        }
    }

    function _harvestAndArb() internal {
        _harvest();
        _arb();
    }

    // ---------------------------------------------------------------- wiring

    function test_constructorResolvesCanonicalPoolAndGauge() public view {
        assertEq(address(strategy.pool()), EXPECTED_POOL);
        assertEq(address(strategy.gauge()), EXPECTED_GAUGE);
        assertEq(IAeroGauge(EXPECTED_GAUGE).rewardToken(), address(AERO));
        // TWAP sane (USDC per WETH, 6 dec) and close to spot at fork block.
        uint256 p = strategy.twapPrice();
        assertGt(p, 500e6);
        assertLt(p, 20_000e6);
        strategy.checkPrice();
    }

    // ---------------------------------------------------------------- happy path

    function test_depositInvestHarvestRedeem() public {
        uint256 amt = 100_000e6;
        _deposit(alice, amt);
        _arb();
        assertGt(IAeroGauge(EXPECTED_GAUGE).balanceOf(address(strategy)), 0, "LP staked on deposit");
        assertLt(USDC.balanceOf(address(strategy)), amt / 1000, "only addLiquidity dust idle");
        // entry cost (0.3% fee on ~half + price impact) is small and borne by alice alone
        assertApproxEqRel(vault.totalAssets(), amt, 0.01e18);

        skip(1 days);
        assertGt(strategy.pendingRewards(), 0, "AERO accrued");

        uint256 before = strategy.totalValue();
        _harvest();
        uint256 afterValue = strategy.totalValue();
        assertGt(afterValue, before, "compounded");
        assertEq(AERO.balanceOf(address(strategy)), 0, "all AERO sold");
        assertEq(vault.lockedProfit(), afterValue - before, "gain locked");
        _arb();

        // gain unlocks linearly
        uint256 taNow = vault.totalAssets();
        skip(vault.PROFIT_UNLOCK_TIME());
        assertEq(vault.lockedProfit(), 0);
        assertGt(vault.totalAssets(), taNow);

        uint256 out = _redeemAll(alice);
        assertApproxEqRel(out, amt, 0.02e18);
        assertEq(vault.totalSupply(), 0);
        assertLt(strategy.totalValue(), 10, "only rounding dust left");
    }

    function test_laterDepositorDoesNotDiluteEarlier() public {
        _deposit(alice, 100_000e6);
        _arb();
        skip(1 days);
        _harvestAndArb();
        skip(vault.PROFIT_UNLOCK_TIME());

        uint256 aliceBefore = vault.convertToAssets(vault.balanceOf(alice));
        _deposit(bob, 100_000e6); // bob pays his own zap cost
        uint256 aliceAfter = vault.convertToAssets(vault.balanceOf(alice));
        assertApproxEqRel(aliceAfter, aliceBefore, 0.0001e18, "alice not diluted");
        assertGt(vault.convertToAssets(vault.balanceOf(bob)), 98_000e6);
    }

    function test_depositMinSharesSlippage() public {
        uint256 expected = vault.convertToShares(10_000e6);
        vm.prank(alice);
        vm.expectRevert(); // zap cost means fewer shares than a 1:1 quote
        vault.deposit(10_000e6, alice, expected);
    }

    function test_smallDepositRoundTrip() public {
        _deposit(alice, 10_000e6);
        _arb();
        assertApproxEqRel(_redeemAll(alice), 10_000e6, 0.01e18);
    }

    // ---------------------------------------------------------------- attacks

    function test_depositRevertsWhenSpotManipulated() public {
        _deposit(alice, 100_000e6);
        _arb();
        _pumpWeth(1_000_000e6); // moves spot >1% away from TWAP
        vm.expectRevert();
        _deposit(attacker, 100_000e6);
    }

    function test_harvestRevertsWhenSpotManipulated() public {
        _deposit(alice, 100_000e6);
        _pumpWeth(1_000_000e6);
        vm.prank(keeper);
        vm.expectRevert();
        vault.harvest();
    }

    function test_valuationIgnoresSpotManipulation() public {
        _deposit(alice, 100_000e6);
        _arb();
        uint256 v0 = strategy.totalValue();
        _pumpWeth(1_000_000e6);
        // fair-reserve pricing: reserve skew barely moves value (k grows only by fees)
        assertApproxEqRel(strategy.totalValue(), v0, 0.001e18);
    }

    function test_redeemWorksWhenManipulatedButRespectsMinOut() public {
        _deposit(alice, 100_000e6);
        _arb();
        _dumpWeth(50e18); // front-run: crash WETH before the exit swap
        uint256 s = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(); // user min-out protects against sandwiched exit
        vault.redeem(s, alice, 99_000e6);

        // exits never depend on the oracle: a looser min still goes through
        vm.prank(alice);
        uint256 out = vault.redeem(s, alice, 90_000e6);
        assertGt(out, 90_000e6);
    }

    function test_harvestSandwichGetsOnlyUnlockedGain() public {
        _deposit(alice, 100_000e6);
        _arb();
        skip(1 days);

        uint256 aShares = _deposit(attacker, 100_000e6);
        _arb();
        _harvestAndArb();
        vm.prank(attacker);
        uint256 out = vault.redeem(aShares, attacker, 0);
        assertLe(out, 100_000e6, "no instant profit from harvest");
    }

    function test_inflationAttackUnprofitable() public {
        vm.prank(attacker);
        vault.deposit(1, attacker, 0);
        vm.prank(attacker);
        USDC.transfer(address(strategy), 1_000_000e6); // donation
        uint256 aliceShares = _deposit(alice, 10_000e6);
        assertGt(aliceShares, 0);
        _arb();
        uint256 aliceOut = _redeemAll(alice);
        assertApproxEqRel(aliceOut, 10_000e6, 0.01e18);
    }

    // ---------------------------------------------------------------- access + limits

    function test_onlyKeeperOrOwnerHarvests() public {
        vm.expectRevert(YieldVault.OnlyKeeper.selector);
        vault.harvest();
        vm.prank(owner);
        vault.harvest();
    }

    function test_strategyOnlyVault() public {
        vm.expectRevert(AerodromeUsdcWethStrategy.OnlyVault.selector);
        strategy.harvest();
        vm.expectRevert(AerodromeUsdcWethStrategy.OnlyVault.selector);
        strategy.withdraw(1e18, attacker);
    }

    function test_strategySetOnce() public {
        vm.prank(owner);
        vm.expectRevert(YieldVault.StrategyAlreadySet.selector);
        vault.setStrategy(IStrategy(address(1)));
    }

    function test_depositCapAndPause() public {
        vm.prank(owner);
        vault.setDepositCap(1_000e6);
        vm.expectRevert(YieldVault.CapExceeded.selector);
        _deposit(alice, 1_001e6);

        _deposit(alice, 500e6);
        vm.prank(owner);
        vault.pause();
        vm.expectRevert();
        _deposit(alice, 1e6);
        // exits stay open while paused
        assertApproxEqRel(_redeemAll(alice), 500e6, 0.01e18);
    }

    function test_paramBounds() public {
        vm.prank(owner);
        vm.expectRevert(AerodromeUsdcWethStrategy.BadParam.selector);
        strategy.setParams(501, 100, 1e18);
    }

    // ---------------------------------------------------------------- failure modes

    function test_panicUnstakesAndUsersCanExit() public {
        _deposit(alice, 100_000e6);
        _arb();
        uint256 v = strategy.totalValue();

        vm.prank(owner);
        strategy.panic();
        assertEq(IAeroGauge(EXPECTED_GAUGE).balanceOf(address(strategy)), 0);
        assertApproxEqRel(strategy.totalValue(), v, 1e12);

        vm.prank(keeper);
        vm.expectRevert(AerodromeUsdcWethStrategy.Emergency.selector);
        vault.harvest();

        assertApproxEqRel(_redeemAll(alice), 100_000e6, 0.02e18);
    }

    function test_killedGaugeStillAllowsExit() public {
        _deposit(alice, 100_000e6);
        _arb();
        skip(1 hours);

        address council = IVoterAdmin(VOTER).emergencyCouncil();
        vm.prank(council);
        IVoterAdmin(VOTER).killGauge(EXPECTED_GAUGE);

        assertApproxEqRel(_redeemAll(alice), 100_000e6, 0.02e18);
        vm.expectRevert(); // killed gauge refuses stakes -> deposits fail closed
        _deposit(bob, 1_000e6);
    }

    function test_constructorRejectsKilledGauge() public {
        address council = IVoterAdmin(VOTER).emergencyCouncil();
        vm.prank(council);
        IVoterAdmin(VOTER).killGauge(EXPECTED_GAUGE);
        vm.expectRevert(AerodromeUsdcWethStrategy.BadConfig.selector);
        new AerodromeUsdcWethStrategy(address(vault), owner, ROUTER, IAeroVoter(VOTER), USDC, WETH, AERO);
    }
}
