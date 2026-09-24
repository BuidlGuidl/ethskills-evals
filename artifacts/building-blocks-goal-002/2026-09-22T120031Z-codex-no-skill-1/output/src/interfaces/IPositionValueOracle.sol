// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPositionValueOracle {
    function positionValueInAsset(uint256 tokenId) external view returns (uint256);
    function tokenValueInAsset(address token, uint256 amount) external view returns (uint256);
}

