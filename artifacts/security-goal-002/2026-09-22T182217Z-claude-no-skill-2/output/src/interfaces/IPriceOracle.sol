// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Price source for the market's collateral asset.
interface IPriceOracle {
    /// @notice Price of one whole unit of collateral (1 WETH) quoted in USD, scaled by 1e18.
    /// @dev MUST revert rather than return a stale, zero or otherwise untrustworthy price.
    ///      Reverting is the safe failure mode: it freezes borrowing, collateral withdrawal
    ///      and liquidation, but it never lets the market act on a bad number.
    function collateralPriceUsd() external view returns (uint256);
}
