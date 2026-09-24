// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Subset of the Chainlink AggregatorV3 interface that we actually use.
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
