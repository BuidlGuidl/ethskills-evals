// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStrategy {
    function vault() external view returns (address);
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function harvest(uint256 minRewardOut) external returns (uint256 profit);
    function withdraw(uint256 num, uint256 den) external returns (uint256 assetsOut);
    function exitAll(uint256 minAssetsOut) external returns (uint256 assetsOut);
}
