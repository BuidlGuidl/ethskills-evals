// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Price source consumed by {LendingPool}.
interface IPriceOracle {
    /// @return USD price of one whole token, scaled to 18 decimals. Reverts if the price is not usable.
    function price() external view returns (uint256);
}
