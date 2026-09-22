// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FixedRateWethBorrowMarket} from "../src/FixedRateWethBorrowMarket.sol";

interface Vm {
    function expectRevert(bytes4 selector) external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function warp(uint256 newTimestamp) external;
}

contract MockERC20 {
    uint8 private immutable DECIMALS;

    string public name;
    string public symbol;
    uint256 public totalSupply;

    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 allowance)) public allowance;

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
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "BALANCE");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract MockEthUsdOracle {
    uint8 private constant DECIMALS = 8;

    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;

    constructor(int256 answer_) {
        setAnswer(answer_);
    }

    function setAnswer(int256 answer_) public {
        answer = answer_;
        updatedAt = block.timestamp;
        roundId++;
    }

    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}

contract FixedRateWethBorrowMarketTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockERC20 private weth;
    MockERC20 private usdc;
    MockEthUsdOracle private oracle;
    FixedRateWethBorrowMarket private market;

    address private constant OWNER = address(0xA11CE);
    address private constant BORROWER = address(0xB0B);
    address private constant LIQUIDATOR = address(0x1EAF);

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        oracle = new MockEthUsdOracle(2_000e8);
        market = new FixedRateWethBorrowMarket(
            address(weth), address(usdc), address(oracle), 500, 1 days, OWNER
        );

        weth.mint(BORROWER, 10 ether);
        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(market), type(uint256).max);
        market.fundMarket(1_000_000e6);
    }

    function testBorrowUpToSeventyPercentOfCollateralValue() public {
        VM.startPrank(BORROWER);
        weth.approve(address(market), type(uint256).max);
        market.depositCollateral(1 ether);
        market.borrow(1_400e6);
        VM.expectRevert(FixedRateWethBorrowMarket.BorrowTooHigh.selector);
        market.borrow(1);
        VM.stopPrank();

        (,, uint256 debt, uint256 ltvBps, bool liquidatable) = market.positionHealth(BORROWER);
        require(debt == 1_400e6, "debt");
        require(ltvBps == 7_000, "ltv");
        require(!liquidatable, "liquidatable");
    }

    function testInterestAccruesAtFlatAnnualRate() public {
        VM.startPrank(BORROWER);
        weth.approve(address(market), type(uint256).max);
        market.depositCollateral(1 ether);
        market.borrow(1_000e6);
        VM.stopPrank();

        VM.warp(block.timestamp + 365 days);

        require(market.currentDebt(BORROWER) == 1_050e6, "one year interest");
    }

    function testCannotWithdrawPastBorrowLimit() public {
        VM.startPrank(BORROWER);
        weth.approve(address(market), type(uint256).max);
        market.depositCollateral(1 ether);
        market.borrow(1_000e6);
        VM.expectRevert(FixedRateWethBorrowMarket.BorrowTooHigh.selector);
        market.withdrawCollateral(0.3 ether);
        market.withdrawCollateral(0.2 ether);
        VM.stopPrank();

        (uint256 collateralWeth,, uint256 debt,,) = market.positionHealth(BORROWER);
        require(collateralWeth == 0.8 ether, "collateral");
        require(debt == 1_000e6, "debt");
    }

    function testLiquidationRepaysDebtAndSeizesWethWithBonus() public {
        VM.startPrank(BORROWER);
        weth.approve(address(market), type(uint256).max);
        market.depositCollateral(1 ether);
        market.borrow(1_400e6);
        VM.stopPrank();

        oracle.setAnswer(1_600e8);
        usdc.mint(LIQUIDATOR, 1_000e6);

        VM.startPrank(LIQUIDATOR);
        usdc.approve(address(market), type(uint256).max);
        (uint256 repaid, uint256 seized) = market.liquidate(BORROWER, 800e6);
        VM.stopPrank();

        require(repaid == 800e6, "repaid");
        require(seized == 0.525 ether, "seized");
        require(weth.balanceOf(LIQUIDATOR) == 0.525 ether, "liquidator weth");
        require(market.currentDebt(BORROWER) == 600e6, "remaining debt");
    }

    function testRepayOnlyPullsOutstandingDebt() public {
        VM.startPrank(BORROWER);
        weth.approve(address(market), type(uint256).max);
        usdc.approve(address(market), type(uint256).max);
        market.depositCollateral(1 ether);
        market.borrow(500e6);
        market.repay(1_000e6);
        VM.stopPrank();

        require(market.currentDebt(BORROWER) == 0, "debt");
        require(usdc.balanceOf(BORROWER) == 0, "only debt pulled");
    }
}
