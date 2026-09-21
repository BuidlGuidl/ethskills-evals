// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IVolatilityOracle} from "../interfaces/IVolatilityOracle.sol";

/// @notice Placeholder signal: a single score set by an updater (keeper / multisig).
/// @dev Stub for launch and testing. Replace with a real signal via DynamicFeeHook.setOracle, no hook redeploy needed.
contract ManualVolatilityOracle is IVolatilityOracle {
    uint256 public constant MAX_SCORE = 1e18;

    address public updater;
    uint256 public score;

    event ScoreUpdated(uint256 score);
    event UpdaterChanged(address updater);

    error NotUpdater();
    error ScoreTooHigh();

    constructor(address _updater, uint256 _initialScore) {
        if (_initialScore > MAX_SCORE) revert ScoreTooHigh();
        updater = _updater;
        score = _initialScore;
    }

    function volatilityScore(PoolKey calldata) external view returns (uint256) {
        return score;
    }

    function setScore(uint256 _score) external {
        if (msg.sender != updater) revert NotUpdater();
        if (_score > MAX_SCORE) revert ScoreTooHigh();
        score = _score;
        emit ScoreUpdated(_score);
    }

    function setUpdater(address _updater) external {
        if (msg.sender != updater) revert NotUpdater();
        updater = _updater;
        emit UpdaterChanged(_updater);
    }
}
