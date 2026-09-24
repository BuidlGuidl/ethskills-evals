// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {LendingMarket} from "../src/LendingMarket.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract LendingMarketTest is Test {
    MockERC20 weth;
    MockERC20 usdc;
    MockAggregator ethFeed;
    MockAggregator usdcFeed;
    ChainlinkOracle oracle;
    LendingMarket market;

    address owner = address(0xA11CE);
    address lender = address(0xB0B);
    address borrower = address(0xCAFE);
    address liquidator = address(0xDEAD);

    uint256 constant ETH_PRICE = 2000e8; // $2000

    function setUp() public {
        vm.warp(1_700_000_000);

        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        ethFeed = new MockAggregator(8, int256(ETH_PRICE));
        usdcFeed = new MockAggregator(8, 1e8);

        oracle = new ChainlinkOracle(
            AggregatorV3Interface(address(ethFeed)), 1 hours, AggregatorV3Interface(address(usdcFeed)), 1 days
        );
        market = new LendingMarket(IERC20(address(weth)), IERC20(address(usdc)), oracle, 500, owner);

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(liquidator, 1_000_000e6);
        usdc.mint(borrower, 1_000_000e6);
        weth.mint(borrower, 100e18);

        vm.prank(lender);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(borrower);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(borrower);
        weth.approve(address(market), type(uint256).max);
        vm.prank(liquidator);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(lender);
        market.supply(500_000e6);
    }

    function _openPosition(uint256 collateral, uint256 debt) internal {
        vm.startPrank(borrower);
        market.depositCollateral(collateral, borrower);
        market.borrow(debt, borrower);
        vm.stopPrank();
    }

    function test_borrowUpToSeventyPercentLtv() public {
        vm.prank(borrower);
        market.depositCollateral(10e18, borrower); // $20,000 collateral

        assertEq(market.maxBorrowable(borrower), 14_000e6);

        vm.prank(borrower);
        market.borrow(14_000e6, borrower);
        assertEq(usdc.balanceOf(borrower), 1_000_000e6 + 14_000e6);
    }

    function test_borrowAboveLtvReverts() public {
        vm.prank(borrower);
        market.depositCollateral(10e18, borrower);

        vm.prank(borrower);
        vm.expectRevert(LendingMarket.PositionUnhealthy.selector);
        market.borrow(14_000e6 + 1, borrower);
    }

    function test_interestAccruesAtFlatRate() public {
        _openPosition(10e18, 10_000e6);

        vm.warp(block.timestamp + 365 days);
        // 5% flat annual on 10,000 USDC.
        assertApproxEqAbs(market.debtOf(borrower), 10_500e6, 1);
    }

    function test_repayAndWithdrawCollateral() public {
        _openPosition(10e18, 10_000e6);
        vm.warp(block.timestamp + 30 days);

        vm.startPrank(borrower);
        market.repay(type(uint256).max, borrower);
        assertEq(market.debtOf(borrower), 0);
        market.withdrawCollateral(10e18, borrower);
        vm.stopPrank();

        assertEq(weth.balanceOf(borrower), 100e18);
        // Lenders earned the interest.
        assertGt(market.totalAssets(), 500_000e6);
    }

    function test_withdrawCollateralBreakingLtvReverts() public {
        _openPosition(10e18, 14_000e6);

        vm.prank(borrower);
        vm.expectRevert(LendingMarket.PositionUnhealthy.selector);
        market.withdrawCollateral(1, borrower);
    }

    function test_healthyPositionCannotBeLiquidated() public {
        _openPosition(10e18, 14_000e6);

        vm.prank(liquidator);
        vm.expectRevert(LendingMarket.PositionHealthy.selector);
        market.liquidate(borrower, 1_000e6, 0, liquidator);
    }

    function test_liquidationSeizesCollateralPlusBonus() public {
        _openPosition(10e18, 14_000e6); // $20k collateral, $14k debt

        // ETH to $1600 -> collateral $16,000, debt/collateral = 87.5% > 85%.
        ethFeed.setAnswer(1600e8);
        assertTrue(market.isLiquidatable(borrower));
        assertLt(market.healthFactor(borrower), 1e18);

        uint256 repay = 1_000e6;
        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = market.liquidate(borrower, repay, 0, liquidator);

        assertEq(repaid, repay);
        // $1000 * 1.05 / $1600 = 0.65625 WETH
        assertEq(seized, 0.65625e18);
        assertEq(weth.balanceOf(liquidator), seized);
        assertApproxEqAbs(market.debtOf(borrower), 13_000e6, 1);
        assertEq(market.collateralOf(borrower), 10e18 - seized);
    }

    function test_liquidationIsCappedByCloseFactor() public {
        _openPosition(10e18, 14_000e6);
        ethFeed.setAnswer(1600e8);

        vm.prank(liquidator);
        (uint256 repaid,) = market.liquidate(borrower, type(uint128).max, 0, liquidator);
        assertApproxEqAbs(repaid, 7_000e6, 1); // 50% of the debt
    }

    function test_liquidationCannotSeizeMoreThanCollateral() public {
        _openPosition(10e18, 14_000e6);
        // Deeply underwater: collateral worth less than the debt.
        ethFeed.setAnswer(1000e8);

        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint128).max, 0, liquidator);

        assertEq(seized, 10e18); // all of it
        assertLe(repaid, 14_000e6);
        assertEq(market.collateralOf(borrower), 0);
    }

    function test_liquidationRespectsMinCollateralOut() public {
        _openPosition(10e18, 14_000e6);
        ethFeed.setAnswer(1600e8);

        vm.prank(liquidator);
        vm.expectRevert(abi.encodeWithSelector(LendingMarket.SlippageExceeded.selector, 0.65625e18, 1e18));
        market.liquidate(borrower, 1_000e6, 1e18, liquidator);
    }

    function test_stalePriceBlocksBorrowing() public {
        vm.prank(borrower);
        market.depositCollateral(10e18, borrower);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(borrower);
        vm.expectRevert();
        market.borrow(1_000e6, borrower);
    }

    function test_negativePriceReverts() public {
        ethFeed.setAnswer(-1);
        vm.expectRevert();
        oracle.collateralPrice();
    }

    function test_supplyWithdrawRoundTripAndInflationResistance() public {
        // Donation to an (almost) empty pool cannot round the next depositor down to zero shares.
        address attacker = address(0xBEEF);
        usdc.mint(attacker, 1_000e6 + 1);
        vm.startPrank(attacker);
        usdc.approve(address(market), type(uint256).max);
        market.supply(1);
        usdc.transfer(address(market), 1_000e6); // direct donation
        vm.stopPrank();

        address victim = address(0xFEED);
        usdc.mint(victim, 2_000e6);
        vm.startPrank(victim);
        usdc.approve(address(market), type(uint256).max);
        uint256 shares = market.supply(2_000e6);
        vm.stopPrank();

        assertGt(shares, 0);
        vm.prank(victim);
        uint256 assetsOut = market.withdraw(shares, victim);
        assertApproxEqRel(assetsOut, 2_000e6, 0.01e18);
    }

    function test_onlyOwnerCanSetRateAndPause() public {
        vm.expectRevert();
        market.setBorrowRate(100);

        vm.prank(owner);
        market.setBorrowRate(100);
        assertEq(market.borrowRateBps(), 100);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(LendingMarket.RateTooHigh.selector, 5_001));
        market.setBorrowRate(5_001);
    }

    function test_pauseBlocksBorrowingButNotRepayOrWithdraw() public {
        _openPosition(10e18, 10_000e6);

        vm.prank(owner);
        market.pause();

        vm.prank(borrower);
        vm.expectRevert();
        market.borrow(1, borrower);

        // Users are never trapped: repaying and exiting still work while paused.
        vm.startPrank(borrower);
        market.repay(type(uint256).max, borrower);
        market.withdrawCollateral(10e18, borrower);
        vm.stopPrank();

        vm.prank(lender);
        market.withdraw(1e6, lender);
    }
}
