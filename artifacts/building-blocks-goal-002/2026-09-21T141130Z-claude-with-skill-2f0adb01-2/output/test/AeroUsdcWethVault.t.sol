// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {IAeroRouter, IAeroPool, IAeroGauge} from "../src/interfaces/IAerodrome.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {MockERC20, MockFeed, MockPool, MockRouter, MockGauge} from "./mocks/Mocks.sol";

contract AeroUsdcWethVaultTest is Test {
    MockERC20 usdc;
    MockERC20 weth;
    MockERC20 aero;
    MockPool pool;
    MockPool aeroPool;
    MockRouter router;
    MockGauge gauge;
    MockFeed ethFeed;
    MockFeed usdcFeed;
    MockFeed seqFeed;
    AeroUsdcWethVault vault;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");

    function setUp() public {
        vm.warp(1_750_000_000);
        usdc = new MockERC20("USDC", 6);
        weth = new MockERC20("WETH", 18);
        aero = new MockERC20("AERO", 18);

        router = new MockRouter();
        pool = new MockPool(address(weth), address(usdc));
        aeroPool = new MockPool(address(aero), address(usdc));
        router.register(pool);
        router.register(aeroPool);
        gauge = new MockGauge(IERC20(address(pool)), aero);

        // WETH/USDC at $3000, AERO/USDC at $1
        _seed(pool, weth, 10_000e18, 30_000_000e6);
        _seed(aeroPool, aero, 10_000_000e18, 10_000_000e6);

        ethFeed = new MockFeed();
        usdcFeed = new MockFeed();
        seqFeed = new MockFeed();
        ethFeed.set(3000e8, block.timestamp, block.timestamp);
        usdcFeed.set(1e8, block.timestamp, block.timestamp);
        seqFeed.set(0, block.timestamp - 2 hours, block.timestamp);

        vault = new AeroUsdcWethVault(
            AeroUsdcWethVault.Config({
                usdc: usdc,
                weth: weth,
                aero: aero,
                router: IAeroRouter(address(router)),
                pool: IAeroPool(address(pool)),
                gauge: IAeroGauge(address(gauge)),
                ethUsdFeed: AggregatorV3Interface(address(ethFeed)),
                usdcUsdFeed: AggregatorV3Interface(address(usdcFeed)),
                sequencerFeed: AggregatorV3Interface(address(seqFeed)),
                ethUsdMaxAge: 1 hours,
                usdcUsdMaxAge: 1 days,
                owner: owner,
                keeper: keeper,
                treasury: treasury,
                depositCap: 1_000_000e6
            })
        );
    }

    // ------------------------------------------------------------------ helpers

    function _seed(MockPool p, MockERC20 other, uint256 otherAmt, uint256 usdcAmt) internal {
        other.mint(address(p), otherAmt);
        usdc.mint(address(p), usdcAmt);
        p.mint(address(0xdead));
    }

    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
        usdc.mint(user, amount);
        vm.startPrank(user);
        usdc.approve(address(vault), amount);
        shares = vault.deposit(amount, user);
        vm.stopPrank();
    }

    function _harvest(uint256 minOut) internal {
        vm.prank(keeper);
        vault.harvest(minOut);
    }

    function _swap(address who, MockERC20 from, MockERC20 to, uint256 amount) internal {
        from.mint(who, amount);
        vm.startPrank(who);
        from.approve(address(router), amount);
        MockRouter.Route[] memory r = new MockRouter.Route[](1);
        r[0] = MockRouter.Route(address(from), address(to), false, address(router));
        router.swapExactTokensForTokens(amount, 0, r, who, block.timestamp);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ deposit / invest

    function test_depositStaysIdleUntilHarvest() public {
        _deposit(alice, 10_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
        assertEq(usdc.balanceOf(address(vault)), 10_000e6);
        assertEq(vault.totalLp(), 0);
        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(alice)), 10_000e6, 1);
    }

    function test_harvestInvestsIdleIntoStakedLp() public {
        _deposit(alice, 100_000e6);
        _harvest(0);

        assertGt(gauge.balanceOf(address(vault)), 0, "LP staked");
        assertEq(pool.balanceOf(address(vault)), 0, "no unstaked LP");
        // ~5% buffer stays idle
        assertApproxEqRel(usdc.balanceOf(address(vault)), 5_000e6, 0.02e18);
        // Only the swap fee on half the amount (~0.15%) plus small price impact is lost
        assertApproxEqRel(vault.totalAssets(), 100_000e6, 0.005e18);
        assertLe(vault.totalAssets(), 100_000e6);
    }

    function test_investCappedByPoolDepth() public {
        _deposit(alice, 900_000e6);
        _harvest(0);
        // half capped at 0.25% of the 30M USDC reserve -> 150k invested per harvest
        assertApproxEqRel(vault.totalAssets() - usdc.balanceOf(address(vault)), 150_000e6, 0.01e18);
        // arbitrageurs move the pool back to the oracle price between harvests
        _swap(attacker, weth, usdc, 25e18);
        _harvest(0);
        assertApproxEqRel(vault.totalAssets() - usdc.balanceOf(address(vault)), 300_000e6, 0.01e18);
    }

    function test_harvestCompoundsRewards() public {
        _deposit(alice, 100_000e6);
        _harvest(0);
        uint256 before = vault.totalAssets();

        gauge.accrue(address(vault), 1_000e18); // ~$1000 of AERO
        vm.prank(keeper);
        uint256 profit = vault.harvest(990e6);

        assertApproxEqRel(profit, 1_000e6, 0.005e18); // 0.3% pool fee
        assertEq(usdc.balanceOf(treasury), profit / 10, "10% performance fee");
        assertApproxEqRel(vault.totalAssets(), before + profit * 9 / 10, 0.001e18);
        assertEq(aero.balanceOf(address(vault)), 0);
        assertEq(vault.lastHarvest(), block.timestamp);
    }

    function test_harvestRevertsBelowMinOut() public {
        _deposit(alice, 100_000e6);
        _harvest(0);
        gauge.accrue(address(vault), 1_000e18);
        vm.prank(keeper);
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        vault.harvest(1_100e6);
    }

    function test_harvestOnlyKeeperOrOwner() public {
        vm.prank(alice);
        vm.expectRevert(AeroUsdcWethVault.NotKeeper.selector);
        vault.harvest(0);

        vm.prank(owner);
        vault.harvest(0);
    }

    // ------------------------------------------------------------------ withdraw

    function test_redeemUnwindsLp() public {
        uint256 shares = _deposit(alice, 100_000e6);
        _harvest(0);

        uint256 expected = vault.previewRedeem(shares);
        vm.prank(alice);
        uint256 got = vault.redeem(shares, alice, alice);

        assertEq(got, expected);
        assertEq(usdc.balanceOf(alice), got);
        // lost: exit fee 0.3% + invest swap fee ~0.15%
        assertApproxEqRel(got, 100_000e6, 0.006e18);
        assertEq(vault.totalSupply(), 0);
    }

    function test_withdrawMaxWithdraw() public {
        _deposit(alice, 50_000e6);
        _deposit(bob, 50_000e6);
        _harvest(0);

        uint256 maxW = vault.maxWithdraw(alice);
        vm.prank(alice);
        vault.withdraw(maxW, alice, alice);
        assertEq(usdc.balanceOf(alice), maxW);
        assertLe(vault.balanceOf(alice), 1e6); // at most rounding dust in shares
    }

    function test_exitFeeAccruesToRemainingHolders() public {
        _deposit(alice, 50_000e6);
        uint256 bobShares = _deposit(bob, 50_000e6);
        uint256 aliceValueBefore = vault.convertToAssets(vault.balanceOf(alice));

        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);

        assertApproxEqAbs(usdc.balanceOf(bob), uint256(50_000e6) * 10_000 / 10_030, 2);
        assertGt(vault.convertToAssets(vault.balanceOf(alice)), aliceValueBefore);
    }

    function test_smallWithdrawServedFromBuffer() public {
        _deposit(alice, 100_000e6);
        _harvest(0);
        uint256 lpBefore = vault.totalLp();
        vm.prank(alice);
        vault.withdraw(1_000e6, alice, alice);
        assertEq(vault.totalLp(), lpBefore, "no unwind needed");
    }

    // ------------------------------------------------------------------ attacks

    /// Pool spot manipulation must not change share price and must block invest/unwind.
    function test_spotManipulationDoesNotMoveSharePrice() public {
        _deposit(alice, 100_000e6);
        _harvest(0);
        uint256 assetsBefore = vault.totalAssets();

        // Attacker dumps 3000 WETH (~30% of reserves) into the pool.
        _swap(attacker, weth, usdc, 3_000e18);

        // Fair LP pricing: value barely moves (only by the fees the attacker paid into k).
        assertApproxEqRel(vault.totalAssets(), assetsBefore, 0.001e18);
        assertGe(vault.totalAssets(), assetsBefore);

        // Unwind and invest refuse to trade against a manipulated pool.
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectPartialRevert(AeroUsdcWethVault.PriceDeviation.selector);
        vault.redeem(aliceShares, alice, alice);

        _deposit(bob, 100_000e6);
        vm.prank(keeper);
        vm.expectPartialRevert(AeroUsdcWethVault.PriceDeviation.selector);
        vault.harvest(0);
    }

    function test_inflationAttackUnprofitable() public {
        // Attacker deposits 1 wei then donates a large amount to inflate the share price.
        _deposit(attacker, 1);
        usdc.mint(attacker, 10_000e6);
        vm.prank(attacker);
        usdc.transfer(address(vault), 10_000e6);

        _deposit(alice, 10_000e6);
        assertGt(vault.balanceOf(alice), 0);
        // Alice keeps essentially all her deposit; attacker cannot steal it.
        assertApproxEqRel(vault.convertToAssets(vault.balanceOf(alice)), 10_000e6, 0.0001e18);
    }

    function test_jitHarvestSnipingUnprofitable() public {
        _deposit(alice, 100_000e6);
        _harvest(0);

        // A week of emissions: ~0.2% of TVL.
        gauge.accrue(address(vault), 200e18);

        // Sniper deposits right before harvest and exits right after.
        uint256 shares = _deposit(attacker, 100_000e6);
        _harvest(0);
        vm.prank(attacker);
        uint256 out = vault.redeem(shares, attacker, attacker);
        assertLt(out, 100_000e6, "sniping must lose money");
    }

    // ------------------------------------------------------------------ oracle safety

    function test_staleEthFeedReverts() public {
        _deposit(alice, 100_000e6);
        _harvest(0);
        ethFeed.set(3000e8, block.timestamp, block.timestamp - 2 hours);
        vm.expectRevert(abi.encodeWithSelector(AeroUsdcWethVault.StaleOracle.selector, address(ethFeed)));
        vault.totalAssets();
    }

    function test_sequencerDownReverts() public {
        _deposit(alice, 100_000e6);
        _harvest(0);
        seqFeed.set(1, block.timestamp, block.timestamp);
        vm.expectRevert(AeroUsdcWethVault.SequencerDown.selector);
        vault.totalAssets();

        // Back up but still inside grace period.
        seqFeed.set(0, block.timestamp - 10 minutes, block.timestamp);
        vm.expectRevert(AeroUsdcWethVault.SequencerDown.selector);
        vault.totalAssets();
    }

    function test_idleOnlyVaultNeedsNoOracle() public {
        _deposit(alice, 1_000e6);
        ethFeed.set(3000e8, block.timestamp, 0);
        assertEq(vault.totalAssets(), 1_000e6);
    }

    // ------------------------------------------------------------------ admin

    function test_depositCap() public {
        vm.prank(owner);
        vault.setDepositCap(1_000e6);
        assertEq(vault.maxDeposit(alice), 1_000e6);

        usdc.mint(alice, 1_001e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_001e6);
        vm.expectPartialRevert(ERC4626.ERC4626ExceededMaxDeposit.selector);
        vault.deposit(1_001e6, alice);
        vm.stopPrank();
    }

    function test_pauseBlocksDepositsNotWithdrawals() public {
        uint256 shares = _deposit(alice, 1_000e6);
        vm.prank(owner);
        vault.pause();

        assertEq(vault.maxDeposit(bob), 0);
        usdc.mint(bob, 1e6);
        vm.startPrank(bob);
        usdc.approve(address(vault), 1e6);
        vm.expectPartialRevert(ERC4626.ERC4626ExceededMaxDeposit.selector);
        vault.deposit(1e6, bob);
        vm.stopPrank();

        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertGt(usdc.balanceOf(alice), 0);
    }

    function test_emergencyExitWorksWithBrokenOracle() public {
        uint256 shares = _deposit(alice, 100_000e6);
        _harvest(0);

        ethFeed.set(0, 0, 0); // oracle dead
        vm.prank(owner);
        vault.emergencyExit(94_000e6); // min for the unwound part; 5k buffer was already idle

        assertTrue(vault.paused());
        assertEq(vault.totalLp(), 0);
        assertEq(weth.balanceOf(address(vault)), 0);

        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);
        assertApproxEqRel(out, 100_000e6, 0.01e18);
    }

    function test_emergencyExitMinOut() public {
        _deposit(alice, 100_000e6);
        _harvest(0);
        vm.prank(owner);
        vm.expectPartialRevert(AeroUsdcWethVault.SlippageExceeded.selector);
        vault.emergencyExit(100_000e6);
    }

    function test_adminBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(AeroUsdcWethVault.InvalidParam.selector);
        vault.setFees(2_001, 30);
        vm.expectRevert(AeroUsdcWethVault.InvalidParam.selector);
        vault.setFees(1_000, 101);
        vm.expectRevert(AeroUsdcWethVault.InvalidParam.selector);
        vault.setRiskParams(0, 100, 500);
        vm.expectRevert(AeroUsdcWethVault.ZeroAddress.selector);
        vault.setKeeper(address(0));
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert();
        vault.setFees(0, 0);
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_depositHarvestRedeem(uint256 a, uint256 b) public {
        a = bound(a, 20e6, 400_000e6);
        b = bound(b, 1e6, 400_000e6);
        uint256 sa = _deposit(alice, a);
        _harvest(0);
        uint256 sb = _deposit(bob, b);

        vm.prank(alice);
        uint256 outA = vault.redeem(sa, alice, alice);
        vm.prank(bob);
        uint256 outB = vault.redeem(sb, bob, bob);

        // No yield here: total out <= total in (alice's exit fee may accrue to bob); losses stay small.
        assertLe(outA, a);
        assertLe(outA + outB, a + b);
        assertGe(outA, a * 985 / 1000);
        assertGe(outB, b * 985 / 1000);
    }
}
