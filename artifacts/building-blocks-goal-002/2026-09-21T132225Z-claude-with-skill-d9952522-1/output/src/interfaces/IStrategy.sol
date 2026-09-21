// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IStrategy {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function invest() external;
    function withdraw(uint256 amount) external returns (uint256 sent);
    function harvest() external returns (uint256 profit);
}
