// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {BorrowingMarket, AggregatorV3Interface} from "../src/BorrowingMarket.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockOracle is AggregatorV3Interface {
    uint8 public immutable DECIMALS;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint8 decimals_, int256 answer_) {
        DECIMALS = decimals_;
        setAnswer(answer_);
    }

    function decimals() external view override returns (uint8) {
        return DECIMALS;
    }

    function setAnswer(int256 newAnswer) public {
        answer = newAnswer;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 newUpdatedAt) external {
        updatedAt = newUpdatedAt;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (0, answer, updatedAt, updatedAt, 0);
    }
}

contract BorrowingMarketTest is Test {
    uint256 internal constant STARTING_PRICE = 2_000e8;
    uint256 internal constant RATE_BPS = 500;
    uint256 internal constant ORACLE_MAX_AGE = 1 days;

    MockERC20 internal weth;
    MockERC20 internal usdc;
    MockOracle internal oracle;
    BorrowingMarket internal market;

    address internal borrower = address(0xB0);
    address internal liquidator = address(0x1A);
    address internal owner = address(this);

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        // forge-lint: disable-next-line(unsafe-typecast)
        oracle = new MockOracle(8, int256(STARTING_PRICE));
        market = new BorrowingMarket(owner, weth, usdc, oracle, RATE_BPS, ORACLE_MAX_AGE);

        weth.mint(borrower, 10e18);
        usdc.mint(owner, 1_000_000e6);
        usdc.mint(liquidator, 1_000_000e6);

        usdc.approve(address(market), type(uint256).max);
        vm.prank(borrower);
        weth.approve(address(market), type(uint256).max);
        vm.prank(borrower);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(liquidator);
        usdc.approve(address(market), type(uint256).max);

        market.addLiquidity(500_000e6);
    }

    function testBorrowWithinLimit() public {
        vm.startPrank(borrower);
        market.depositCollateral(1e18);
        market.borrow(1_400e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(borrower), 1_400e6);
        assertEq(market.previewDebt(borrower), 1_400e6);
    }

    function testCannotBorrowAboveLimit() public {
        vm.startPrank(borrower);
        market.depositCollateral(1e18);
        vm.expectRevert();
        market.borrow(1_401e6);
        vm.stopPrank();
    }

    function testInterestAccruesLinearly() public {
        vm.startPrank(borrower);
        market.depositCollateral(2e18);
        market.borrow(1_000e6);
        vm.warp(block.timestamp + 365 days);

        uint256 debt = market.previewDebt(borrower);
        vm.stopPrank();

        assertEq(debt, 1_050e6);
    }

    function testWithdrawRequiresHealthyPosition() public {
        vm.startPrank(borrower);
        market.depositCollateral(1e18);
        market.borrow(1_000e6);
        vm.expectRevert(BorrowingMarket.PositionUnhealthy.selector);
        market.withdrawCollateral(0.4e18);
        vm.stopPrank();
    }

    function testLiquidationRepaysDebtAndSeizesBonusCollateral() public {
        vm.startPrank(borrower);
        market.depositCollateral(2e18);
        market.borrow(1_400e6);
        vm.stopPrank();

        oracle.setAnswer(800e8);

        uint256 liquidatorWethBefore = weth.balanceOf(liquidator);
        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = market.liquidate(borrower, 900e6);

        assertEq(repaid, 900e6);
        assertEq(seized, 1_181_250_000_000_000_000);
        assertEq(weth.balanceOf(liquidator) - liquidatorWethBefore, seized);
        assertEq(market.previewDebt(borrower), 500e6);
    }

    function testLiquidationCapsRepayByRemainingCollateral() public {
        vm.startPrank(borrower);
        market.depositCollateral(1e18);
        market.borrow(1_400e6);
        vm.stopPrank();

        oracle.setAnswer(1_000e8);

        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = market.liquidate(borrower, type(uint256).max);

        assertEq(repaid, 952_380_952);
        assertEq(seized, 999_999_999_600_000_000);
        assertEq(market.previewDebt(borrower), 447_619_048);
    }

    function testStaleOracleBlocksBorrowHealthActions() public {
        vm.warp(block.timestamp + ORACLE_MAX_AGE + 2);

        vm.prank(borrower);
        market.depositCollateral(1e18);

        oracle.setUpdatedAt(block.timestamp - ORACLE_MAX_AGE - 1);

        vm.prank(borrower);
        vm.expectRevert(
            abi.encodeWithSelector(BorrowingMarket.OraclePriceStale.selector, block.timestamp - ORACLE_MAX_AGE - 1, ORACLE_MAX_AGE)
        );
        market.borrow(1e6);
    }
}
