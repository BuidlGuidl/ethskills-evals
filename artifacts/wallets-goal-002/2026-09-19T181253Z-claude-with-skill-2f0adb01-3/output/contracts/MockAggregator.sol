// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Fork-test only: a fresh-timestamp Chainlink stand-in, etched over the
///         real feed after time travel. Never deployed to mainnet.
contract MockAggregator {
    int256 public immutable answer;

    constructor(int256 answer_) {
        answer = answer_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}
