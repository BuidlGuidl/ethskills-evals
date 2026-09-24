// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISwapRouter} from "../../src/interfaces/ISwapRouter.sol";
import {SafeTransferLib} from "../../src/libraries/SafeTransferLib.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockSwapRouter is ISwapRouter {
    using SafeTransferLib for address;

    mapping(address => mapping(address => uint256)) public rate;

    function setRate(address tokenIn, address tokenOut, uint256 rateWad) external {
        rate[tokenIn][tokenOut] = rateWad;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        uint256 rateWad = rate[params.tokenIn][params.tokenOut];
        if (rateWad == 0) rateWad = 1e18;
        amountOut = (params.amountIn * rateWad) / 1e18;
        require(amountOut >= params.amountOutMinimum, "SLIPPAGE");

        params.tokenIn.safeTransferFrom(msg.sender, address(this), params.amountIn);
        MockERC20(params.tokenOut).mint(params.recipient, amountOut);
    }
}

