// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Prices assets in USD with 18 decimals of precision.
interface IPriceOracle {
    /// @return price USD price of one whole unit of `asset`, scaled by 1e18. Never zero; reverts if unusable.
    function getAssetPrice(address asset) external view returns (uint256 price);
}
