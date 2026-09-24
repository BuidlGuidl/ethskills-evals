// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {MockERC20, FeeOnTransferERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract LendingPoolTest is Test {
    MockERC20 weth;
    MockERC20 usdc;
    MockAggregator ethFeed;
    MockAggregator usdcFeed;
    ChainlinkPriceOracle ethOracle;
    ChainlinkPriceOracle usdcOracle;
    LendingPool pool;

    address owner = address(0xA11CE);
    address alice = address(0xB0B);
    address liquidator = address(0xC0FFEE);

    function setUp() public {
        vm.warp(1_700_000_000);

        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        ethFeed = new MockAggregator(8, 2000e8);
        usdcFeed = new MockAggregator(8, 1e8);

        ethOracle = new ChainlinkPriceOracle(IAggregatorV3(address(ethFeed)), 3600, 100e18, 100_000e18);
        usdcOracle = new ChainlinkPriceOracle(IAggregatorV3(address(usdcFeed)), 86_400, 0.9e18, 1.1e18);

        pool = new LendingPool(
            LendingPool.Params({
                collateralToken: IERC20(address(weth)),
                debtToken: IERC20(address(usdc)),
                collateralOracle: ethOracle,
                debtOracle: usdcOracle,
                maxLtvBps: 7_000,
                liquidationThresholdBps: 8_500,
                liquidationBonusBps: 500,
                closeFactorBps: 5_000,
                annualRateWad: 0.05e18,
                minDebt: 100e6,
                owner: owner
            })
        );

        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(pool), type(uint256).max);
        pool.supplyLiquidity(1_000_000e6);

        weth.mint(alice, 100e18);
        usdc.mint(alice, 100_000e6);
        usdc.mint(liquidator, 100_000e6);

        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.prank(liquidator);
        usdc.approve(address(pool), type(uint256).max);
    }

    function _depositAndBorrow(uint256 collateral, uint256 debt) internal {
        vm.startPrank(alice);
        pool.depositCollateral(collateral, alice);
        pool.borrow(debt, alice);
        vm.stopPrank();
    }

    function test_borrowUpToLtvAndNoFurther() public {
        // 10 WETH @ $2000 = $20,000 collateral -> 70% = 14,000 USDC.
        _depositAndBorrow(10e18, 14_000e6);
        assertEq(pool.debtOf(alice), 14_000e6);

        vm.prank(alice);
        vm.expectRevert();
        pool.borrow(1e6, alice);
    }

    function test_interestAccrues() public {
        _depositAndBorrow(10e18, 10_000e6);
        vm.warp(block.timestamp + 365 days);
        ethFeed.setAnswer(2000e8);
        usdcFeed.setAnswer(1e8);
        // 5% flat for a year, index untouched in between.
        assertApproxEqAbs(pool.debtOf(alice), 10_500e6, 1);
    }

    function test_repayAndWithdraw() public {
        _depositAndBorrow(10e18, 10_000e6);

        vm.startPrank(alice);
        pool.repay(type(uint256).max, alice);
        assertEq(pool.debtOf(alice), 0);
        pool.withdrawCollateral(10e18, alice);
        vm.stopPrank();

        assertEq(weth.balanceOf(alice), 100e18);
        assertEq(pool.totalCollateral(), 0);
    }

    function test_withdrawBlockedWhenItBreaksLtv() public {
        _depositAndBorrow(10e18, 14_000e6);
        vm.prank(alice);
        vm.expectRevert();
        pool.withdrawCollateral(1e18, alice);
    }

    function test_healthyPositionCannotBeLiquidated() public {
        _depositAndBorrow(10e18, 14_000e6);
        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(alice, 1_000e6, 0, liquidator);
    }

    function test_liquidationSeizesRepayValuePlusBonus() public {
        _depositAndBorrow(10e18, 14_000e6);

        // ETH to $1600 -> collateral $16,000, threshold $13,600 < debt $14,000.
        ethFeed.setAnswer(1600e8);
        assertTrue(pool.isLiquidatable(alice));

        uint256 wethBefore = weth.balanceOf(liquidator);
        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = pool.liquidate(alice, type(uint256).max, 0, liquidator);

        // Close factor caps the repayment at half the debt.
        assertEq(repaid, 7_000e6);
        // $7,000 * 1.05 / $1600 = 4.59375 WETH.
        assertEq(seized, 4.59375e18);
        assertEq(weth.balanceOf(liquidator) - wethBefore, seized);
        assertEq(pool.debtOf(alice), 7_000e6);
        (uint256 collateral,) = pool.positionOf(alice);
        assertEq(collateral, 10e18 - seized);
    }

    function test_liquidationCapsAtAvailableCollateral() public {
        _depositAndBorrow(10e18, 14_000e6);
        // Deep crash: collateral worth less than the debt.
        ethFeed.setAnswer(1000e8); // $10,000 collateral vs $14,000 debt

        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = pool.liquidate(alice, type(uint256).max, 0, liquidator);

        // Cannot seize more than exists, and pays only for what it got.
        assertEq(seized, 10e18);
        assertLe(repaid, 14_000e6);
        // $10,000 of collateral at a 5% bonus buys ~$9,523.81 of debt.
        assertApproxEqAbs(repaid, 9_523_809_523, 10);
        (uint256 collateral,) = pool.positionOf(alice);
        assertEq(collateral, 0);
    }

    function test_liquidatorSlippageBound() public {
        _depositAndBorrow(10e18, 14_000e6);
        ethFeed.setAnswer(1600e8);
        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(alice, 1_000e6, 100e18, liquidator);
    }

    function test_stalePriceBlocksBorrow() public {
        vm.prank(alice);
        pool.depositCollateral(10e18, alice);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(alice);
        vm.expectRevert();
        pool.borrow(1_000e6, alice);
    }

    function test_depegOutsideBoundsBlocksBorrow() public {
        vm.prank(alice);
        pool.depositCollateral(10e18, alice);

        usdcFeed.setAnswer(0.5e8);
        vm.prank(alice);
        vm.expectRevert();
        pool.borrow(1_000e6, alice);
    }

    function test_negativePriceRejected() public {
        vm.prank(alice);
        pool.depositCollateral(10e18, alice);
        ethFeed.setAnswer(-1);
        vm.prank(alice);
        vm.expectRevert();
        pool.borrow(1_000e6, alice);
    }

    function test_collateralDonationDoesNotInflateAnyPosition() public {
        _depositAndBorrow(10e18, 14_000e6);
        weth.mint(address(pool), 1_000e18);

        (uint256 collateral,) = pool.positionOf(alice);
        assertEq(collateral, 10e18);
        assertEq(pool.totalCollateral(), 10e18);

        // Donation does not make an unhealthy position healthy either.
        ethFeed.setAnswer(1600e8);
        assertTrue(pool.isLiquidatable(alice));
    }

    function test_feeOnTransferTokenIsRejected() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20();
        LendingPool feePool = new LendingPool(
            LendingPool.Params({
                collateralToken: IERC20(address(fee)),
                debtToken: IERC20(address(usdc)),
                collateralOracle: ethOracle,
                debtOracle: usdcOracle,
                maxLtvBps: 7_000,
                liquidationThresholdBps: 8_500,
                liquidationBonusBps: 500,
                closeFactorBps: 5_000,
                annualRateWad: 0.05e18,
                minDebt: 100e6,
                owner: owner
            })
        );
        fee.mint(alice, 10e18);
        vm.startPrank(alice);
        fee.approve(address(feePool), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(LendingPool.InexactTransfer.selector, 1e18, 0.99e18));
        feePool.depositCollateral(1e18, alice);
        vm.stopPrank();
    }

    function test_dustDebtIsRefused() public {
        _depositAndBorrow(10e18, 10_000e6);
        vm.prank(alice);
        vm.expectRevert();
        pool.repay(10_000e6 - 1e6, alice); // would leave 1 USDC of debt, below minDebt
    }

    function test_onlyOwnerCanWithdrawLiquidityAndPause() public {
        vm.expectRevert();
        pool.withdrawLiquidity(1e6, alice);
        vm.expectRevert();
        pool.pause();

        vm.prank(owner);
        pool.pause();

        vm.prank(alice);
        vm.expectRevert();
        pool.depositCollateral(1e18, alice);
    }

    function test_pauseDoesNotTrapBorrowersOrLiquidators() public {
        _depositAndBorrow(10e18, 14_000e6);
        vm.prank(owner);
        pool.pause();

        // Repay and withdraw stay open.
        vm.startPrank(alice);
        pool.repay(type(uint256).max, alice);
        pool.withdrawCollateral(10e18, alice);
        vm.stopPrank();
        assertEq(pool.debtOf(alice), 0);
    }

    function test_ownerCannotTouchCollateral() public {
        _depositAndBorrow(10e18, 14_000e6);
        // withdrawLiquidity only ever moves the debt token.
        uint256 idle = usdc.balanceOf(address(pool));
        vm.prank(owner);
        pool.withdrawLiquidity(idle, owner);
        assertEq(weth.balanceOf(address(pool)), 10e18);
    }

    function testFuzz_liquidationNeverSeizesMoreValueThanRepaidPlusBonus(uint256 priceE8, uint256 repayAmount) public {
        priceE8 = bound(priceE8, 900e8, 1_900e8);
        repayAmount = bound(repayAmount, 1e6, 20_000e6);

        _depositAndBorrow(10e18, 14_000e6);
        ethFeed.setAnswer(int256(priceE8));
        if (!pool.isLiquidatable(alice)) return;

        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = pool.liquidate(alice, repayAmount, 0, liquidator);

        uint256 seizedValue = seized * (priceE8 * 1e10) / 1e18; // 18-dec USD
        uint256 repaidValue = repaid * 1e18 / 1e6;
        // Seized value must not exceed the repaid value grossed up by the bonus (plus rounding).
        assertLe(seizedValue, repaidValue * 10_500 / 10_000 + 1e12);
    }
}
