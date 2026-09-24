// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilityFeeOracle} from "./IVolatilityFeeOracle.sol";

/// @notice Simple operator-controlled volatility stub for launch rehearsals and testnets.
/// @dev Replace with a manipulation-resistant oracle before production liquidity depends on it.
contract StubVolatilityFeeOracle is IVolatilityFeeOracle {
    address public owner;
    uint256 public volatilityScore;
    uint256 public volatileThreshold;
    uint24 public calmFee;
    uint24 public volatileFee;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event VolatilityScoreSet(uint256 volatilityScore);
    event FeeConfigSet(uint24 calmFee, uint24 volatileFee, uint256 volatileThreshold);

    error OnlyOwner();
    error ZeroAddress();
    error InvalidFeeConfig();

    constructor(uint24 _calmFee, uint24 _volatileFee, uint256 _volatileThreshold) {
        owner = msg.sender;
        _setFeeConfig(_calmFee, _volatileFee, _volatileThreshold);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setVolatilityScore(uint256 newVolatilityScore) external onlyOwner {
        volatilityScore = newVolatilityScore;
        emit VolatilityScoreSet(newVolatilityScore);
    }

    function setFeeConfig(uint24 newCalmFee, uint24 newVolatileFee, uint256 newVolatileThreshold) external onlyOwner {
        _setFeeConfig(newCalmFee, newVolatileFee, newVolatileThreshold);
    }

    function getFee(PoolKey calldata, SwapParams calldata, bytes calldata) external view returns (uint24 fee) {
        return volatilityScore >= volatileThreshold ? volatileFee : calmFee;
    }

    function _setFeeConfig(uint24 newCalmFee, uint24 newVolatileFee, uint256 newVolatileThreshold) internal {
        if (newCalmFee > newVolatileFee || newVolatileFee > LPFeeLibrary.MAX_LP_FEE) revert InvalidFeeConfig();

        calmFee = newCalmFee;
        volatileFee = newVolatileFee;
        volatileThreshold = newVolatileThreshold;
        emit FeeConfigSet(newCalmFee, newVolatileFee, newVolatileThreshold);
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert OnlyOwner();
    }
}
