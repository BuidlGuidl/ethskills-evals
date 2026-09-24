// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IAerodromeRouter } from "../../src/interfaces/IAerodrome.sol";
import { MockAerodromePool } from "./MockAerodromePool.sol";
import { MockERC20 } from "./MockERC20.sol";

contract MockAerodromeRouter is IAerodromeRouter {
    MockERC20 public immutable weth;
    MockERC20 public immutable usdc;
    MockERC20 public immutable aero;
    MockAerodromePool public immutable pool;

    uint256 public constant USDC_PER_WETH = 2_000e6;

    constructor(MockERC20 weth_, MockERC20 usdc_, MockERC20 aero_, MockAerodromePool pool_) {
        weth = weth_;
        usdc = usdc_;
        aero = aero_;
        pool = pool_;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256
    ) external override returns (uint256[] memory amounts) {
        require(routes.length == 1, "ROUTE");
        MockERC20 from = MockERC20(routes[0].from);
        MockERC20 out = MockERC20(routes[0].to);

        require(from.transferFrom(msg.sender, address(this), amountIn), "TRANSFER_IN");
        uint256 amountOut;
        if (address(from) == address(usdc) && address(out) == address(weth)) {
            amountOut = amountIn * 1e18 / USDC_PER_WETH;
        } else if (address(from) == address(weth) && address(out) == address(usdc)) {
            amountOut = amountIn * USDC_PER_WETH / 1e18;
        } else if (address(from) == address(aero) && address(out) == address(usdc)) {
            amountOut = amountIn / 1e12;
        } else {
            revert("PAIR");
        }

        require(amountOut >= amountOutMin, "SLIPPAGE");
        out.mint(to, amountOut);

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
        uint256
    ) external override returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(tokenA == address(weth) && tokenB == address(usdc), "TOKENS");
        require(amountADesired >= amountAMin && amountBDesired >= amountBMin, "ADD_SLIPPAGE");

        uint256 usdcValueOfWeth = amountADesired * USDC_PER_WETH / 1e18;
        amountA = amountADesired;
        amountB = amountBDesired;
        uint256 lpSupply = pool.totalSupply();
        (, uint256 usdcReserve,) = pool.getReserves();
        liquidity = (usdcValueOfWeth + amountB) * lpSupply / (2 * usdcReserve);

        require(weth.transferFrom(msg.sender, address(pool), amountA), "WETH_IN");
        require(usdc.transferFrom(msg.sender, address(pool), amountB), "USDC_IN");
        pool.addReserves(amountA, amountB);
        pool.mintLp(to, liquidity);
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
    ) external override returns (uint256 amountA, uint256 amountB) {
        require(tokenA == address(weth) && tokenB == address(usdc), "TOKENS");
        uint256 lpSupply = pool.totalSupply();
        (uint256 wethReserve, uint256 usdcReserve,) = pool.getReserves();

        amountA = liquidity * wethReserve / lpSupply;
        amountB = liquidity * usdcReserve / lpSupply;
        require(amountA >= amountAMin && amountB >= amountBMin, "REMOVE_SLIPPAGE");

        require(pool.transferFrom(msg.sender, address(this), liquidity), "LP_IN");
        pool.burnLp(address(this), liquidity);
        pool.removeReserves(amountA, amountB);
        weth.mint(to, amountA);
        usdc.mint(to, amountB);
    }
}
