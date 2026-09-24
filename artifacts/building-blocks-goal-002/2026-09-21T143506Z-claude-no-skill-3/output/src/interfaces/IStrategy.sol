// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategy {
    function vault() external view returns (address);
    /// USDC value of everything the strategy holds, net of still-locked harvest profit.
    function totalAssets() external view returns (uint256);
    /// Send up to `amount` USDC to the vault; returns the amount actually sent.
    function withdraw(uint256 amount) external returns (uint256);
}
