// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IYieldStrategy {
    function deposit(uint256 assets, uint256 minWethOut, uint256 minLiquidity) external returns (uint128 liquidity);
    function withdrawLiquidity(uint128 liquidity, uint256 minAssetsOut) external returns (uint256 assetsOut);
    function positionLiquidity() external view returns (uint128);
}

