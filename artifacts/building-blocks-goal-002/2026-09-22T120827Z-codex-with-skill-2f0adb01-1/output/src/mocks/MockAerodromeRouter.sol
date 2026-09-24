// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAerodromeRouter} from "../interfaces/IAerodromeRouter.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {MockERC20} from "./MockERC20.sol";
import {MockAerodromePool} from "./MockAerodromePool.sol";

contract MockAerodromeRouter is IAerodromeRouter {
    using SafeERC20 for IERC20;

    MockAerodromePool public immutable pool;
    mapping(address => mapping(address => uint256)) public rate;

    constructor(MockAerodromePool pool_) {
        pool = pool_;
    }

    function setRate(address from, address to, uint256 rawRate) external {
        rate[from][to] = rawRate;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "ROUTER: deadline");
        require(routes.length == 1, "ROUTER: route");

        Route calldata route = routes[0];
        uint256 amountOut = (amountIn * rate[route.from][route.to]) / 1e18;
        require(amountOut >= amountOutMin, "ROUTER: slippage");

        IERC20(route.from).safeTransferFrom(msg.sender, address(this), amountIn);
        MockERC20(route.to).mint(to, amountOut);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
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
        require(block.timestamp <= deadline, "ROUTER: deadline");
        require(amountADesired >= amountAMin && amountBDesired >= amountBMin, "ROUTER: min");

        IERC20(tokenA).safeTransferFrom(msg.sender, address(pool), amountADesired);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(pool), amountBDesired);

        amountA = amountADesired;
        amountB = amountBDesired;
        liquidity = amountADesired + amountBDesired;
        pool.mint(to, liquidity);
    }

    function removeLiquidity(
        address,
        address,
        bool,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        require(block.timestamp <= deadline, "ROUTER: deadline");
        IERC20(address(pool)).safeTransferFrom(msg.sender, address(this), liquidity);
        (amountA, amountB) = pool.burnTo(to, liquidity);
        require(amountA >= amountAMin && amountB >= amountBMin, "ROUTER: min");
    }

    function getAmountsOut(uint256 amountIn, Route[] calldata routes) external view returns (uint256[] memory amounts) {
        require(routes.length == 1, "ROUTER: route");
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = (amountIn * rate[routes[0].from][routes[0].to]) / 1e18;
    }
}

