// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WethUsdcBorrowMarket} from "../src/WethUsdcBorrowMarket.sol";

interface Vm {
    function expectRevert(bytes4 selector) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function warp(uint256 newTimestamp) external;
}

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 private immutable DECIMALS;
    uint256 public totalSupply;

    mapping(address account => uint256) public balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        DECIMALS = decimals_;
    }

    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockFeed {
    uint8 private immutable DECIMALS;
    int256 public answer;
    uint80 public roundId = 1;
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
        roundId++;
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}

contract WethUsdcBorrowMarketTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant ALICE = address(0xA11CE);
    address private constant LIQUIDATOR = address(0xB0B);

    MockERC20 private weth;
    MockERC20 private usdc;
    MockFeed private feed;
    WethUsdcBorrowMarket private market;

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        feed = new MockFeed(8, 2_000e8);
        market = new WethUsdcBorrowMarket(address(weth), address(usdc), address(feed), 1_000, 1 days);

        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(market), type(uint256).max);
        market.supplyLiquidity(500_000e6);

        weth.mint(ALICE, 10e18);
        usdc.mint(LIQUIDATOR, 100_000e6);
    }

    function testBorrowUpToSeventyPercent() public {
        _depositAlice(1e18);

        VM.prank(ALICE);
        market.borrow(1_400e6);

        _assertEq(usdc.balanceOf(ALICE), 1_400e6, "alice usdc");
        _assertEq(market.debtOf(ALICE), 1_400e6, "alice debt");

        VM.expectRevert(WethUsdcBorrowMarket.BorrowTooHigh.selector);
        VM.prank(ALICE);
        market.borrow(1);
    }

    function testInterestAccruesLinearly() public {
        _depositAlice(1e18);

        VM.prank(ALICE);
        market.borrow(1_000e6);

        VM.warp(block.timestamp + 365 days);

        _assertEq(market.debtOf(ALICE), 1_100e6, "one year debt");
    }

    function testLiquidationSeizesCollateralWithBonus() public {
        _depositAlice(1e18);

        VM.prank(ALICE);
        market.borrow(1_400e6);

        feed.setAnswer(1_600e8);
        _assertTrue(market.isLiquidatable(ALICE), "liquidatable");

        VM.startPrank(LIQUIDATOR);
        usdc.approve(address(market), type(uint256).max);
        (uint256 repaid, uint256 seized) = market.liquidate(ALICE, 100e6);
        VM.stopPrank();

        _assertEq(repaid, 100e6, "repaid");
        _assertEq(seized, 65_625_000_000_000_000, "seized weth");
        _assertEq(weth.balanceOf(LIQUIDATOR), seized, "liquidator weth");
        _assertEq(market.debtOf(ALICE), 1_300e6, "remaining debt");
    }

    function _depositAlice(uint256 amountWeth) private {
        VM.startPrank(ALICE);
        weth.approve(address(market), type(uint256).max);
        market.depositCollateral(amountWeth);
        VM.stopPrank();
    }

    function _assertEq(uint256 actual, uint256 expected, string memory reason) private pure {
        if (actual != expected) revert(reason);
    }

    function _assertTrue(bool condition, string memory reason) private pure {
        if (!condition) revert(reason);
    }
}
