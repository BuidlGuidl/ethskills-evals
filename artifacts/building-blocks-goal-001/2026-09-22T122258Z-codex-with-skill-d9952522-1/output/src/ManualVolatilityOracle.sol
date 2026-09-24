// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Simple stub oracle used until the real volatility signal is wired in.
contract ManualVolatilityOracle is IVolatilityOracle {
    error OnlyOwner();
    error ZeroOwner();

    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);
    event VolatilityUpdated(uint256 volatilityBps);

    address public owner;
    uint256 public volatilityBps;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address initialOwner, uint256 initialVolatilityBps) {
        if (initialOwner == address(0)) revert ZeroOwner();

        owner = initialOwner;
        volatilityBps = initialVolatilityBps;

        emit OwnerTransferred(address(0), initialOwner);
        emit VolatilityUpdated(initialVolatilityBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroOwner();

        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setVolatilityBps(uint256 newVolatilityBps) external onlyOwner {
        volatilityBps = newVolatilityBps;
        emit VolatilityUpdated(newVolatilityBps);
    }

    function currentVolatilityBps(PoolKey calldata, SwapParams calldata, bytes calldata)
        external
        view
        returns (uint256)
    {
        return volatilityBps;
    }
}
