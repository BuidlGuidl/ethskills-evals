// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Uniswap-V2 style x*y=k pool with a 0.3% fee (mirrors Aerodrome vAMM math closely enough for tests).
contract MockPool is ERC20 {
    address public immutable token0;
    address public immutable token1;
    bool public constant stable = false;
    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public constant FEE_BPS = 30;

    constructor(address a, address b) ERC20("vAMM LP", "vAMM") {
        (token0, token1) = a < b ? (a, b) : (b, a);
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        return (reserve0, reserve1, block.timestamp);
    }

    function mint(address to) external returns (uint256 liquidity) {
        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));
        uint256 a0 = b0 - reserve0;
        uint256 a1 = b1 - reserve1;
        uint256 supply = totalSupply();
        if (supply == 0) {
            liquidity = Math.sqrt(a0 * a1) - 1000;
            _mint(address(0xdead), 1000);
        } else {
            liquidity = Math.min(a0 * supply / reserve0, a1 * supply / reserve1);
        }
        require(liquidity > 0, "no liquidity");
        _mint(to, liquidity);
        _sync();
    }

    function burn(address to) external returns (uint256 a0, uint256 a1) {
        uint256 liquidity = balanceOf(address(this));
        uint256 supply = totalSupply();
        a0 = liquidity * reserve0 / supply;
        a1 = liquidity * reserve1 / supply;
        _burn(address(this), liquidity);
        IERC20(token0).transfer(to, a0);
        IERC20(token1).transfer(to, a1);
        _sync();
    }

    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256) {
        (uint256 rIn, uint256 rOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 inAfterFee = amountIn * (10_000 - FEE_BPS) / 10_000;
        return inAfterFee * rOut / (rIn + inAfterFee);
    }

    function swap(address tokenIn, address to) external returns (uint256 out) {
        uint256 rIn = tokenIn == token0 ? reserve0 : reserve1;
        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this)) - rIn;
        out = getAmountOut(amountIn, tokenIn);
        IERC20(tokenIn == token0 ? token1 : token0).transfer(to, out);
        _sync();
    }

    function _sync() internal {
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }
}

contract MockRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    address public immutable defaultFactory;
    mapping(address => mapping(address => mapping(bool => address))) internal pools;

    constructor(address factory_) {
        defaultFactory = factory_;
    }

    function register(address pool) external {
        address t0 = MockPool(pool).token0();
        address t1 = MockPool(pool).token1();
        pools[t0][t1][false] = pool;
        pools[t1][t0][false] = pool;
    }

    function poolFor(address a, address b, bool stable, address) public view returns (address) {
        return pools[a][b][stable];
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        MockPool pool = MockPool(poolFor(tokenA, tokenB, stable, address(0)));
        (uint256 rA, uint256 rB) =
            tokenA == pool.token0() ? (pool.reserve0(), pool.reserve1()) : (pool.reserve1(), pool.reserve0());
        if (rA == 0 && rB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 bOptimal = amountADesired * rB / rA;
            if (bOptimal <= amountBDesired) {
                (amountA, amountB) = (amountADesired, bOptimal);
            } else {
                (amountA, amountB) = (amountBDesired * rA / rB, amountBDesired);
            }
        }
        require(amountA >= amountAMin, "A min");
        require(amountB >= amountBMin, "B min");
        IERC20(tokenA).transferFrom(msg.sender, address(pool), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(pool), amountB);
        liquidity = pool.mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256
    ) external returns (uint256 amountA, uint256 amountB) {
        MockPool pool = MockPool(poolFor(tokenA, tokenB, stable, address(0)));
        pool.transferFrom(msg.sender, address(pool), liquidity);
        (uint256 a0, uint256 a1) = pool.burn(to);
        (amountA, amountB) = tokenA == pool.token0() ? (a0, a1) : (a1, a0);
        require(amountA >= amountAMin, "A min");
        require(amountB >= amountBMin, "B min");
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        address first = poolFor(routes[0].from, routes[0].to, routes[0].stable, address(0));
        IERC20(routes[0].from).transferFrom(msg.sender, first, amountIn);
        for (uint256 i; i < routes.length; ++i) {
            address pool = poolFor(routes[i].from, routes[i].to, routes[i].stable, address(0));
            address next = i + 1 < routes.length
                ? poolFor(routes[i + 1].from, routes[i + 1].to, routes[i + 1].stable, address(0))
                : to;
            amounts[i + 1] = MockPool(pool).swap(routes[i].from, next);
        }
        require(amounts[routes.length] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
    }
}

/// @notice Gauge that pays a test-controlled amount of reward token on `getReward`.
contract MockGauge {
    address public immutable stakingToken;
    address public immutable rewardToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public earned;

    constructor(address stakingToken_, address rewardToken_) {
        stakingToken = stakingToken_;
        rewardToken = rewardToken_;
    }

    function setEarned(address account, uint256 amount) external {
        earned[account] = amount;
    }

    function deposit(uint256 amount) external {
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        IERC20(stakingToken).transfer(msg.sender, amount);
    }

    function getReward(address account) external {
        require(msg.sender == account, "not account");
        uint256 amount = earned[account];
        earned[account] = 0;
        if (amount > 0) MockERC20(rewardToken).mint(account, amount);
    }
}
