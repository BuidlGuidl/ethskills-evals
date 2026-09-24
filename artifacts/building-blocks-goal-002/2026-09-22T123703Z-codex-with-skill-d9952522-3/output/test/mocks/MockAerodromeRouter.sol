// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAerodromeRouter} from "../../src/interfaces/IAerodromeRouter.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockAerodromeRouter is IAerodromeRouter {
    MockERC20 public immutable usdc;
    MockERC20 public immutable weth;
    MockERC20 public immutable aero;
    MockERC20 public immutable lpToken;

    uint256 public constant USDC_PER_WETH = 2_000e6;

    constructor(MockERC20 usdc_, MockERC20 weth_, MockERC20 aero_, MockERC20 lpToken_) {
        usdc = usdc_;
        weth = weth_;
        aero = aero_;
        lpToken = lpToken_;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        require(routes.length == 1, "ONE_ROUTE");
        MockERC20 tokenIn = MockERC20(routes[0].from);
        MockERC20 tokenOut = MockERC20(routes[0].to);
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "TRANSFER_IN");

        uint256 amountOut;
        if (address(tokenIn) == address(usdc) && address(tokenOut) == address(weth)) {
            amountOut = (amountIn * 1e18) / USDC_PER_WETH;
        } else if (address(tokenIn) == address(weth) && address(tokenOut) == address(usdc)) {
            amountOut = (amountIn * USDC_PER_WETH) / 1e18;
        } else if (address(tokenIn) == address(aero) && address(tokenOut) == address(usdc)) {
            amountOut = amountIn / 1e12;
        } else {
            revert("BAD_ROUTE");
        }
        require(amountOut >= amountOutMin, "SLIPPAGE");
        tokenOut.mint(to, amountOut);

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
        uint256,
        uint256,
        address to,
        uint256
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(tokenA == address(weth) && tokenB == address(usdc), "PAIR");
        require(weth.transferFrom(msg.sender, address(this), amountADesired), "WETH_IN");
        require(usdc.transferFrom(msg.sender, address(this), amountBDesired), "USDC_IN");

        amountA = amountADesired;
        amountB = amountBDesired;
        liquidity = amountBDesired + ((amountADesired * USDC_PER_WETH) / 1e18);
        lpToken.mint(to, liquidity);
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
        require(tokenA == address(weth) && tokenB == address(usdc), "PAIR");
        require(lpToken.transferFrom(msg.sender, address(this), liquidity), "LP_IN");

        uint256 halfValue = liquidity / 2;
        amountA = (halfValue * 1e18) / USDC_PER_WETH;
        amountB = liquidity - halfValue;
        require(amountA >= amountAMin && amountB >= amountBMin, "REMOVE_SLIPPAGE");
        weth.mint(to, amountA);
        usdc.mint(to, amountB);
    }
}

