// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPriceOracle {
    /// @notice Price of one whole collateral token expressed in whole debt tokens, scaled by 1e18.
    /// @dev MUST revert rather than return a stale, non-positive or otherwise untrusted value.
    ///      e.g. ETH at $3000 and USDC at $1.00 returns 3000e18.
    function collateralPriceInDebt() external view returns (uint256);
}
