// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BorrowMarket} from "../src/BorrowMarket.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract BorrowMarketTest is Test {
    MockERC20 weth;
    MockERC20 usdc;
    MockAggregator ethFeed;
    MockAggregator usdcFeed;
    ChainlinkOracle oracle;
    BorrowMarket market;

    address owner = makeAddr("owner");
    address lp = makeAddr("liquidityManager");
    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");

    uint32 constant HEARTBEAT = 1 hours;

    function setUp() public {
        vm.warp(1_700_000_000);

        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        ethFeed = new MockAggregator(8, 2000e8);
        usdcFeed = new MockAggregator(8, 1e8);

        oracle = new ChainlinkOracle(address(this));
        oracle.setFeed(address(weth), IAggregatorV3(address(ethFeed)), HEARTBEAT, 100e8, 100_000e8);
        oracle.setFeed(address(usdc), IAggregatorV3(address(usdcFeed)), 24 hours, 0.9e8, 1.1e8);

        market = new BorrowMarket(
            owner, IERC20(address(weth)), IERC20(address(usdc)), oracle, lp, 0.05e18, 7000, 8500, 500, 5000, 100e6
        );

        usdc.mint(lp, 10_000_000e6);
        vm.startPrank(lp);
        usdc.approve(address(market), type(uint256).max);
        market.fund(1_000_000e6);
        vm.stopPrank();

        weth.mint(alice, 100e18);
        vm.prank(alice);
        weth.approve(address(market), type(uint256).max);

        usdc.mint(keeper, 1_000_000e6);
        vm.prank(keeper);
        usdc.approve(address(market), type(uint256).max);
    }

    function _deposit(uint256 amount) internal {
        vm.prank(alice);
        market.depositCollateral(amount, alice);
    }

    /* ----------------------------- borrow limits ---------------------------- */

    function test_borrowUpToSeventyPercentLtv() public {
        _deposit(10e18); // $20,000 of collateral

        assertEq(market.collateralValueOf(alice), 20_000e6);
        assertEq(market.availableToBorrow(alice), 14_000e6);

        vm.prank(alice);
        market.borrow(14_000e6, alice);

        assertEq(usdc.balanceOf(alice), 14_000e6);
        assertEq(market.debtOf(alice), 14_000e6);
        assertEq(market.availableToBorrow(alice), 0);
    }

    function test_borrowAboveLtvReverts() public {
        _deposit(10e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.PositionUnhealthy.selector, 14_000e6 + 1, 14_000e6));
        market.borrow(14_000e6 + 1, alice);
    }

    function test_borrowBeyondLiquidityReverts() public {
        _deposit(100e18);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BorrowMarket.InsufficientLiquidity.selector, 1_000_001e6, 1_000_000e6)
        );
        market.borrow(1_000_001e6, alice);
    }

    /* ------------------------------- interest ------------------------------- */

    function test_interestAccruesAtFlatRate() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(10_000e6, alice);

        vm.warp(block.timestamp + 365 days);
        market.accrue();

        // 5% flat on 10,000 USDC, within a wei of rounding.
        assertApproxEqAbs(market.debtOf(alice), 10_500e6, 1);
    }

    function test_idleTimeDoesNotInflateIndex() public {
        vm.warp(block.timestamp + 365 days);
        market.accrue();
        assertEq(market.borrowIndex(), 1e18);

        ethFeed.setAnswer(2000e8); // refresh the feed after the warp
        usdcFeed.setAnswer(1e8);
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(10_000e6, alice);
        assertEq(market.debtOf(alice), 10_000e6);
    }

    /* -------------------------------- repay --------------------------------- */

    function test_repayMaxClearsPositionExactly() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(10_000e6, alice);

        vm.warp(block.timestamp + 180 days);
        usdc.mint(alice, 1_000e6);

        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        uint256 repaid = market.repay(type(uint256).max, alice);
        vm.stopPrank();

        assertGt(repaid, 10_000e6);
        assertEq(market.debtOf(alice), 0);
        assertEq(market.totalScaledDebt(), 0);

        // Collateral is fully recoverable once the debt is gone.
        vm.prank(alice);
        market.withdrawCollateral(10e18, alice);
        assertEq(weth.balanceOf(alice), 100e18);
    }

    function test_repayLeavingDustReverts() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(10_000e6, alice);

        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.DebtBelowMinimum.selector, 50e6, 100e6));
        market.repay(9_950e6, alice);
        vm.stopPrank();
    }

    /* ------------------------------ withdrawal ------------------------------ */

    function test_withdrawBlockedWhenItWouldBreachLtv() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        vm.prank(alice);
        vm.expectRevert();
        market.withdrawCollateral(1, alice);
    }

    function test_debtFreeWithdrawWorksWithBrokenOracle() public {
        _deposit(10e18);
        vm.warp(block.timestamp + 10 days); // feed goes stale

        vm.prank(alice);
        market.withdrawCollateral(10e18, alice);
        assertEq(weth.balanceOf(alice), 100e18);
    }

    /* ----------------------------- liquidation ------------------------------ */

    function test_healthyPositionCannotBeLiquidated() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.PositionHealthy.selector, 14_000e6, 17_000e6));
        market.liquidate(alice, 1_000e6, keeper);
    }

    function test_liquidationSeizesCollateralPlusFivePercentBonus() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        // ETH to $1,600: collateral worth 16,000, threshold 13,600 < 14,000 debt.
        ethFeed.setAnswer(1600e8);
        assertTrue(market.isLiquidatable(alice));

        uint256 keeperWethBefore = weth.balanceOf(keeper);

        vm.prank(keeper);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, type(uint256).max, keeper);

        // Close factor caps the repayment at half the debt.
        assertEq(repaid, 7_000e6);
        // 7,000 USDC / 1,600 = 4.375 WETH, plus 5% = 4.59375 WETH.
        assertEq(seized, 4.59375e18);
        assertEq(weth.balanceOf(keeper) - keeperWethBefore, seized);

        assertEq(market.debtOf(alice), 7_000e6);
        assertEq(market.collateralOf(alice), 10e18 - 4.59375e18);
        assertFalse(market.isLiquidatable(alice));
    }

    function test_liquidationAboveCloseFactorIsCapped() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(14_000e6, alice);
        ethFeed.setAnswer(1600e8);

        vm.prank(keeper);
        (uint256 repaid,) = market.liquidate(alice, 9_000e6, keeper);
        assertEq(repaid, 7_000e6);
    }

    function test_deeplyUnderwaterPositionSeizesAllCollateralAndLeavesBadDebt() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        // ETH to $1,000: collateral worth 10,000 against 14,000 of debt.
        ethFeed.setAnswer(1000e8);

        vm.prank(keeper);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, type(uint256).max, keeper);

        assertEq(seized, 10e18);
        assertEq(market.collateralOf(alice), 0);
        // Liquidator pays only what the collateral is worth net of the bonus: 10,000 / 1.05.
        assertApproxEqAbs(repaid, 9_523_809_523, 1);
        assertEq(market.debtOf(alice), 14_000e6 - repaid);
    }

    /* ------------------------------- oracle --------------------------------- */

    function test_staleFeedBlocksBorrow() public {
        _deposit(10e18);
        vm.warp(block.timestamp + HEARTBEAT + 1);

        vm.prank(alice);
        vm.expectRevert();
        market.borrow(1_000e6, alice);
    }

    function test_negativeAnswerRejected() public {
        ethFeed.setAnswer(-1);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.BadPrice.selector, address(weth)));
        oracle.getAssetPrice(address(weth));
    }

    function test_answerOutsideSanityBandRejected() public {
        ethFeed.setAnswer(99e8);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.BadPrice.selector, address(weth)));
        oracle.getAssetPrice(address(weth));
    }

    function test_incompleteRoundRejected() public {
        ethFeed.setAnsweredInRound(0);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.BadPrice.selector, address(weth)));
        oracle.getAssetPrice(address(weth));
    }

    function test_usdcDepegRaisesBorrowingPower() public {
        _deposit(10e18);
        usdcFeed.setAnswer(0.95e8);
        // Collateral is worth more USDC when USDC is worth less.
        assertGt(market.collateralValueOf(alice), 20_000e6);
    }

    /* --------------------------------- admin -------------------------------- */

    function test_onlyLiquidityManagerCanMoveLiquidity() public {
        vm.prank(alice);
        vm.expectRevert(BorrowMarket.NotLiquidityManager.selector);
        market.withdrawLiquidity(1e6, alice);
    }

    function test_liquidityManagerCannotDrainBorrowedFunds() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        vm.prank(lp);
        vm.expectRevert();
        market.withdrawLiquidity(1_000_000e6, lp);
    }

    function test_skimCannotTouchAccountedBalances() public {
        _deposit(10e18);
        weth.mint(address(market), 1e18); // donation

        vm.prank(owner);
        uint256 skimmed = market.skim(IERC20(address(weth)), owner);
        assertEq(skimmed, 1e18);
        assertEq(market.collateralOf(alice), 10e18);

        vm.prank(owner);
        vm.expectRevert(BorrowMarket.ZeroAmount.selector);
        market.skim(IERC20(address(weth)), owner);
    }

    function test_pauseStopsBorrowsButNotRepayOrLiquidate() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        vm.prank(owner);
        market.pause();

        vm.prank(alice);
        vm.expectRevert();
        market.borrow(1e6, alice);

        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        market.repay(1_000e6, alice);
        vm.stopPrank();
        assertEq(market.debtOf(alice), 13_000e6);

        // Topping up collateral stays open while paused.
        vm.prank(alice);
        market.depositCollateral(1e18, alice);
        assertEq(market.collateralOf(alice), 11e18);
    }

    function test_riskParamsMustKeepLiquidationSolvent() public {
        vm.prank(owner);
        vm.expectRevert(BorrowMarket.InvalidParams.selector);
        market.setRiskParams(0.05e18, 7000, 9500, 2000, 5000, 100e6); // 9500 * 1.20 > 100%
    }

    function test_rateChangeIsNotRetroactive() public {
        _deposit(10e18);
        vm.prank(alice);
        market.borrow(10_000e6, alice);

        vm.warp(block.timestamp + 365 days);
        vm.prank(owner);
        market.setRiskParams(1e18, 7000, 8500, 500, 5000, 100e6); // jump to 100% APR

        // The elapsed year is still charged at 5%.
        assertApproxEqAbs(market.debtOf(alice), 10_500e6, 1);
    }
}
