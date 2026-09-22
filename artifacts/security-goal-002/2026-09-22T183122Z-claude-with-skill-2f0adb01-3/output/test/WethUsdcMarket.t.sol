// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {WethUsdcMarket} from "../src/WethUsdcMarket.sol";
import {MockERC20, MockAggregator} from "./mocks/Mocks.sol";

contract WethUsdcMarketTest is Test {
    WethUsdcMarket market;
    MockERC20 weth;
    MockERC20 usdc;
    MockAggregator feed;

    address owner = address(0xA11CE);
    address alice = address(0xA);
    address bob = address(0xB);

    int256 constant ETH_2000 = 2000e8;

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        feed = new MockAggregator(ETH_2000);

        market = new WethUsdcMarket(
            owner, address(weth), address(usdc), address(feed), 500, 3900, 100e8, 100_000e8, 500e6
        );

        usdc.mint(owner, 10_000_000e6);
        vm.startPrank(owner);
        usdc.approve(address(market), type(uint256).max);
        market.addLiquidity(5_000_000e6);
        vm.stopPrank();

        weth.mint(alice, 100e18);
        usdc.mint(bob, 1_000_000e6);

        vm.prank(alice);
        weth.approve(address(market), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
    }

    function _depositAndBorrow(uint256 coll, uint256 debt) internal {
        vm.startPrank(alice);
        market.deposit(coll, alice);
        market.borrow(debt, alice);
        vm.stopPrank();
    }

    /*//////////////////////// valuation & decimals ////////////////////////*/

    function test_collateralValueHandlesDecimals() public {
        vm.prank(alice);
        market.deposit(10e18, alice);
        // 10 WETH * $2000 = $20,000, expressed in USDC's 6 decimals.
        assertEq(market.collateralValueOf(alice), 20_000e6);
    }

    function test_maxBorrowIs70Percent() public {
        vm.prank(alice);
        market.deposit(10e18, alice);
        assertEq(market.maxBorrowable(alice), 14_000e6); // 70% of $20,000
    }

    function test_borrowAboveLtvReverts() public {
        vm.startPrank(alice);
        market.deposit(10e18, alice);
        vm.expectRevert(WethUsdcMarket.PositionUnhealthy.selector);
        market.borrow(14_000e6 + 1, alice);
        vm.stopPrank();
    }

    /*//////////////////////////// interest ////////////////////////////*/

    function test_interestAccruesAtFlatAnnualRate() public {
        _depositAndBorrow(10e18, 10_000e6);
        assertEq(market.debtOf(alice), 10_000e6);

        vm.warp(block.timestamp + 365 days);
        // 5% flat annual on 10,000 USDC == 10,500 USDC.
        assertEq(market.debtOf(alice), 10_500e6);
    }

    function test_viewMatchesStateAfterAccrue() public {
        _depositAndBorrow(10e18, 10_000e6);
        vm.warp(block.timestamp + 180 days);
        uint256 previewed = market.debtOf(alice);
        market.accrue();
        assertEq(market.debtOf(alice), previewed);
    }

    /*//////////////////////// repay & withdraw ////////////////////////*/

    function test_fullRepayClearsDebtExactly() public {
        _depositAndBorrow(10e18, 10_000e6);
        vm.warp(block.timestamp + 90 days);

        uint256 debt = market.debtOf(alice);
        usdc.mint(alice, debt);
        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        uint256 paid = market.repay(type(uint256).max, alice);
        vm.stopPrank();

        assertEq(paid, debt);
        assertEq(market.debtOf(alice), 0);
        assertEq(market.totalScaledDebt(), 0);
    }

    function test_withdrawAllWhenNoDebt() public {
        vm.startPrank(alice);
        market.deposit(10e18, alice);
        market.withdraw(10e18, alice);
        vm.stopPrank();
        assertEq(weth.balanceOf(alice), 100e18);
    }

    function test_withdrawBlockedBeyondMaxLtv() public {
        _depositAndBorrow(10e18, 14_000e6);
        vm.prank(alice);
        vm.expectRevert(WethUsdcMarket.PositionUnhealthy.selector);
        market.withdraw(1, alice);
    }

    /*//////////////////////////// liquidation ////////////////////////////*/

    function test_healthyPositionCannotBeLiquidated() public {
        _depositAndBorrow(10e18, 14_000e6);
        vm.prank(bob);
        vm.expectRevert(WethUsdcMarket.PositionHealthy.selector);
        market.liquidate(alice, 1000e6, bob);
    }

    function test_liquidationPaysFivePercentBonus() public {
        _depositAndBorrow(10e18, 14_000e6); // $20k collateral, $14k debt

        // ETH -> $1600: collateral $16,000, debt/collateral = 87.5% > 85%.
        feed.setAnswer(1600e8);
        assertTrue(market.isLiquidatable(alice));

        uint256 repayAmount = 5_000e6;
        uint256 expectedSeize = (5_000e6 * 10_500 * 1e18 * 1e8) / (10_000 * 1e6 * 1600e8);

        vm.prank(bob);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, repayAmount, bob);

        assertEq(repaid, repayAmount);
        assertEq(seized, expectedSeize);
        assertEq(weth.balanceOf(bob), expectedSeize);
        // Seized collateral is worth 105% of the repayment.
        assertApproxEqRel((seized * 1600e8 * 1e6) / (1e18 * 1e8), (repayAmount * 105) / 100, 1e12);
        assertEq(market.debtOf(alice), 14_000e6 - 5_000e6);
    }

    function test_closeFactorCapsLiquidation() public {
        _depositAndBorrow(10e18, 14_000e6);
        feed.setAnswer(1600e8);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(WethUsdcMarket.RepayExceedsCloseFactor.selector, 7_000e6 + 1, 7_000e6)
        );
        market.liquidate(alice, 7_000e6 + 1, bob);
    }

    function test_underwaterLiquidationCapsSeizureAtCollateral() public {
        _depositAndBorrow(1e18, 1_400e6); // $2000 collateral, $1400 debt
        // Collateral now worth $700 against $1400 of debt. The 700 USDC the close factor allows
        // would buy 1.05 WETH with the bonus, but only 1 WETH exists -- so the cap must bite.
        feed.setAnswer(700e8);

        uint256 bobUsdcBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, 700e6, bob);

        // Seizure is capped at the collateral actually present, and the liquidator is charged
        // only for what it received rather than the full requested repayment.
        assertEq(seized, 1e18);
        assertLt(repaid, 700e6);
        assertEq(bobUsdcBefore - usdc.balanceOf(bob), repaid);
        assertEq(weth.balanceOf(bob), 1e18);
        // Charged 1 WETH worth of value ($700) discounted by the 5% bonus.
        assertEq(repaid, uint256(700e6) * 10_000 / 10_500 + 1); // rounded up, in the pool's favour
        // The shortfall stays on the books as bad debt.
        assertGt(market.debtOf(alice), 0);
    }

    /*//////////////////////////// oracle ////////////////////////////*/

    function test_stalePriceReverts() public {
        vm.prank(alice);
        market.deposit(10e18, alice);
        vm.warp(block.timestamp + 4000);
        vm.prank(alice);
        vm.expectRevert();
        market.borrow(1_000e6, alice);
    }

    function test_priceOutOfSanityBandReverts() public {
        vm.prank(alice);
        market.deposit(10e18, alice);
        feed.setAnswer(99e8); // below the $100 floor
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WethUsdcMarket.PriceOutOfBounds.selector, 99e8));
        market.borrow(1_000e6, alice);
    }

    function test_negativePriceReverts() public {
        vm.prank(alice);
        market.deposit(10e18, alice);
        feed.setAnswer(-1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WethUsdcMarket.PriceOutOfBounds.selector, 0));
        market.borrow(1_000e6, alice);
    }

    /*//////////////////////// access control & pause ////////////////////////*/

    function test_onlyOwnerCanMoveLiquidity() public {
        vm.prank(bob);
        vm.expectRevert();
        market.removeLiquidity(1e6, bob);
    }

    function test_sweepCannotTouchMarketAssets() public {
        vm.startPrank(owner);
        vm.expectRevert(WethUsdcMarket.InvalidParameter.selector);
        market.sweep(address(weth), owner);
        vm.expectRevert(WethUsdcMarket.InvalidParameter.selector);
        market.sweep(address(usdc), owner);
        vm.stopPrank();
    }

    function test_pauseStopsBorrowsButNotExits() public {
        _depositAndBorrow(10e18, 10_000e6);

        vm.prank(owner);
        market.setBorrowPaused(true);

        vm.prank(alice);
        vm.expectRevert(WethUsdcMarket.BorrowsPaused.selector);
        market.borrow(1e6, alice);

        // Repay and withdraw still work while paused -- a pause must never trap funds.
        usdc.mint(alice, 20_000e6);
        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        market.repay(type(uint256).max, alice);
        market.withdraw(10e18, alice);
        vm.stopPrank();
        assertEq(weth.balanceOf(alice), 100e18);
    }

    /*//////////////////////////// invariants ////////////////////////////*/

    /// @dev Rounding must never let a borrower retire more debt than they paid for.
    function testFuzz_repayNeverCreditsMoreThanPaid(uint256 borrowAmount, uint256 repayAmount, uint256 elapsed)
        public
    {
        borrowAmount = bound(borrowAmount, 500e6, 14_000e6);
        elapsed = bound(elapsed, 0, 365 days);

        _depositAndBorrow(10e18, borrowAmount);
        vm.warp(block.timestamp + elapsed);

        uint256 debtBefore = market.debtOf(alice);
        repayAmount = bound(repayAmount, 500e6, debtBefore);
        vm.assume(debtBefore - repayAmount == 0 || debtBefore - repayAmount >= 500e6);

        vm.prank(bob);
        uint256 paid = market.repay(repayAmount, alice);

        uint256 debtAfter = market.debtOf(alice);
        // Debt retired is never more than the USDC actually handed over.
        assertLe(debtBefore - debtAfter, paid);
    }

    /// @dev A liquidation must always leave the position no worse off in debt-to-collateral terms
    ///      than the bonus accounts for, and must never seize more than is there.
    function testFuzz_liquidationNeverSeizesMoreThanCollateral(uint256 priceDrop, uint256 repayAmount) public {
        _depositAndBorrow(10e18, 14_000e6);

        int256 newPrice = int256(bound(priceDrop, 100e8, 1_646e8));
        feed.setAnswer(newPrice);
        vm.assume(market.isLiquidatable(alice));

        repayAmount = bound(repayAmount, 1e6, market.debtOf(alice) / 2);

        vm.prank(bob);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, repayAmount, bob);

        assertLe(seized, 10e18);
        assertLe(repaid, repayAmount);
        assertEq(weth.balanceOf(address(market)), 10e18 - seized);
    }
}
