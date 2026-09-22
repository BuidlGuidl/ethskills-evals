// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "../../src/interfaces/IERC20.sol";
import { ISwapRouter } from "../../src/interfaces/ISwapRouter.sol";
import { SafeTransferLib } from "../../src/SafeTransferLib.sol";

interface IMintableERC20 {
    function mint(address to, uint256 amount) external;
}

contract MockSwapRouter is ISwapRouter {
    using SafeTransferLib for IERC20;

    address public immutable usdc;
    address public immutable weth;
    uint256 public wethPerUsdc;

    constructor(address usdc_, address weth_, uint256 wethPerUsdc_) {
        usdc = usdc_;
        weth = weth_;
        wethPerUsdc = wethPerUsdc_;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        require(block.timestamp <= params.deadline, "DEADLINE");
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        if (params.tokenIn == usdc && params.tokenOut == weth) {
            amountOut = params.amountIn * wethPerUsdc / 1e6;
        } else if (params.tokenIn == weth && params.tokenOut == usdc) {
            amountOut = params.amountIn * 1e6 / wethPerUsdc;
        } else {
            revert("PAIR");
        }

        require(amountOut >= params.amountOutMinimum, "MIN_OUT");
        IMintableERC20(params.tokenOut).mint(params.recipient, amountOut);
    }
}
