// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAerodromeRouter} from "../../src/interfaces/IAerodrome.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {SafeTransferLib} from "../../src/lib/SafeTransferLib.sol";
import {MockERC20} from "./MockERC20.sol";
import {MockAerodromePair} from "./MockAerodromePair.sol";

contract MockAerodromeRouter is IAerodromeRouter {
    using SafeTransferLib for IERC20;

    MockERC20 public immutable usdc;
    MockERC20 public immutable weth;
    MockERC20 public immutable reward;
    MockAerodromePair public immutable pair;

    uint256 public constant WETH_PRICE_USDC = 2_000e6;

    constructor(MockERC20 usdc_, MockERC20 weth_, MockERC20 reward_, MockAerodromePair pair_) {
        usdc = usdc_;
        weth = weth_;
        reward = reward_;
        pair = pair_;
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
        uint256
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        amountA = amountADesired;
        amountB = amountBDesired;
        require(amountA >= amountAMin && amountB >= amountBMin, "SLIPPAGE");

        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

        liquidity = _valueInUsdc(tokenA, amountA) + _valueInUsdc(tokenB, amountB);
        pair.mint(to, liquidity);
        _addReserves(tokenA, amountA, tokenB, amountB);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256
    ) external returns (uint256 amountA, uint256 amountB) {
        (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
        uint256 supply = pair.totalSupply();
        uint256 amount0 = reserve0 * liquidity / supply;
        uint256 amount1 = reserve1 * liquidity / supply;

        require(pair.transferFrom(msg.sender, address(this), liquidity), "LP_TRANSFER");
        pair.burn(address(this), liquidity);
        pair.removeReserves(amount0, amount1);

        (amountA, amountB) = pair.token0() == tokenA ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin && amountB >= amountBMin, "SLIPPAGE");

        MockERC20(tokenA).mint(to, amountA);
        MockERC20(tokenB).mint(to, amountB);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, routes);
        require(amounts[amounts.length - 1] >= amountOutMin, "SLIPPAGE");

        IERC20(routes[0].from).safeTransferFrom(msg.sender, address(this), amountIn);
        MockERC20(routes[routes.length - 1].to).mint(to, amounts[amounts.length - 1]);
    }

    function getAmountsOut(uint256 amountIn, Route[] calldata routes) public view returns (uint256[] memory amounts) {
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < routes.length; i++) {
            amounts[i + 1] = _convert(routes[i].from, routes[i].to, amounts[i]);
        }
    }

    function _addReserves(address tokenA, uint256 amountA, address, uint256 amountB) private {
        uint256 amount0;
        uint256 amount1;
        if (pair.token0() == tokenA) {
            amount0 = amountA;
            amount1 = amountB;
        } else {
            amount0 = amountB;
            amount1 = amountA;
        }
        pair.addReserves(amount0, amount1);
    }

    function _convert(address from, address to, uint256 amount) private view returns (uint256) {
        if (from == address(usdc) && to == address(weth)) return amount * 1e18 / WETH_PRICE_USDC;
        if (from == address(weth) && to == address(usdc)) return amount * WETH_PRICE_USDC / 1e18;
        if (from == address(reward) && to == address(usdc)) return amount / 1e12;
        if (from == to) return amount;
        revert("UNSUPPORTED_ROUTE");
    }

    function _valueInUsdc(address token, uint256 amount) private view returns (uint256) {
        if (token == address(usdc)) return amount;
        if (token == address(weth)) return amount * WETH_PRICE_USDC / 1e18;
        if (token == address(reward)) return amount / 1e12;
        revert("UNSUPPORTED_VALUE");
    }
}
