// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @notice Owner-controlled volatility oracle stub for deployment rehearsals and testnets.
contract ManualVolatilityOracle is IVolatilityOracle {
    error NotOwner();

    event DefaultVolatilityUpdated(uint256 volatilityE18);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);
    event PoolVolatilityUpdated(PoolId indexed poolId, uint256 volatilityE18);

    address public owner;
    uint256 public defaultVolatilityE18;
    mapping(PoolId poolId => uint256 volatilityE18) public poolVolatilityE18;
    mapping(PoolId poolId => bool configured) public hasPoolVolatility;

    constructor(uint256 initialDefaultVolatilityE18) {
        owner = msg.sender;
        defaultVolatilityE18 = initialDefaultVolatilityE18;
        emit OwnerTransferred(address(0), msg.sender);
        emit DefaultVolatilityUpdated(initialDefaultVolatilityE18);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnerTransferred(oldOwner, newOwner);
    }

    function setDefaultVolatility(uint256 volatilityE18) external onlyOwner {
        defaultVolatilityE18 = volatilityE18;
        emit DefaultVolatilityUpdated(volatilityE18);
    }

    function setPoolVolatility(PoolId poolId, uint256 volatilityE18) external onlyOwner {
        poolVolatilityE18[poolId] = volatilityE18;
        hasPoolVolatility[poolId] = true;
        emit PoolVolatilityUpdated(poolId, volatilityE18);
    }

    function clearPoolVolatility(PoolId poolId) external onlyOwner {
        delete poolVolatilityE18[poolId];
        delete hasPoolVolatility[poolId];
        emit PoolVolatilityUpdated(poolId, defaultVolatilityE18);
    }

    function currentVolatility(PoolId poolId, PoolKey calldata, bytes calldata)
        external
        view
        returns (uint256 volatilityE18)
    {
        if (hasPoolVolatility[poolId]) return poolVolatilityE18[poolId];
        return defaultVolatilityE18;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }
}
