// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {BorrowMarket} from "../src/BorrowMarket.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract BorrowMarketTest is Test {
    MockERC20 weth; // 18 decimals
    MockERC20 usdc; // 6 decimals
    MockAggregator feed; // 8 decimals, ETH/USD
    BorrowMarket market;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob"); // liquidator

    uint256 constant RATE_BPS = 500; // 5% APR
    uint256 constant STALENESS = 1 hours;
    uint256 constant MIN_DEBT = 100e6; // 100 USDC

    function setUp() public {
        vm.warp(1_700_000_000);

        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        feed = new MockAggregator(8, 2000e8); // ETH = $2000

        market = new BorrowMarket(
            IERC20(address(weth)),
            IERC20(address(usdc)),
            IAggregatorV3(address(feed)),
            uint64(RATE_BPS),
            uint64(STALENESS),
            MIN_DEBT,
            owner
        );

        usdc.mint(owner, 10_000_000e6);
        vm.startPrank(owner);
        usdc.approve(address(market), type(uint256).max);
        market.fundLiquidity(1_000_000e6);
        vm.stopPrank();

        weth.mint(alice, 100 ether);
        vm.prank(alice);
        weth.approve(address(market), type(uint256).max);

        usdc.mint(bob, 1_000_000e6);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal {
        vm.prank(who);
        market.depositCollateral(who, amount);
    }

    // ------------------------------------------------------------------ valuation / decimals

    /// 10 WETH at $2000 must be worth 20,000 USDC — i.e. 20_000e6, not 20_000e18.
    function test_collateralValueUsesDebtTokenDecimals() public {
        _deposit(alice, 10 ether);
        assertEq(market.collateralValueOf(alice), 20_000e6, "collateral value must be in USDC units");
        assertEq(market.maxBorrowable(alice), 14_000e6, "70% of 20k");
    }

    function test_borrowUpToMaxLtv() public {
        _deposit(alice, 10 ether);

        vm.prank(alice);
        market.borrow(14_000e6, alice);

        assertEq(usdc.balanceOf(alice), 14_000e6);
        assertEq(market.debtOf(alice), 14_000e6);
        assertEq(market.maxBorrowable(alice), 0);
    }

    function test_borrowAboveMaxLtvReverts() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.PositionUnhealthy.selector, 14_000e6 + 1, 14_000e6));
        market.borrow(14_000e6 + 1, alice);
    }

    function test_borrowBelowMinDebtReverts() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.DebtBelowMinimum.selector, 50e6, MIN_DEBT));
        market.borrow(50e6, alice);
    }

    function test_borrowBeyondLiquidityReverts() public {
        weth.mint(alice, 10_000 ether);
        _deposit(alice, 10_000 ether); // $20m of collateral, pool only holds $1m
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BorrowMarket.InsufficientLiquidity.selector, 1_000_001e6, 1_000_000e6)
        );
        market.borrow(1_000_001e6, alice);
    }

    // ------------------------------------------------------------------ interest

    function test_interestAccruesAtFlatAnnualRate() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(10_000e6, alice);

        vm.warp(block.timestamp + 365 days);

        // 5% simple over one uninterrupted year.
        assertApproxEqAbs(market.debtOf(alice), 10_500e6, 1, "one year of 5% APR");
        assertApproxEqAbs(market.totalDebt(), 10_500e6, 1);
    }

    function test_indexDoesNotRunForwardWithNoDebt() public {
        uint256 indexBefore = market.borrowIndex();
        vm.warp(block.timestamp + 365 days);
        market.accrue();
        assertEq(market.borrowIndex(), indexBefore, "no debt outstanding means no interest");
    }

    function test_interestIsRepaidToThePool() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(10_000e6, alice);

        vm.warp(block.timestamp + 365 days);

        uint256 debt = market.debtOf(alice);
        usdc.mint(alice, debt);
        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        uint256 repaid = market.repay(alice, type(uint256).max);
        vm.stopPrank();

        assertEq(repaid, debt);
        assertEq(market.debtOf(alice), 0, "debt fully cleared");
        assertEq(market.totalScaledDebt(), 0);
        assertApproxEqAbs(market.availableLiquidity(), 1_000_500e6, 1, "pool keeps the interest");
    }

    // ------------------------------------------------------------------ repay / withdraw

    function test_repayThenWithdrawAll() public {
        _deposit(alice, 10 ether);
        vm.startPrank(alice);
        market.borrow(10_000e6, alice);
        usdc.approve(address(market), type(uint256).max);
        market.repay(alice, type(uint256).max);
        market.withdrawCollateral(10 ether, alice);
        vm.stopPrank();

        assertEq(weth.balanceOf(alice), 100 ether);
        assertEq(market.totalCollateral(), 0);
    }

    function test_withdrawThatBreaksLtvReverts() public {
        _deposit(alice, 10 ether);
        vm.startPrank(alice);
        market.borrow(14_000e6, alice);
        vm.expectRevert();
        market.withdrawCollateral(1 ether, alice);
        vm.stopPrank();
    }

    function test_partialRepayLeavingDustReverts() public {
        _deposit(alice, 10 ether);
        vm.startPrank(alice);
        market.borrow(10_000e6, alice);
        usdc.approve(address(market), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.DebtBelowMinimum.selector, 50e6, MIN_DEBT));
        market.repay(alice, 10_000e6 - 50e6);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ liquidation

    function test_healthyPositionCannotBeLiquidated() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        assertFalse(market.isLiquidatable(alice));
        assertGt(market.healthFactor(alice), 1e18);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.PositionHealthy.selector, 14_000e6, 17_000e6));
        market.liquidate(alice, 1_000e6, 0);
    }

    function test_liquidationPaysFivePercentBonus() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice); // 70% LTV at $2000

        // ETH to $1600 -> collateral worth 16,000; debt 14,000 = 87.5% > 85%.
        feed.setAnswer(1600e8);
        assertTrue(market.isLiquidatable(alice));
        assertLt(market.healthFactor(alice), 1e18);

        uint256 repayAmount = 7_000e6; // exactly the close factor
        uint256 bobWethBefore = weth.balanceOf(bob);

        vm.prank(bob);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, repayAmount, 0);

        assertEq(repaid, repayAmount);
        // 7000 USDC of value at $1600 = 4.375 WETH; +5% bonus = 4.59375 WETH.
        assertEq(seized, 4.59375 ether, "repaid value plus 5% bonus");
        assertEq(weth.balanceOf(bob) - bobWethBefore, seized);

        assertEq(market.debtOf(alice), 7_000e6);
        assertEq(market.collateralOf(alice), 10 ether - seized);
        assertFalse(market.isLiquidatable(alice), "liquidation restores health");
    }

    function test_liquidationCappedByCloseFactor() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);
        feed.setAnswer(1600e8);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(BorrowMarket.RepayExceedsCloseFactor.selector, 7_000e6 + 1, 7_000e6)
        );
        market.liquidate(alice, 7_000e6 + 1, 0);
    }

    function test_liquidationMinSeizedGuard() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);
        feed.setAnswer(1600e8);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(BorrowMarket.InsufficientCollateralSeized.selector, 4.59375 ether, 5 ether)
        );
        market.liquidate(alice, 7_000e6, 5 ether);
    }

    /// Deeply underwater: the liquidator can take everything left and pays only for what they take.
    function test_liquidationClampsToAvailableCollateral() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        feed.setAnswer(500e8); // collateral worth 5,000 against 14,000 of debt

        vm.prank(bob);
        (uint256 repaid, uint256 seized) = market.liquidate(alice, type(uint256).max, 0);

        assertEq(seized, 10 ether, "all remaining collateral");
        // 10 WETH at $500 = 5,000 USDC of value; the liquidator pays 5000/1.05 for it.
        assertApproxEqAbs(repaid, uint256(5_000e6) * 10_000 / 10_500, 1);
        assertEq(market.collateralOf(alice), 0);
        assertGt(market.debtOf(alice), 0, "remainder is bad debt");
    }

    function test_liquidationOfDustIsAllowedWhenCollateralExhausted() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);
        feed.setAnswer(500e8);

        vm.prank(bob);
        market.liquidate(alice, type(uint256).max, 0); // strips collateral, leaves bad debt
        assertEq(market.collateralOf(alice), 0);
    }

    // ------------------------------------------------------------------ oracle safety

    function test_stalePriceBlocksBorrow() public {
        _deposit(alice, 10 ether);
        feed.setUpdatedAt(block.timestamp - STALENESS - 1);

        vm.prank(alice);
        vm.expectRevert();
        market.borrow(1_000e6, alice);
    }

    function test_nonPositivePriceReverts() public {
        _deposit(alice, 10 ether);
        feed.setAnswer(0);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.InvalidPrice.selector, int256(0)));
        market.borrow(1_000e6, alice);
    }

    function test_incompleteRoundReverts() public {
        _deposit(alice, 10 ether);
        feed.setAnsweredInRound(0);
        vm.prank(alice);
        vm.expectRevert();
        market.borrow(1_000e6, alice);
    }

    function test_constructorRejectsBrokenFeed() public {
        MockAggregator dead = new MockAggregator(8, 0);
        vm.expectRevert(abi.encodeWithSelector(BorrowMarket.InvalidPrice.selector, int256(0)));
        new BorrowMarket(
            IERC20(address(weth)),
            IERC20(address(usdc)),
            IAggregatorV3(address(dead)),
            uint64(RATE_BPS),
            uint64(STALENESS),
            MIN_DEBT,
            owner
        );
    }

    /// A debt-free borrower must be able to exit even when the oracle is unusable.
    function test_withdrawWithNoDebtWorksWithDeadOracle() public {
        _deposit(alice, 10 ether);
        feed.setAnswer(0);

        vm.prank(alice);
        market.withdrawCollateral(10 ether, alice);
        assertEq(weth.balanceOf(alice), 100 ether);
    }

    // ------------------------------------------------------------------ access control / pause

    function test_onlyOwnerFunctions() public {
        vm.startPrank(alice);
        bytes memory err = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice);

        vm.expectRevert(err);
        market.withdrawLiquidity(1, alice);
        vm.expectRevert(err);
        market.setInterestRate(100);
        vm.expectRevert(err);
        market.setMinDebt(1);
        vm.expectRevert(err);
        market.pause();
        vm.expectRevert(err);
        market.sweep(IERC20(address(weth)), alice);
        vm.stopPrank();
    }

    function test_ownerCannotTouchCollateral() public {
        _deposit(alice, 10 ether);

        vm.startPrank(owner);
        vm.expectRevert(BorrowMarket.CannotSweepMarketToken.selector);
        market.sweep(IERC20(address(weth)), owner);
        vm.expectRevert(BorrowMarket.CannotSweepMarketToken.selector);
        market.sweep(IERC20(address(usdc)), owner);
        vm.stopPrank();

        assertEq(weth.balanceOf(address(market)), 10 ether);
    }

    function test_ownerCannotWithdrawMoreThanIdleLiquidity() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        uint256 idle = market.availableLiquidity();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(BorrowMarket.InsufficientLiquidity.selector, idle + 1, idle)
        );
        market.withdrawLiquidity(idle + 1, owner);
    }

    function test_interestRateIsCapped() public {
        uint64 tooHigh = uint64(market.MAX_INTEREST_RATE_BPS() + 1);
        vm.prank(owner);
        vm.expectRevert(BorrowMarket.RateTooHigh.selector);
        market.setInterestRate(tooHigh);
    }

    /// Pausing must stop new risk but never trap users or block solvency work.
    function test_pauseStopsBorrowingButNotExits() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);

        vm.prank(owner);
        market.pause();

        vm.startPrank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.borrow(1e6, alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.depositCollateral(alice, 1 ether);

        // Repay and withdraw stay open.
        usdc.approve(address(market), type(uint256).max);
        market.repay(alice, type(uint256).max);
        market.withdrawCollateral(10 ether, alice);
        vm.stopPrank();
    }

    function test_liquidationWorksWhilePaused() public {
        _deposit(alice, 10 ether);
        vm.prank(alice);
        market.borrow(14_000e6, alice);
        feed.setAnswer(1600e8);

        vm.prank(owner);
        market.pause();

        vm.prank(bob);
        (, uint256 seized) = market.liquidate(alice, 7_000e6, 0);
        assertGt(seized, 0);
    }

    // ------------------------------------------------------------------ input validation

    function test_zeroValueInputsRevert() public {
        vm.startPrank(alice);
        vm.expectRevert(BorrowMarket.ZeroAmount.selector);
        market.depositCollateral(alice, 0);
        vm.expectRevert(BorrowMarket.ZeroAddress.selector);
        market.depositCollateral(address(0), 1 ether);
        vm.expectRevert(BorrowMarket.ZeroAmount.selector);
        market.borrow(0, alice);
        vm.expectRevert(BorrowMarket.ZeroAddress.selector);
        market.borrow(1e6, address(0));
        vm.expectRevert(BorrowMarket.ZeroAmount.selector);
        market.withdrawCollateral(0, alice);
        vm.stopPrank();
    }

    function test_accountingTracksCollateralNotBalance() public {
        _deposit(alice, 10 ether);
        // A donation must not become anyone's collateral.
        weth.mint(address(market), 5 ether);
        assertEq(market.totalCollateral(), 10 ether);
        assertEq(market.collateralOf(alice), 10 ether);
    }

    // ------------------------------------------------------------------ fuzz

    /// Value in, value out: a deposit/borrow/repay/withdraw round trip must never leak collateral.
    function testFuzz_roundTripPreservesCollateral(uint96 collateral, uint96 borrowAmount) public {
        collateral = uint96(bound(collateral, 0.01 ether, 500 ether));
        uint256 maxBorrow = uint256(collateral) * 2000 * 7_000 / (1e12 * 10_000);
        vm.assume(maxBorrow >= MIN_DEBT);
        uint256 amount = bound(borrowAmount, MIN_DEBT, maxBorrow);

        weth.mint(alice, collateral);
        vm.startPrank(alice);
        market.depositCollateral(alice, collateral);
        market.borrow(amount, alice);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);

        uint256 debt = market.debtOf(alice);
        usdc.mint(alice, debt);
        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        market.repay(alice, type(uint256).max);
        uint256 owned = market.collateralOf(alice);
        market.withdrawCollateral(owned, alice);
        vm.stopPrank();

        assertEq(owned, collateral, "collateral returned in full");
        assertEq(market.debtOf(alice), 0);
    }

    /// The liquidation bonus must always be exactly 5% of the repaid value, at any price.
    function testFuzz_seizeIsRepayValuePlusBonus(uint64 price, uint64 repayAmount) public {
        uint256 p = bound(price, 1e8, 100_000e8);
        uint256 r = bound(repayAmount, 1e6, 1_000_000e6);
        feed.setAnswer(int256(p));

        uint256 seized = market.previewSeize(r);
        uint256 seizedValue = seized * p / 1e20; // back to USDC units
        assertApproxEqRel(seizedValue, r * 10_500 / 10_000, 1e12, "5% bonus");
    }
}
