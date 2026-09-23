// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Bare ERC-20 surface WeatherBilling needs. No dependencies.
interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
