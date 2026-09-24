// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISwapRouterV3} from "../../src/interfaces/IUniswapV3Periphery.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {SafeERC20} from "../../src/libraries/SafeERC20.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockSwapRouter is ISwapRouterV3 {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public rates;

    function setRate(address tokenIn, address tokenOut, uint256 rate) external {
        rates[tokenIn][tokenOut] = rate;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        require(params.deadline >= block.timestamp, "EXPIRED");
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        uint256 rate = rates[params.tokenIn][params.tokenOut];
        amountOut = rate == 0 ? params.amountIn : (params.amountIn * rate) / 1e18;
        require(amountOut >= params.amountOutMinimum, "LOW_OUTPUT");

        MockERC20(params.tokenOut).mint(params.recipient, amountOut);
    }
}

