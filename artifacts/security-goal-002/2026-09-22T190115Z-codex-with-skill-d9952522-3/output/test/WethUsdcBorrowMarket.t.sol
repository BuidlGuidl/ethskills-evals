// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {WethUsdcBorrowMarket} from "../src/WethUsdcBorrowMarket.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAggregator is AggregatorV3Interface {
    uint8 private immutable DECIMALS;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint8 decimals_, int256 answer_) {
        DECIMALS = decimals_;
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

    function setAnswer(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer_, uint256 startedAt, uint256 updatedAt_, uint80 answeredInRound)
    {
        roundId = 1;
        answer_ = answer;
        startedAt = updatedAt;
        updatedAt_ = updatedAt;
        answeredInRound = 1;
    }
}

contract WethUsdcBorrowMarketTest is Test {
    MockERC20 private weth;
    MockERC20 private usdc;
    MockAggregator private ethUsd;
    MockAggregator private usdcUsd;
    WethUsdcBorrowMarket private market;

    address private owner = address(0xA11CE);
    address private borrower = address(0xB0B);
    address private liquidator = address(0x1A);

    function setUp() external {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        ethUsd = new MockAggregator(8, 2_000e8);
        usdcUsd = new MockAggregator(8, 1e8);
        market = new WethUsdcBorrowMarket(weth, usdc, ethUsd, usdcUsd, 1_000, 1 days, 1 days, owner);

        weth.mint(borrower, 10 ether);
        usdc.mint(owner, 1_000_000e6);
        usdc.mint(liquidator, 10_000e6);

        vm.startPrank(owner);
        usdc.approve(address(market), type(uint256).max);
        market.depositLiquidity(1_000_000e6);
        vm.stopPrank();

        vm.startPrank(borrower);
        weth.approve(address(market), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(liquidator);
        usdc.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    function testBorrowLimitIsSeventyPercent() external {
        vm.startPrank(borrower);
        market.depositCollateral(1 ether);
        market.borrow(1_400e6, borrower);

        vm.expectRevert();
        market.borrow(1, borrower);
        vm.stopPrank();
    }

    function testWithdrawMustRemainWithinBorrowLimit() external {
        vm.startPrank(borrower);
        market.depositCollateral(1 ether);
        market.borrow(1_000e6, borrower);

        vm.expectRevert();
        market.withdrawCollateral(0.3 ether, borrower);

        market.withdrawCollateral(0.25 ether, borrower);
        vm.stopPrank();
    }

    function testInterestAccruesAndRepayCapsAtDebt() external {
        vm.startPrank(borrower);
        market.depositCollateral(1 ether);
        market.borrow(1_000e6, borrower);
        vm.warp(block.timestamp + 365 days / 2);

        uint256 debt = market.currentDebt(borrower);
        assertGt(debt, 1_000e6);
        assertApproxEqAbs(debt, 1_050e6, 1);

        usdc.mint(borrower, debt);
        usdc.approve(address(market), type(uint256).max);
        uint256 repaid = market.repay(type(uint256).max);
        assertEq(repaid, debt);
        assertEq(market.currentDebt(borrower), 0);
        vm.stopPrank();
    }

    function testLiquidationAfterPriceDrop() external {
        vm.startPrank(borrower);
        market.depositCollateral(1 ether);
        market.borrow(1_400e6, borrower);
        vm.stopPrank();

        ethUsd.setAnswer(1_600e8);
        assertTrue(market.isLiquidatable(borrower));

        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
        vm.prank(liquidator);
        (uint256 repaid, uint256 seizedWeth) = market.liquidate(borrower, 100e6, liquidator);

        assertEq(repaid, 100e6);
        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seizedWeth);
        assertApproxEqAbs(seizedWeth, 0.065625 ether, 1);
        assertEq(market.currentDebt(borrower), 1_300e6);
    }
}
