// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal oracle surface consumed by {LendingPool}.
interface IPriceOracle {
    /// @notice Price of one whole collateral token, denominated in USD, scaled to 18 decimals.
    /// @dev MUST revert rather than return a stale, zero, or circuit-broken price. The pool treats
    ///      a revert here as "the market is closed", which is the safe failure mode: it blocks
    ///      borrowing, withdrawals and liquidations instead of acting on a bad number.
    function price() external view returns (uint256);
}
