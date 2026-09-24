// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAerodromeRouter} from "../../src/interfaces/IAerodrome.sol";
import {MockERC20} from "./MockERC20.sol";

/// @dev Uniswap-V2-style x*y=k pool with a 0.3% fee, shaped like an Aerodrome volatile pool.
contract MockPool is ERC20 {
    address public immutable token0;
    address public immutable token1;
    bool public constant stable = false;
    uint256 public constant FEE_BPS = 30;
    uint256 internal reserve0;
    uint256 internal reserve1;

    constructor(address a, address b) ERC20("vAMM", "vAMM") {
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
        _mint(to, liquidity);
        (reserve0, reserve1) = (b0, b1);
    }

    function burn(address to) external returns (uint256 a0, uint256 a1) {
        uint256 liquidity = balanceOf(address(this));
        uint256 supply = totalSupply();
        a0 = liquidity * reserve0 / supply;
        a1 = liquidity * reserve1 / supply;
        _burn(address(this), liquidity);
        IERC20(token0).transfer(to, a0);
        IERC20(token1).transfer(to, a1);
        (reserve0, reserve1) = (IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
    }

    function swap(address tokenIn, address to) external returns (uint256 out) {
        bool zeroIn = tokenIn == token0;
        (uint256 rIn, uint256 rOut) = zeroIn ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this)) - rIn;
        uint256 inAfterFee = amountIn * (10_000 - FEE_BPS);
        out = inAfterFee * rOut / (rIn * 10_000 + inAfterFee);
        IERC20(zeroIn ? token1 : token0).transfer(to, out);
        (reserve0, reserve1) = (IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
    }
}

/// @dev Routes through MockPool for its pair; any other pair uses a fixed rate and mints the output token.
contract MockRouter {
    MockPool public immutable pool;
    mapping(address => mapping(address => uint256)) public rate; // out per 1e18 in

    constructor(MockPool pool_) {
        pool = pool_;
    }

    function setRate(address from, address to, uint256 rate_) external {
        rate[from][to] = rate_;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(block.timestamp <= deadline, "expired");
        (uint256 rA, uint256 rB) = _reservesFor(tokenA);
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
        require(amountA >= amountAMin && amountB >= amountBMin, "min");
        IERC20(tokenA).transferFrom(msg.sender, address(pool), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(pool), amountB);
        liquidity = pool.mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address,
        bool,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        require(block.timestamp <= deadline, "expired");
        pool.transferFrom(msg.sender, address(pool), liquidity);
        (uint256 a0, uint256 a1) = pool.burn(to);
        (amountA, amountB) = tokenA == pool.token0() ? (a0, a1) : (a1, a0);
        require(amountA >= amountAMin && amountB >= amountBMin, "min");
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        IAerodromeRouter.Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "expired");
        require(routes.length == 1, "single hop");
        address from = routes[0].from;
        address dest = routes[0].to;
        uint256 out;
        if (_isPoolPair(from, dest)) {
            IERC20(from).transferFrom(msg.sender, address(pool), amountIn);
            out = pool.swap(from, to);
        } else {
            IERC20(from).transferFrom(msg.sender, address(this), amountIn);
            out = amountIn * rate[from][dest] / 1e18;
            MockERC20(dest).mint(to, out);
        }
        require(out >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        amounts = new uint256[](2);
        (amounts[0], amounts[1]) = (amountIn, out);
    }

    function _isPoolPair(address a, address b) internal view returns (bool) {
        address t0 = pool.token0();
        address t1 = pool.token1();
        return (a == t0 && b == t1) || (a == t1 && b == t0);
    }

    function _reservesFor(address tokenA) internal view returns (uint256 rA, uint256 rB) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rA, rB) = tokenA == pool.token0() ? (r0, r1) : (r1, r0);
    }
}

contract MockGauge {
    IERC20 public immutable stakingToken;
    MockERC20 public immutable rewardToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public earned;

    constructor(IERC20 stakingToken_, MockERC20 rewardToken_) {
        stakingToken = stakingToken_;
        rewardToken = rewardToken_;
    }

    function accrue(address account, uint256 amount) external {
        earned[account] += amount;
    }

    function deposit(uint256 amount) external {
        stakingToken.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        stakingToken.transfer(msg.sender, amount);
    }

    function getReward(address account) external {
        require(msg.sender == account, "not owner");
        uint256 amount = earned[account];
        earned[account] = 0;
        rewardToken.mint(account, amount);
    }
}
