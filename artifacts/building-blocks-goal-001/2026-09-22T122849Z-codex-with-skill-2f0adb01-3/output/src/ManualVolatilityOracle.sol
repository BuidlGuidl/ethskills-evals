// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";
import {Owned} from "./utils/Owned.sol";

import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Simple manually-set volatility oracle stub.
/// @dev Replace with a production oracle that implements IVolatilityOracle before launch,
/// or point the hook at a new oracle through governance after launch.
contract ManualVolatilityOracle is IVolatilityOracle, Owned {
    using PoolIdLibrary for PoolKey;

    event DefaultVolatilitySet(uint256 volatilityBps);
    event PoolVolatilitySet(bytes32 indexed poolId, uint256 volatilityBps);
    event PoolVolatilityCleared(bytes32 indexed poolId);

    uint256 public defaultVolatilityBps;
    mapping(bytes32 poolId => uint256 volatilityBps) public poolVolatilityBps;
    mapping(bytes32 poolId => bool isSet) public hasPoolVolatility;

    constructor(address initialOwner, uint256 initialDefaultVolatilityBps) Owned(initialOwner) {
        defaultVolatilityBps = initialDefaultVolatilityBps;
        emit DefaultVolatilitySet(initialDefaultVolatilityBps);
    }

    function setDefaultVolatilityBps(uint256 newDefaultVolatilityBps) external onlyOwner {
        defaultVolatilityBps = newDefaultVolatilityBps;
        emit DefaultVolatilitySet(newDefaultVolatilityBps);
    }

    function setPoolVolatilityBps(PoolKey calldata key, uint256 newVolatilityBps) external onlyOwner {
        bytes32 id = _poolId(key);
        poolVolatilityBps[id] = newVolatilityBps;
        hasPoolVolatility[id] = true;
        emit PoolVolatilitySet(id, newVolatilityBps);
    }

    function clearPoolVolatilityBps(PoolKey calldata key) external onlyOwner {
        bytes32 id = _poolId(key);
        delete poolVolatilityBps[id];
        delete hasPoolVolatility[id];
        emit PoolVolatilityCleared(id);
    }

    function volatilityBps(PoolKey calldata key, address, SwapParams calldata, bytes calldata)
        external
        view
        returns (uint256)
    {
        bytes32 id = _poolId(key);
        if (hasPoolVolatility[id]) return poolVolatilityBps[id];
        return defaultVolatilityBps;
    }

    function _poolId(PoolKey calldata key) internal pure returns (bytes32) {
        PoolKey memory memoryKey = key;
        return PoolId.unwrap(memoryKey.toId());
    }
}

