// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IAerodromeRouter} from "../../src/interfaces/IAerodrome.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {SafeTransferLib} from "../../src/lib/SafeTransferLib.sol";
import {MockERC20} from "./MockERC20.sol";
import {MockAerodromePool} from "./MockAerodromePool.sol";

contract MockAerodromeRouter is IAerodromeRouter {
    using SafeTransferLib for IERC20;

    MockAerodromePool public immutable pool;

    struct Rate {
        uint256 numerator;
        uint256 denominator;
    }

    mapping(bytes32 => Rate) public rates;

    constructor(MockAerodromePool pool_) {
        pool = pool_;
    }

    function setRate(address tokenIn, address tokenOut, uint256 numerator, uint256 denominator)
        external
    {
        rates[_key(tokenIn, tokenOut)] = Rate(numerator, denominator);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256,
        uint256,
        address to,
        uint256
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(tokenA == pool.token0() && tokenB == pool.token1(), "PAIR");
        IERC20(tokenA).safeTransferFrom(msg.sender, address(pool), amountADesired);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(pool), amountBDesired);
        liquidity = pool.mintLiquidity(to, amountADesired, amountBDesired);
        return (amountADesired, amountBDesired, liquidity);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool,
        uint256 liquidity,
        uint256,
        uint256,
        address to,
        uint256
    ) external returns (uint256 amountA, uint256 amountB) {
        require(tokenA == pool.token0() && tokenB == pool.token1(), "PAIR");
        IERC20(address(pool)).safeTransferFrom(msg.sender, address(pool), liquidity);
        return pool.burnLiquidity(to, liquidity);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        require(routes.length != 0, "NO_ROUTE");
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        IERC20(routes[0].from).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 current = amountIn;
        for (uint256 i = 0; i < routes.length; i++) {
            Rate memory rate = rates[_key(routes[i].from, routes[i].to)];
            require(rate.denominator != 0, "NO_RATE");
            current = current * rate.numerator / rate.denominator;
            amounts[i + 1] = current;
        }

        require(current >= amountOutMin, "MIN_OUT");
        MockERC20(routes[routes.length - 1].to).mint(to, current);
    }

    function _key(address tokenIn, address tokenOut) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenIn, tokenOut));
    }
}
