// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Owned} from "./Owned.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";
import {PoolId, PoolIdLibrary, PoolKey, SwapParams} from "./V4Types.sol";

contract ManualVolatilityOracle is Owned, IVolatilityOracle {
    using PoolIdLibrary for PoolKey;

    uint256 public defaultVolatilityE18;
    mapping(PoolId poolId => uint256 volatilityE18) public poolVolatilityE18;
    mapping(PoolId poolId => bool isSet) public hasPoolVolatility;

    event DefaultVolatilitySet(uint256 volatilityE18);
    event PoolVolatilitySet(PoolId indexed poolId, uint256 volatilityE18);
    event PoolVolatilityCleared(PoolId indexed poolId);

    constructor(address initialOwner, uint256 initialDefaultVolatilityE18) Owned(initialOwner) {
        defaultVolatilityE18 = initialDefaultVolatilityE18;
        emit DefaultVolatilitySet(initialDefaultVolatilityE18);
    }

    function setDefaultVolatility(uint256 volatilityE18) external onlyOwner {
        defaultVolatilityE18 = volatilityE18;
        emit DefaultVolatilitySet(volatilityE18);
    }

    function setPoolVolatility(PoolKey calldata key, uint256 volatilityE18) external onlyOwner {
        PoolId poolId = key.toIdCalldata();
        poolVolatilityE18[poolId] = volatilityE18;
        hasPoolVolatility[poolId] = true;
        emit PoolVolatilitySet(poolId, volatilityE18);
    }

    function clearPoolVolatility(PoolKey calldata key) external onlyOwner {
        PoolId poolId = key.toIdCalldata();
        delete poolVolatilityE18[poolId];
        delete hasPoolVolatility[poolId];
        emit PoolVolatilityCleared(poolId);
    }

    function currentVolatility(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        view
        returns (uint256 volatilityE18)
    {
        PoolId poolId = key.toIdCalldata();
        if (hasPoolVolatility[poolId]) return poolVolatilityE18[poolId];
        return defaultVolatilityE18;
    }
}
