// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {ChainlinkPairOracle} from "../src/ChainlinkPairOracle.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {MockToken, MockFeed} from "./mocks/Mocks.sol";

contract LendingPoolTest is Test {
    MockToken weth;
    MockToken usdc;
    MockFeed ethFeed;
    MockFeed usdcFeed;
    ChainlinkPairOracle oracle;
    LendingPool pool;

    address owner = address(0xA11CE);
    address lender = address(0xB0B);
    address borrower = address(0xCAFE);
    address liquidator = address(0xDEAD);

    function setUp() public {
        vm.warp(1_700_000_000);
        weth = new MockToken("Wrapped Ether", "WETH", 18);
        usdc = new MockToken("USD Coin", "USDC", 6);
        ethFeed = new MockFeed(8, 3000e8);
        usdcFeed = new MockFeed(8, 1e8);

        oracle = new ChainlinkPairOracle(
            AggregatorV3Interface(address(ethFeed)),
            1 hours,
            100e8,
            100_000e8,
            AggregatorV3Interface(address(usdcFeed)),
            24 hours,
            0.9e8,
            1.1e8
        );

        pool = new LendingPool(
            LendingPool.InitParams({
                debtToken: IERC20(address(usdc)),
                collateralToken: IERC20(address(weth)),
                oracle: IPriceOracle(address(oracle)),
                owner: owner,
                ltvBps: 7_000,
                liquidationThresholdBps: 8_500,
                liquidationBonusBps: 500,
                closeFactorBps: 5_000,
                reserveFactorBps: 1_000,
                ratePerYearWad: 0.05e18
            }),
            "Share",
            "SH"
        );

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(liquidator, 1_000_000e6);
        weth.mint(borrower, 100e18);

        vm.startPrank(lender);
        usdc.approve(address(pool), type(uint256).max);
        pool.deposit(500_000e6, lender);
        vm.stopPrank();

        vm.prank(liquidator);
        usdc.approve(address(pool), type(uint256).max);

        vm.startPrank(borrower);
        weth.approve(address(pool), type(uint256).max);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    function test_oraclePriceScaling() public view {
        // ETH $3000, USDC $1 => 3000e18
        assertEq(oracle.collateralPriceInDebt(), 3000e18);
    }

    function test_oracleAccountsForDebtLegDepeg() public {
        usdcFeed.set(0.95e8, block.timestamp);
        // 3000 / 0.95 USDC per ETH
        assertEq(oracle.collateralPriceInDebt(), uint256(3000e18) * 1e8 / 0.95e8);
    }

    function test_oracleRejectsStaleAndOutOfBandRounds() public {
        ethFeed.set(3000e8, block.timestamp - 2 hours);
        vm.expectRevert();
        oracle.collateralPriceInDebt();

        ethFeed.set(50e8, block.timestamp); // below the sanity floor
        vm.expectRevert();
        oracle.collateralPriceInDebt();

        ethFeed.set(0, block.timestamp);
        vm.expectRevert();
        oracle.collateralPriceInDebt();
    }

    function _openPosition(uint256 collateral, uint256 debt) internal {
        vm.startPrank(borrower);
        pool.depositCollateral(collateral, borrower);
        pool.borrow(debt, borrower);
        vm.stopPrank();
    }

    function test_collateralValueAndBorrowLimit() public {
        vm.prank(borrower);
        pool.depositCollateral(10e18, borrower);
        // 10 WETH * $3000 = $30,000 => 30_000e6 USDC units
        assertEq(pool.collateralValueOf(borrower), 30_000e6);
        assertEq(pool.borrowLimitOf(borrower), 21_000e6); // 70%
        assertEq(pool.liquidationLimitOf(borrower), 25_500e6); // 85%
    }

    function test_borrowRevertsAboveLtv() public {
        vm.startPrank(borrower);
        pool.depositCollateral(10e18, borrower);
        vm.expectRevert();
        pool.borrow(21_000e6 + 1, borrower);
        pool.borrow(21_000e6, borrower);
        vm.stopPrank();
        assertEq(usdc.balanceOf(borrower), 21_000e6);
    }

    function test_interestAccruesAtFlatRate() public {
        _openPosition(10e18, 10_000e6);
        vm.warp(block.timestamp + 365 days);
        // 5% simple interest over one year on 10,000 USDC
        assertApproxEqAbs(pool.debtOf(borrower), 10_500e6, 2);
        // lenders see the interest net of the 10% reserve factor
        assertApproxEqAbs(pool.totalAssets(), 500_000e6 + 450e6, 2);
        assertApproxEqAbs(pool.totalReservesCurrent(), 50e6, 2);
        assertApproxEqAbs(pool.totalBorrowsCurrent(), 10_500e6, 2);
    }

    function test_repayAndWithdrawCollateral() public {
        _openPosition(10e18, 10_000e6);
        vm.warp(block.timestamp + 30 days);

        uint256 debt = pool.debtOf(borrower);
        usdc.mint(borrower, debt);

        vm.startPrank(borrower);
        pool.repay(type(uint256).max, borrower);
        assertEq(pool.debtOf(borrower), 0);
        assertEq(pool.debtPrincipal(borrower), 0);

        pool.withdrawCollateral(10e18, borrower);
        vm.stopPrank();
        assertEq(weth.balanceOf(borrower), 100e18);
    }

    function test_withdrawCollateralBlockedWhenItBreaksLtv() public {
        _openPosition(10e18, 21_000e6);
        vm.prank(borrower);
        vm.expectRevert();
        pool.withdrawCollateral(1, borrower);
    }

    function test_healthyPositionCannotBeLiquidated() public {
        _openPosition(10e18, 21_000e6); // 70%, healthy
        assertFalse(pool.isLiquidatable(borrower));
        vm.prank(liquidator);
        vm.expectRevert(LendingPool.PositionHealthy.selector);
        pool.liquidate(borrower, 1_000e6, 0, liquidator);
    }

    function test_liquidationSeizesRepaidValuePlusFivePercent() public {
        _openPosition(10e18, 21_000e6);

        // ETH falls to $2400 => collateral value 24,000; debt 21,000 = 87.5% > 85%
        ethFeed.set(2400e8, block.timestamp);
        assertTrue(pool.isLiquidatable(borrower));

        uint256 repayAmount = 10_000e6; // within the 50% close factor
        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = pool.liquidate(borrower, repayAmount, 0, liquidator);

        assertEq(repaid, repayAmount);
        // 10,000 USDC / $2400 = 4.1666… WETH, +5% bonus
        uint256 expected = (uint256(10_000e6) * 1e30 / 2400e18) * 10_500 / 10_000;
        assertEq(seized, expected);
        assertEq(weth.balanceOf(liquidator), expected);
        assertEq(pool.collateralOf(borrower), 10e18 - expected);
        assertApproxEqAbs(pool.debtOf(borrower), 11_000e6, 2);
        // The position is healthy again afterwards.
        assertFalse(pool.isLiquidatable(borrower));
    }

    function test_liquidationRespectsCloseFactorAndSlippageGuard() public {
        _openPosition(10e18, 21_000e6);
        ethFeed.set(2400e8, block.timestamp);

        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(borrower, 10_500e6 + 1, 0, liquidator); // > 50% of debt

        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(borrower, 10_000e6, 100e18, liquidator); // minSeized unreachable
    }

    function test_liquidationCapsSeizureAtAvailableCollateral() public {
        _openPosition(10e18, 21_000e6);
        ethFeed.set(1000e8, block.timestamp); // deeply underwater: collateral worth 10,000

        vm.prank(liquidator);
        (, uint256 seized) = pool.liquidate(borrower, 10_500e6, 0, liquidator);
        assertEq(seized, 10e18);
        assertEq(pool.collateralOf(borrower), 0);
        // Remaining debt is bad debt, still recorded.
        assertGt(pool.debtOf(borrower), 0);
    }

    function test_lenderWithdrawalCappedByIdleCash() public {
        _openPosition(100e18, 200_000e6);
        // 500k supplied, 200k lent out => at most ~300k withdrawable.
        assertApproxEqAbs(pool.maxWithdraw(lender), 300_000e6, 1);
        vm.prank(lender);
        vm.expectRevert();
        pool.withdraw(400_000e6, lender, lender);
    }

    function test_donationDoesNotInflateShares() public {
        LendingPool fresh = new LendingPool(
            LendingPool.InitParams({
                debtToken: IERC20(address(usdc)),
                collateralToken: IERC20(address(weth)),
                oracle: IPriceOracle(address(oracle)),
                owner: owner,
                ltvBps: 7_000,
                liquidationThresholdBps: 8_500,
                liquidationBonusBps: 500,
                closeFactorBps: 5_000,
                reserveFactorBps: 1_000,
                ratePerYearWad: 0.05e18
            }),
            "S",
            "S"
        );

        // Attacker mints 1 wei of shares then donates a large amount directly.
        address attacker = address(0xBAD);
        usdc.mint(attacker, 100_000e6 + 1);
        vm.startPrank(attacker);
        usdc.approve(address(fresh), type(uint256).max);
        fresh.deposit(1, attacker);
        usdc.transfer(address(fresh), 100_000e6);
        vm.stopPrank();

        // A normal-sized victim deposit must still mint meaningful shares.
        vm.prank(lender);
        usdc.approve(address(fresh), type(uint256).max);
        vm.prank(lender);
        uint256 shares = fresh.deposit(10_000e6, lender);
        assertGt(shares, 0);
        // And the victim must be able to redeem close to what they put in.
        assertApproxEqRel(fresh.previewRedeem(shares), 10_000e6, 0.01e18);
    }

    function test_collateralDonationIsNotCredited() public {
        vm.prank(borrower);
        weth.transfer(address(pool), 5e18);
        assertEq(pool.collateralOf(borrower), 0);
        assertEq(pool.totalCollateral(), 0);
    }

    function test_onlyOwnerControls() public {
        vm.expectRevert();
        pool.setRiskParams(7_000, 8_500, 500, 5_000);
        vm.expectRevert();
        pool.pause();

        // Bounds are enforced even for the owner.
        vm.prank(owner);
        vm.expectRevert(LendingPool.InvalidParams.selector);
        pool.setRiskParams(9_000, 8_500, 500, 5_000); // ltv >= threshold

        vm.prank(owner);
        vm.expectRevert(LendingPool.InvalidParams.selector);
        pool.setInterestParams(2e18, 1_000); // > 100% APR
    }

    function test_pauseLeavesExitsOpen() public {
        _openPosition(10e18, 10_000e6);
        vm.prank(owner);
        pool.pause();

        vm.startPrank(borrower);
        vm.expectRevert();
        pool.borrow(1, borrower);
        pool.repay(1_000e6, borrower); // repay still works
        pool.withdrawCollateral(1e18, borrower); // so does withdrawing collateral
        vm.stopPrank();
    }
}
