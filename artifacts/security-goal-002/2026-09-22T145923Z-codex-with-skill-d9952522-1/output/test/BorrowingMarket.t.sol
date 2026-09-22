// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {WethUsdcBorrowingMarket, IERC20, IChainlinkAggregatorV3} from "../src/BorrowingMarket.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address msgSender) external;
}

contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

    contract MockFeed is IChainlinkAggregatorV3 {
        uint8 public immutable override decimals;
        int256 public answer;
        uint256 public updatedAt;

        constructor(uint8 decimals_, int256 answer_) {
            decimals = decimals_;
            answer = answer_;
            updatedAt = block.timestamp;
        }

        function setAnswer(int256 answer_) external {
            answer = answer_;
            updatedAt = block.timestamp;
        }

        function setUpdatedAt(uint256 updatedAt_) external {
            updatedAt = updatedAt_;
        }

        function latestRoundData()
            external
            view
            override
            returns (uint80 roundId, int256 answer_, uint256 startedAt, uint256 updatedAt_, uint80 answeredInRound)
        {
            return (1, answer, updatedAt, updatedAt, 1);
        }
    }

        contract BorrowingMarketTest {
            Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

            MockERC20 private weth;
            MockERC20 private usdc;
            MockFeed private feed;
            WethUsdcBorrowingMarket private market;

            address private constant BORROWER = address(0xB0B);
            address private constant LIQUIDATOR = address(0xA11CE);

            function setUp() public {
                weth = new MockERC20("Wrapped Ether", "WETH", 18);
                usdc = new MockERC20("USD Coin", "USDC", 6);
                feed = new MockFeed(8, 2_000e8);
                market = new WethUsdcBorrowingMarket(weth, usdc, feed, 1 days, 0.1e18, address(this));

                usdc.mint(address(this), 1_000_000e6);
                usdc.approve(address(market), type(uint256).max);
                market.provideLiquidity(500_000e6);

                weth.mint(BORROWER, 10e18);
                usdc.mint(BORROWER, 100_000e6);
                usdc.mint(LIQUIDATOR, 100_000e6);
            }

            function testBorrowRepayAndWithdraw() public {
                _approveFrom(BORROWER, weth, address(market), type(uint256).max);
                _approveFrom(BORROWER, usdc, address(market), type(uint256).max);

                vm.prank(BORROWER);
                market.depositCollateral(1e18);
                vm.prank(BORROWER);
                market.borrow(1_400e6);

                uint256 borrowerUsdc = usdc.balanceOf(BORROWER);
                require(borrowerUsdc == 101_400e6, "borrow transfer");

                vm.prank(BORROWER);
                market.repay(1_400e6);
                vm.prank(BORROWER);
                market.withdrawCollateral(1e18);

                require(weth.balanceOf(BORROWER) == 10e18, "withdraw transfer");
                require(market.debtOf(BORROWER) == 0, "debt remains");
            }

            function testCannotBorrowAboveSeventyPercent() public {
                _approveFrom(BORROWER, weth, address(market), type(uint256).max);
                vm.prank(BORROWER);
                market.depositCollateral(1e18);

                vm.prank(BORROWER);
                (bool ok,) = address(market).call(abi.encodeCall(market.borrow, (1_401e6)));
                require(!ok, "overborrow succeeded");
            }

            function testInterestAccrues() public {
                _approveFrom(BORROWER, weth, address(market), type(uint256).max);
                vm.prank(BORROWER);
                market.depositCollateral(2e18);
                vm.prank(BORROWER);
                market.borrow(1_000e6);

                vm.warp(block.timestamp + 365 days);
                require(market.debtOf(BORROWER) == 1_100e6, "interest");
            }

            function testLiquidationSeizesBonusCollateral() public {
                _approveFrom(BORROWER, weth, address(market), type(uint256).max);
                _approveFrom(LIQUIDATOR, usdc, address(market), type(uint256).max);

                vm.prank(BORROWER);
                market.depositCollateral(1e18);
                vm.prank(BORROWER);
                market.borrow(1_400e6);

                feed.setAnswer(1_600e8);
                (,,,, bool liquidatable) = market.health(BORROWER);
                require(liquidatable, "not liquidatable");

                uint256 liquidatorWethBefore = weth.balanceOf(LIQUIDATOR);
                vm.prank(LIQUIDATOR);
                market.liquidate(BORROWER, 800e6);
                uint256 seized = weth.balanceOf(LIQUIDATOR) - liquidatorWethBefore;

                require(seized == 525e15, "seized weth");
                require(market.debtOf(BORROWER) == 600e6, "remaining debt");
            }

            function testStaleOracleBlocksBorrow() public {
                _approveFrom(BORROWER, weth, address(market), type(uint256).max);
                vm.prank(BORROWER);
                market.depositCollateral(1e18);

                vm.warp(3 days);
                feed.setUpdatedAt(block.timestamp - 2 days);
                vm.prank(BORROWER);
                (bool ok,) = address(market).call(abi.encodeCall(market.borrow, (1_000e6)));
                require(!ok, "stale price borrow");
            }

            function _approveFrom(address owner, MockERC20 token, address spender, uint256 amount) private {
                vm.prank(owner);
                token.approve(spender, amount);
            }
        }
