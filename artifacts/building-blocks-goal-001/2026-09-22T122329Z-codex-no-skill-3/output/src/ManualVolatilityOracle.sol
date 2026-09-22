// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IVolatilityOracle} from "./IVolatilityOracle.sol";
import {Owned} from "./Owned.sol";

contract ManualVolatilityOracle is IVolatilityOracle, Owned {
    mapping(PoolId poolId => uint32 volatilityBips) public volatilityByPool;

    event VolatilitySet(PoolId indexed poolId, uint32 volatilityBips);

    constructor(address initialOwner) Owned(initialOwner) {}

    function setVolatilityBips(PoolId poolId, uint32 volatilityBips_) external onlyOwner {
        volatilityByPool[poolId] = volatilityBips_;
        emit VolatilitySet(poolId, volatilityBips_);
    }

    function volatilityBips(PoolId poolId) external view returns (uint32) {
        return volatilityByPool[poolId];
    }
}
