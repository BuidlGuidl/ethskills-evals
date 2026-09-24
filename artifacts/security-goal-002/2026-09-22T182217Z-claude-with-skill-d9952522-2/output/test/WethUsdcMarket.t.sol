// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {WethUsdcMarket} from "../src/WethUsdcMarket.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {MockToken, MockFeed} from "./mocks/Mocks.sol";

contract WethUsdcMarketTest is Test {
    MockToken usdc;
    MockToken weth;
    MockFeed feed;
    WethUsdcMarket market;

    address owner = address(0xA11CE);
    address lender = address(0xBEEF);
    address bob = address(0xB0B);
    address liquidator = address(0xC0FFEE);

    uint256 constant PRICE = 2000e8; // $2000 / ETH

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockToken("USD Coin", "USDC", 6);
        weth = new MockToken("Wrapped Ether", "WETH", 18);
        feed = new MockFeed(int256(PRICE));
        market = new WethUsdcMarket(IERC20(address(usdc)), IERC20(address(weth)), IAggregatorV3(address(feed)), 500, 75 minutes, owner);

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(bob, 100_000e6);
        usdc.mint(liquidator, 1_000_000e6);
        weth.mint(bob, 1_000e18);

        vm.startPrank(lender);
        usdc.approve(address(market), type(uint256).max);
        market.deposit(500_000e6, lender);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(market), type(uint256).max);
        weth.approve(address(market), type(uint256).max);
        vm.stopPrank();

        vm.prank(liquidator);
        usdc.approve(address(market), type(uint256).max);
    }

    function _bobDeposits(uint256 amount) internal {
        vm.prank(bob);
        market.depositCollateral(amount, bob);
    }

    function test_valuationUnits() public view {
        assertEq(market.collateralValue(1e18), 2000e6);
        assertEq(market.collateralForDebt(2000e6), 1e18);
    }

    function test_borrowUpToMaxLtv() public {
        _bobDeposits(10e18); // $20,000
        assertEq(market.maxBorrow(bob), 14_000e6);

        vm.prank(bob);
        market.borrow(14_000e6, bob);
        assertEq(usdc.balanceOf(bob), 114_000e6);

        vm.prank(bob);
        vm.expectRevert(WethUsdcMarket.PositionUnhealthy.selector);
        market.borrow(1e6, bob);
    }

    function test_withdrawBlockedWhenItBreaksLtv() public {
        _bobDeposits(10e18);
        vm.startPrank(bob);
        market.borrow(14_000e6, bob);
        vm.expectRevert(WethUsdcMarket.PositionUnhealthy.selector);
        market.withdrawCollateral(1e18, bob);
        vm.stopPrank();
    }

    function test_interestAccruesFlatly() public {
        _bobDeposits(10e18);
        vm.prank(bob);
        market.borrow(10_000e6, bob);

        vm.warp(block.timestamp + 365 days);
        // 5% flat APR on 10,000 USDC.
        assertApproxEqAbs(market.debtOf(bob), 10_500e6, 1);
        // Lender's claim grew by the same interest.
        assertApproxEqAbs(market.totalAssets(), 500_000e6 + 500e6, 2);
    }

    function test_repayAndWithdrawAll() public {
        _bobDeposits(10e18);
        vm.startPrank(bob);
        market.borrow(10_000e6, bob);
        vm.warp(block.timestamp + 180 days);
        market.repay(type(uint256).max, bob);
        assertEq(market.debtOf(bob), 0);
        assertEq(market.totalScaledDebt(), 0);
        market.withdrawCollateral(10e18, bob);
        vm.stopPrank();
        assertEq(weth.balanceOf(bob), 1_000e18);
    }

    function test_liquidationSeizesWithBonus() public {
        _bobDeposits(10e18);
        vm.prank(bob);
        market.borrow(14_000e6, bob); // 70% LTV at $2000

        // ETH to $1600: collateral $16,000, debt/value = 87.5% > 85%.
        feed.set(1600e8, block.timestamp);
        assertTrue(market.isLiquidatable(bob));

        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = market.liquidate(bob, type(uint256).max, liquidator);

        assertEq(repaid, 7_000e6); // 50% close factor
        assertEq(seized, uint256(7_000e6) * 10_500 / 10_000 * 1e18 / 1600e6); // +5% bonus
        assertEq(weth.balanceOf(liquidator), seized);
        assertApproxEqAbs(market.debtOf(bob), 7_000e6, 1);
        assertFalse(market.isLiquidatable(bob));
    }

    function test_cannotLiquidateHealthy() public {
        _bobDeposits(10e18);
        vm.prank(bob);
        market.borrow(14_000e6, bob);
        vm.prank(liquidator);
        vm.expectRevert(WethUsdcMarket.PositionHealthy.selector);
        market.liquidate(bob, 1_000e6, liquidator);
    }

    function test_insolventPositionCapsSeizureAtCollateral() public {
        _bobDeposits(10e18);
        vm.prank(bob);
        market.borrow(14_000e6, bob);

        feed.set(1000e8, block.timestamp); // collateral $10,000 < debt $14,000
        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = market.liquidate(bob, type(uint256).max, liquidator);

        assertEq(seized, 10e18); // all collateral
        assertApproxEqAbs(repaid, uint256(10_000e6) * 10_000 / 10_500, 1);
        (uint256 collLeft,) = market.positionOf(bob);
        assertEq(collLeft, 0);
    }

    function test_stalePriceBlocksBorrow() public {
        _bobDeposits(10e18);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(WethUsdcMarket.StalePrice.selector, feed.updatedAt()));
        market.borrow(1_000e6, bob);
    }

    function test_negativePriceReverts() public {
        feed.set(-1, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(WethUsdcMarket.InvalidPrice.selector, int256(-1)));
        market.collateralPrice();
    }

    function test_lenderWithdrawLimitedByCash() public {
        _bobDeposits(250e18);
        vm.prank(bob);
        market.borrow(300_000e6, bob);
        assertEq(market.maxWithdraw(lender), 200_000e6);
    }

    function test_onlyOwnerAdmin() public {
        vm.expectRevert();
        market.setBorrowRate(100);
        vm.prank(owner);
        market.setBorrowRate(100);
        assertEq(market.borrowRateBps(), 100);
    }

    function test_donationDoesNotStealFromFirstDepositor() public {
        WethUsdcMarket fresh = new WethUsdcMarket(IERC20(address(usdc)), IERC20(address(weth)), IAggregatorV3(address(feed)), 500, 75 minutes, owner);
        vm.startPrank(bob);
        usdc.approve(address(fresh), type(uint256).max);
        fresh.deposit(1, bob); // attacker seeds 1 wei
        usdc.transfer(address(fresh), 10_000e6); // and donates
        vm.stopPrank();

        vm.startPrank(lender);
        usdc.approve(address(fresh), type(uint256).max);
        uint256 shares = fresh.deposit(20_000e6, lender);
        vm.stopPrank();
        assertGt(shares, 0);
        // Victim recovers essentially all of their deposit.
        assertGe(fresh.previewRedeem(shares), 19_990e6);
    }
}
