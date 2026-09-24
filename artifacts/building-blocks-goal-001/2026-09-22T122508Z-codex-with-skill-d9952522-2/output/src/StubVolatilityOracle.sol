// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @notice Minimal mutable volatility source for dry runs and launch rehearsals.
/// @dev Replace with a production oracle before relying on the signal for real liquidity.
contract StubVolatilityOracle is IVolatilityOracle {
    address public owner;
    uint256 public stubVolatilityBps;

    error NotOwner();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event StubVolatilityUpdated(uint256 volatilityBps);

    constructor(address initialOwner, uint256 initialVolatilityBps) {
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
        stubVolatilityBps = initialVolatilityBps;
        emit OwnershipTransferred(address(0), owner);
        emit StubVolatilityUpdated(initialVolatilityBps);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function setStubVolatilityBps(uint256 newVolatilityBps) external onlyOwner {
        stubVolatilityBps = newVolatilityBps;
        emit StubVolatilityUpdated(newVolatilityBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnershipTransferred(msg.sender, newOwner);
    }

    function volatilityBps(PoolKey calldata, SwapParams calldata, bytes calldata) external view returns (uint256) {
        return stubVolatilityBps;
    }
}
