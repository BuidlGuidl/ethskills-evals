// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockAggregator {
    uint8 public decimals = 8;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;

    constructor(int256 answer_) {
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
        roundId += 1;
        answeredInRound = roundId;
    }

    function setUpdatedAt(uint256 t) external {
        updatedAt = t;
    }

    function setAnsweredInRound(uint80 r) external {
        answeredInRound = r;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, answeredInRound);
    }
}
