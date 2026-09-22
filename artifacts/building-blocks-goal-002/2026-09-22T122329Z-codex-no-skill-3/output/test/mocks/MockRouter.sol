// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAerodromeRouter} from "../../src/interfaces/IAerodrome.sol";
import {MockERC20} from "./MockERC20.sol";
import {MockPair} from "./MockPair.sol";

contract MockRouter is IAerodromeRouter {
    MockERC20 public immutable usdc;
    MockERC20 public immutable weth;
    MockERC20 public immutable reward;
    MockPair public immutable pair;

    uint256 public wethPriceUsdc = 2_000e6;
    uint256 public rewardPriceUsdc = 1e6;

    constructor(MockERC20 usdc_, MockERC20 weth_, MockERC20 reward_, MockPair pair_) {
        usdc = usdc_;
        weth = weth_;
        reward = reward_;
        pair = pair_;
    }

    function setWethPriceUsdc(uint256 price) external {
        wethPriceUsdc = price;
    }

    function setRewardPriceUsdc(uint256 price) external {
        rewardPriceUsdc = price;
    }

    function getAmountsOut(uint256 amountIn, Route[] calldata routes) external view returns (uint256[] memory amounts) {
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        for (uint256 i; i < routes.length; i++) {
            amounts[i + 1] = _quote(routes[i].from, routes[i].to, amounts[i]);
        }
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

        address currentSender = msg.sender;
        for (uint256 i; i < routes.length; i++) {
            Route calldata route = routes[i];
            uint256 out = _quote(route.from, route.to, amounts[i]);
            require(out >= amountOutMin, "SLIPPAGE");

            MockERC20(route.from).transferFrom(currentSender, address(this), amounts[i]);
            MockERC20(route.to).mint(i == routes.length - 1 ? to : address(this), out);

            amounts[i + 1] = out;
            currentSender = address(this);
        }
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
        require(tokenA == address(usdc) && tokenB == address(weth), "TOKENS");
        require(amountADesired >= amountAMin && amountBDesired >= amountBMin, "SLIPPAGE");

        usdc.transferFrom(msg.sender, address(pair), amountADesired);
        weth.transferFrom(msg.sender, address(pair), amountBDesired);

        uint256 wethValueUsdc = (amountBDesired * wethPriceUsdc) / 1e18;
        liquidity = (amountADesired + wethValueUsdc) * 1e12;
        pair.mintLiquidity(to, amountADesired, amountBDesired, liquidity);

        return (amountADesired, amountBDesired, liquidity);
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
        require(tokenA == address(usdc) && tokenB == address(weth), "TOKENS");
        pair.transferFrom(msg.sender, address(pair), liquidity);
        (amountA, amountB) = pair.burnLiquidity(address(pair), to, liquidity);
        require(amountA >= amountAMin && amountB >= amountBMin, "SLIPPAGE");
    }

    function _quote(address from, address to, uint256 amountIn) internal view returns (uint256) {
        if (from == address(usdc) && to == address(weth)) {
            return (amountIn * 1e18) / wethPriceUsdc;
        }
        if (from == address(weth) && to == address(usdc)) {
            return (amountIn * wethPriceUsdc) / 1e18;
        }
        if (from == address(reward) && to == address(usdc)) {
            return (amountIn * rewardPriceUsdc) / 1e18;
        }
        revert("ROUTE");
    }
}

