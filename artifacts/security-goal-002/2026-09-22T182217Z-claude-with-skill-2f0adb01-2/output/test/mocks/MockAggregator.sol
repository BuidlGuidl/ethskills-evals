// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAggregatorV3} from "../../src/interfaces/IAggregatorV3.sol";

contract MockAggregator is IAggregatorV3 {
    uint8 public decimals;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
        roundId++;
        answeredInRound = roundId;
    }

    function setUpdatedAt(uint256 updatedAt_) external {
        updatedAt = updatedAt_;
    }

    function setAnsweredInRound(uint80 v) external {
        answeredInRound = v;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, answeredInRound);
    }
}
