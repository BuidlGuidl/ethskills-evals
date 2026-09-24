// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LendingPool} from "../src/LendingPool.sol";
import {ChainlinkOracle} from "../src/oracle/ChainlinkOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";

import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract LendingPoolTest is Test {
    MockERC20 weth;
    MockERC20 usdc;
    MockAggregator feed;
    ChainlinkOracle oracle;
    LendingPool pool;

    address owner = address(0xA11CE);
    address alice = address(0xB0B);
    address liquidator = address(0xC0FFEE);

    uint256 constant ETH_PRICE_8DEC = 2_000e8;

    function setUp() public {
        vm.warp(1_700_000_000);

        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        feed = new MockAggregator(8, int256(ETH_PRICE_8DEC));

        oracle = new ChainlinkOracle(owner, IAggregatorV3(address(feed)), 1 hours, 100e18, 100_000e18);

        pool = new LendingPool(
            owner, IERC20(address(weth)), IERC20(address(usdc)), IPriceOracle(address(oracle)),
            7_000, 8_500, 500, 5_000, 500, 100e6
        );

        // Seed pool liquidity.
        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(pool), type(uint256).max);
        pool.fund(1_000_000e6);

        // Alice deposits 10 WETH ( = $20,000 ).
        weth.mint(alice, 10 ether);
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.depositCollateral(10 ether, alice);
        vm.stopPrank();

        usdc.mint(liquidator, 1_000_000e6);
        vm.prank(liquidator);
        usdc.approve(address(pool), type(uint256).max);
    }

    function _setPrice(uint256 priceUsd) internal {
        feed.setAnswer(int256(priceUsd * 1e8));
    }

    /*//////////////////////////////////////////////////////////////
                              CORE FLOWS
    //////////////////////////////////////////////////////////////*/

    function test_borrowUpToLtvAndNoFurther() public {
        // 10 WETH * $2000 = $20,000 collateral -> 70% = 14,000 USDC.
        assertEq(pool.maxBorrow(alice), 14_000e6);

        vm.prank(alice);
        pool.borrow(14_000e6, alice);
        assertEq(usdc.balanceOf(alice), 14_000e6);

        vm.prank(alice);
        vm.expectRevert();
        pool.borrow(1e6, alice);
    }

    function test_interestAccruesAtFlatAnnualRate() public {
        vm.prank(alice);
        pool.borrow(10_000e6, alice);

        vm.warp(block.timestamp + 365 days);

        // 5% APR flat on 10,000 USDC.
        assertApproxEqAbs(pool.debtOf(alice), 10_500e6, 1);
    }

    function test_repayAndWithdrawAll() public {
        vm.prank(alice);
        pool.borrow(10_000e6, alice);

        vm.warp(block.timestamp + 30 days);

        uint256 debt = pool.debtOf(alice);
        usdc.mint(alice, debt); // interest funding
        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        pool.repay(type(uint256).max, alice);
        assertEq(pool.debtOf(alice), 0);

        pool.withdrawCollateral(10 ether, alice);
        vm.stopPrank();

        assertEq(weth.balanceOf(alice), 10 ether);
        assertEq(pool.totalDebtShares(), 0);
    }

    function test_withdrawBlockedWhileItWouldBreachLtv() public {
        vm.prank(alice);
        pool.borrow(14_000e6, alice);

        vm.prank(alice);
        vm.expectRevert();
        pool.withdrawCollateral(1 ether, alice);
    }

    /*//////////////////////////////////////////////////////////////
                              LIQUIDATION
    //////////////////////////////////////////////////////////////*/

    function test_notLiquidatableWhileHealthy() public {
        vm.prank(alice);
        pool.borrow(14_000e6, alice);

        assertFalse(pool.isLiquidatable(alice));

        vm.prank(liquidator);
        vm.expectRevert(LendingPool.PositionHealthy.selector);
        pool.liquidate(alice, 1_000e6, 0, liquidator);
    }

    function test_liquidationSeizesDebtValuePlusFivePercentBonus() public {
        vm.prank(alice);
        pool.borrow(14_000e6, alice);

        // Drop ETH to $1,600 -> collateral $16,000, debt/value = 87.5% > 85%.
        _setPrice(1_600);
        assertTrue(pool.isLiquidatable(alice));

        uint256 repay = 1_000e6;
        uint256 collateralBefore = weth.balanceOf(liquidator);

        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = pool.liquidate(alice, repay, 0, liquidator);

        assertEq(repaid, repay);
        // 1000 USDC / 1600 = 0.625 WETH, +5% = 0.65625 WETH.
        assertEq(seized, 0.65625 ether);
        assertEq(weth.balanceOf(liquidator) - collateralBefore, seized);

        (uint256 coll, uint256 debt) = pool.positionOf(alice);
        assertEq(coll, 10 ether - 0.65625 ether);
        assertApproxEqAbs(debt, 13_000e6, 1);
    }

    function test_closeFactorCapsASingleLiquidation() public {
        vm.prank(alice);
        pool.borrow(14_000e6, alice);
        _setPrice(1_600);

        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(alice, 7_001e6, 0, liquidator);

        vm.prank(liquidator);
        (uint256 repaid,) = pool.liquidate(alice, type(uint256).max, 0, liquidator);
        assertApproxEqAbs(repaid, 7_000e6, 1);
    }

    function test_seizeCappedAtCollateralWhenDeeplyUnderwater() public {
        vm.prank(alice);
        pool.borrow(14_000e6, alice);

        // Collapse to $1,200: collateral $12,000 < debt $14,000. Insolvent.
        _setPrice(1_200);

        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = pool.liquidate(alice, type(uint256).max, 0, liquidator);

        // Liquidator cannot take more than the collateral that exists...
        assertEq(seized, 10 ether);
        // ...and is charged only for what the collateral is worth net of the bonus.
        assertApproxEqAbs(repaid, uint256(12_000e6) * 10_000 / 10_500, 1);

        (uint256 coll, uint256 debt) = pool.positionOf(alice);
        assertEq(coll, 0);
        assertGt(debt, 0); // bad debt remains

        vm.prank(owner);
        pool.writeOffBadDebt(alice);
        assertEq(pool.debtOf(alice), 0);
        assertEq(pool.totalDebtShares(), 0);
    }

    function test_liquidatorSlippageGuard() public {
        vm.prank(alice);
        pool.borrow(14_000e6, alice);
        _setPrice(1_600);

        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(alice, 1_000e6, 1 ether, liquidator);
    }

    /*//////////////////////////////////////////////////////////////
                                ORACLE
    //////////////////////////////////////////////////////////////*/

    function test_stalePriceBlocksBorrowing() public {
        vm.warp(block.timestamp + 2 hours);

        vm.prank(alice);
        vm.expectRevert();
        pool.borrow(1_000e6, alice);
    }

    function test_priceOutsideBoundsReverts() public {
        feed.setAnswer(int256(uint256(1e8))); // $1 ETH, below the $100 floor
        vm.expectRevert();
        oracle.price();
    }

    function test_debtFreeUserCanExitEvenWhenOracleIsDown() public {
        vm.warp(block.timestamp + 30 days); // feed now stale

        vm.prank(alice);
        pool.withdrawCollateral(10 ether, alice);
        assertEq(weth.balanceOf(alice), 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                             ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    function test_onlyOwnerCanMoveLiquidityAndSetParams() public {
        vm.expectRevert();
        pool.withdrawLiquidity(1e6, alice);

        vm.expectRevert();
        pool.setBorrowRate(1_000);

        vm.prank(owner);
        pool.setBorrowRate(1_000);
        assertEq(pool.borrowRateBps(), 1_000);
    }

    function test_riskParamConfigIsBounded() public {
        vm.startPrank(owner);
        // LTV must sit below the liquidation threshold.
        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setRiskParams(8_500, 8_500, 500, 5_000);

        // threshold * (1 + bonus) must not exceed 100%.
        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setRiskParams(7_000, 9_900, 2_000, 5_000);
        vm.stopPrank();
    }

    function test_pauseStopsNewRiskButNotExits() public {
        vm.prank(alice);
        pool.borrow(10_000e6, alice);

        vm.prank(owner);
        pool.pause();

        vm.prank(alice);
        vm.expectRevert();
        pool.borrow(1e6, alice);

        // Repaying still works while paused.
        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        pool.repay(1_000e6, alice);
        vm.stopPrank();
    }
}
