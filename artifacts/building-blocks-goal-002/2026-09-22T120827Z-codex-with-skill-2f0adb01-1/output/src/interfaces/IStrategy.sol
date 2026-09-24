// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategy {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function deposit(uint256 assets) external;
    function withdraw(uint256 assets) external returns (uint256 withdrawn);
    function harvest(uint256 minRewardAssets, uint256 minPairedWeth, uint256 minLiquidity)
        external
        returns (uint256 compoundedAssets);
}

