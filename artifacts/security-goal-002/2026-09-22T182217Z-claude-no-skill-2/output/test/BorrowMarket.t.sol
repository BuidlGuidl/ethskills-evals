// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BorrowMarket} from "../src/BorrowMarket.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract BorrowMarketTest is Test {
    MockERC20 weth;
    MockERC20 usdc;
    MockAggregator feed;
    ChainlinkOracle oracle;
    BorrowMarket market;

    address owner = address(0xA11CE);
    address lender = address(0xBEEF);
    address alice = address(0xA1);
    address bob = address(0xB0B);

    uint256 constant ETH = 1e18;
    uint256 constant USD = 1e6;

    function setUp() public {
        vm.warp(1_700_000_000);

        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        feed = new MockAggregator(2000e8);
        oracle = new ChainlinkOracle(address(feed), 1 hours, 100e18, 100_000e18);

        market = new BorrowMarket({
            owner_: owner,
            collateralToken_: address(weth),
            borrowToken_: address(usdc),
            oracle_: address(oracle),
            ratePerYear_: 0.05e18,
            maxLtvBps_: 7000,
            liquidationThresholdBps_: 8500,
            liquidationBonusBps_: 500,
            minDebt_: 100 * USD
        });

        _fund(lender, 0, 5_000_000 * USD);
        _fund(alice, 100 * ETH, 1_000_000 * USD);
        _fund(bob, 100 * ETH, 1_000_000 * USD);

        vm.prank(lender);
        market.deposit(1_000_000 * USD, lender);
    }

    function _fund(address who, uint256 wethAmt, uint256 usdcAmt) internal {
        if (wethAmt > 0) {
            weth.mint(who, wethAmt);
            vm.prank(who);
            weth.approve(address(market), type(uint256).max);
        }
        if (usdcAmt > 0) {
            usdc.mint(who, usdcAmt);
            vm.prank(who);
            usdc.approve(address(market), type(uint256).max);
        }
    }

    /*//////////////////////////////////////////////////////////////
                             BORROW / LTV
    //////////////////////////////////////////////////////////////*/

    function test_borrowUpToMaxLtv() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        // 10 WETH * $2000 = $20,000; 70% => $14,000
        assertEq(market.maxBorrowable(alice), 14_000 * USD);
        market.borrow(14_000 * USD, alice);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 1_014_000 * USD);
        assertEq(market.debtOf(alice), 14_000 * USD);
        assertFalse(market.isLiquidatable(alice));
    }

    function test_borrowAboveMaxLtvReverts() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        vm.expectRevert();
        market.borrow(14_001 * USD, alice);
        vm.stopPrank();
    }

    function test_borrowWithoutCollateralReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        market.borrow(1000 * USD, alice);
    }

    function test_borrowBeyondLiquidityReverts() public {
        vm.startPrank(alice);
        market.depositCollateral(100 * ETH, alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                BorrowMarket.InsufficientLiquidity.selector, 1_000_001 * USD, 1_000_000 * USD
            )
        );
        market.borrow(1_000_001 * USD, alice);
        vm.stopPrank();
    }

    function test_dustDebtRejected() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        vm.expectRevert();
        market.borrow(1 * USD, alice);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                               INTEREST
    //////////////////////////////////////////////////////////////*/

    function test_interestAccruesAtFlatRate() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(10_000 * USD, alice);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        // 5% simple interest on 10,000 => 10,500
        assertApproxEqAbs(market.debtOf(alice), 10_500 * USD, 1);

        // Interest belongs to lenders.
        market.accrueInterest();
        assertApproxEqAbs(market.totalAssets(), 1_000_500 * USD, 1);
    }

    function test_interestDoesNotAccrueWithoutBorrowers() public {
        uint256 indexBefore = market.borrowIndex();
        vm.warp(block.timestamp + 365 days);
        market.accrueInterest();
        assertEq(market.borrowIndex(), indexBefore);
    }

    /*//////////////////////////////////////////////////////////////
                          REPAY / WITHDRAW
    //////////////////////////////////////////////////////////////*/

    function test_repayFullThenWithdrawAll() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(10_000 * USD, alice);

        vm.warp(block.timestamp + 30 days);
        market.repay(type(uint256).max, alice);
        assertEq(market.debtOf(alice), 0);
        assertEq(market.debtShares(alice), 0);

        market.withdrawCollateral(10 * ETH, alice);
        vm.stopPrank();

        assertEq(weth.balanceOf(alice), 100 * ETH);
        assertEq(market.totalDebtShares(), 0);
    }

    function test_withdrawCollateralBreakingLtvReverts() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(14_000 * USD, alice);
        vm.expectRevert();
        market.withdrawCollateral(1, alice);
        vm.stopPrank();
    }

    function test_partialRepayIntoDustReverts() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(1000 * USD, alice);
        vm.expectRevert();
        market.repay(950 * USD, alice); // would leave $50 < minDebt
        vm.stopPrank();
    }

    function test_lenderWithdrawsWithInterest() public {
        vm.startPrank(alice);
        market.depositCollateral(20 * ETH, alice);
        market.borrow(20_000 * USD, alice);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        vm.prank(alice);
        market.repay(type(uint256).max, alice);

        vm.prank(lender);
        uint256 got = market.withdraw(type(uint256).max, lender);
        assertApproxEqAbs(got, 1_001_000 * USD, 10); // 5% of 20k for a year
        assertEq(market.totalSupplyShares(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                              LIQUIDATION
    //////////////////////////////////////////////////////////////*/

    function test_liquidateAtThreshold() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(14_000 * USD, alice); // $20k collateral, 70% LTV
        vm.stopPrank();

        // Drop ETH to $1600 => collateral $16,000, threshold debt = $13,600 < $14,000 debt.
        feed.setAnswer(1600e8);
        assertTrue(market.isLiquidatable(alice));

        uint256 repay = 7_000 * USD;
        vm.prank(bob);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, repay, 0);

        assertEq(repaid, repay);
        // $7,000 * 1.05 / $1600 = 4.59375 WETH
        assertEq(seized, 4.59375 ether);
        assertEq(weth.balanceOf(bob), 100 * ETH + seized);
        assertEq(market.debtOf(alice), 7_000 * USD);
        assertEq(market.collateralOf(alice), 10 * ETH - seized);
    }

    function test_liquidateHealthyReverts() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(14_000 * USD, alice);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert();
        market.liquidate(alice, 1000 * USD, 0);
    }

    function test_liquidationCappedByCollateralAndSlippageGuard() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(14_000 * USD, alice);
        vm.stopPrank();

        // Deeply underwater: $800/ETH => collateral worth $8,000 vs $14,000 debt.
        feed.setAnswer(800e8);

        // Liquidator demanding more than the position holds is protected.
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.SlippageExceeded.selector, 10 ether, 11 ether));
        market.liquidate(alice, type(uint256).max, 11 ether);

        vm.prank(bob);
        (, uint256 seized) = market.liquidate(alice, type(uint256).max, 0);
        assertEq(seized, 10 * ETH); // capped at available collateral
        assertEq(market.debtOf(alice), 0);
        assertEq(market.collateralOf(alice), 0);
    }

    function test_liquidationCannotSeizeMoreThanBonusAllows() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(14_000 * USD, alice);
        vm.stopPrank();
        feed.setAnswer(1600e8);

        vm.prank(bob);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, type(uint256).max, 0);
        // Full $14,000 at $1600 with 5% bonus = 9.1875 WETH, less than the 10 posted.
        assertEq(repaid, 14_000 * USD);
        assertEq(seized, 9.1875 ether);
        assertEq(market.collateralOf(alice), 10 * ETH - 9.1875 ether);
    }

    /*//////////////////////////////////////////////////////////////
                           ORACLE SAFETY
    //////////////////////////////////////////////////////////////*/

    function test_stalePriceBlocksBorrow() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours);
        vm.prank(alice);
        vm.expectRevert();
        market.borrow(1000 * USD, alice);
    }

    function test_negativeOrZeroPriceReverts() public {
        feed.setAnswer(0);
        vm.expectRevert();
        oracle.collateralPriceUsd();
    }

    function test_priceOutOfBandReverts() public {
        feed.setAnswer(1_000_000e8);
        vm.expectRevert();
        oracle.collateralPriceUsd();
    }

    function test_incompleteRoundReverts() public {
        feed.setAnsweredInRound(0);
        vm.expectRevert();
        oracle.collateralPriceUsd();
    }

    function test_collateralWithdrawalWorksWithNoDebtEvenIfOracleDown() public {
        vm.prank(alice);
        market.depositCollateral(5 * ETH, alice);

        vm.warp(block.timestamp + 10 days); // feed now very stale
        vm.prank(alice);
        market.withdrawCollateral(5 * ETH, alice);
        assertEq(weth.balanceOf(alice), 100 * ETH);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNTING / ADMIN
    //////////////////////////////////////////////////////////////*/

    function test_donationDoesNotMoveSharePrice() public {
        uint256 assetsBefore = market.totalAssets();
        usdc.mint(address(market), 500_000 * USD);
        assertEq(market.totalAssets(), assetsBefore);

        vm.prank(alice);
        uint256 shares = market.deposit(1_000 * USD, alice);
        // Same rate as the founding lender: no donation-based inflation.
        assertEq(shares, 1_000 * USD * 1e6);
    }

    function test_skimCannotTakeUserFunds() public {
        vm.prank(alice);
        market.depositCollateral(10 * ETH, alice);

        vm.prank(owner);
        vm.expectRevert(BorrowMarket.NothingToSkim.selector);
        market.skim(address(weth), owner);

        weth.mint(address(market), 3 * ETH);
        vm.prank(owner);
        uint256 amount = market.skim(address(weth), owner);
        assertEq(amount, 3 * ETH);
        assertEq(market.collateralOf(alice), 10 * ETH);
    }

    function test_onlyOwnerAdmin() public {
        vm.startPrank(alice);
        vm.expectRevert();
        market.setRatePerYear(0.1e18);
        vm.expectRevert();
        market.setOracle(address(oracle));
        vm.expectRevert();
        market.setBorrowingPaused(true);
        vm.stopPrank();
    }

    function test_rateCap() public {
        vm.prank(owner);
        vm.expectRevert(BorrowMarket.RateTooHigh.selector);
        market.setRatePerYear(1e18 + 1);
    }

    function test_pauseStopsNewDebtNotRepayOrLiquidate() public {
        vm.startPrank(alice);
        market.depositCollateral(10 * ETH, alice);
        market.borrow(14_000 * USD, alice);
        vm.stopPrank();

        vm.prank(owner);
        market.setBorrowingPaused(true);

        vm.prank(alice);
        vm.expectRevert(BorrowMarket.BorrowingIsPaused.selector);
        market.borrow(1, alice);

        feed.setAnswer(1600e8);
        vm.prank(bob);
        market.liquidate(alice, 7_000 * USD, 0);

        vm.prank(alice);
        market.repay(type(uint256).max, alice);
        assertEq(market.debtOf(alice), 0);
    }

    /*//////////////////////////////////////////////////////////////
                                 FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @dev Cash plus debt must always equal what lenders can claim, and the contract must
    ///      never hold less than it owes.
    function testFuzz_solvencyInvariant(uint256 collateral, uint256 borrowAmt, uint256 warpBy) public {
        collateral = bound(collateral, 1 ether, 100 ether);
        uint256 limit = collateral * 2000 * 7 / 10 / 1e12; // 70% of value, USDC units
        borrowAmt = bound(borrowAmt, 100 * USD, limit);
        warpBy = bound(warpBy, 0, 3650 days);

        vm.startPrank(alice);
        market.depositCollateral(collateral, alice);
        market.borrow(borrowAmt, alice);
        vm.stopPrank();

        vm.warp(block.timestamp + warpBy);
        market.accrueInterest();

        assertGe(usdc.balanceOf(address(market)), market.usdcCash());
        assertGe(weth.balanceOf(address(market)), market.totalCollateral());
        assertGe(market.debtOf(alice), borrowAmt);
    }
}
