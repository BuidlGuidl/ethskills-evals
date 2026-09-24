// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal price source used by {LendingMarket}.
interface IPriceOracle {
    /// @return USD price of one whole collateral token, scaled to 18 decimals.
    function collateralPrice() external view returns (uint256);

    /// @return USD price of one whole debt token, scaled to 18 decimals.
    function debtPrice() external view returns (uint256);
}
