// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IVolatilityOracle} from "./IVolatilityOracle.sol";
import {Owned} from "./Owned.sol";

contract VolatilityFeeHook is BaseHook, Owned {
    using LPFeeLibrary for uint24;

    struct FeeConfig {
        uint24 calmFee;
        uint24 normalFee;
        uint24 volatileFee;
        uint32 normalThresholdBips;
        uint32 volatileThresholdBips;
    }

    error PoolMustUseDynamicFee();
    error PoolNotEnabled(PoolId poolId);
    error InvalidFeeConfig();
    error ZeroOracle();

    IVolatilityOracle public volatilityOracle;
    FeeConfig public feeConfig;
    mapping(PoolId poolId => bool enabled) public enabledPools;

    event VolatilityOracleSet(address indexed oracle);
    event FeeConfigSet(
        uint24 calmFee, uint24 normalFee, uint24 volatileFee, uint32 normalThresholdBips, uint32 volatileThresholdBips
    );
    event PoolEnabled(PoolId indexed poolId, bool enabled);

    constructor(
        IPoolManager poolManager,
        address initialOwner,
        IVolatilityOracle initialOracle,
        FeeConfig memory initialConfig
    ) BaseHook(poolManager) Owned(initialOwner) {
        _setVolatilityOracle(initialOracle);
        _setFeeConfig(initialConfig);
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory permissions) {
        permissions.beforeSwap = true;
    }

    function setVolatilityOracle(IVolatilityOracle newOracle) external onlyOwner {
        _setVolatilityOracle(newOracle);
    }

    function setFeeConfig(FeeConfig calldata newConfig) external onlyOwner {
        _setFeeConfig(newConfig);
    }

    function setPoolEnabled(PoolKey calldata key, bool enabled) external onlyOwner returns (PoolId poolId) {
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();
        poolId = poolIdFor(key);
        enabledPools[poolId] = enabled;
        emit PoolEnabled(poolId, enabled);
    }

    function poolIdFor(PoolKey calldata key) public pure returns (PoolId) {
        return PoolId.wrap(keccak256(abi.encode(key)));
    }

    function feeForVolatility(uint32 volatilityBips) public view returns (uint24) {
        FeeConfig memory config = feeConfig;

        if (volatilityBips < config.normalThresholdBips) {
            return config.calmFee;
        }

        if (volatilityBips < config.volatileThresholdBips) {
            return config.normalFee;
        }

        return config.volatileFee;
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        internal
        view
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();

        PoolId poolId = poolIdFor(key);
        if (!enabledPools[poolId]) revert PoolNotEnabled(poolId);

        uint24 swapFee = feeForVolatility(volatilityOracle.volatilityBips(poolId));
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, swapFee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _setVolatilityOracle(IVolatilityOracle newOracle) internal {
        if (address(newOracle) == address(0)) revert ZeroOracle();
        volatilityOracle = newOracle;
        emit VolatilityOracleSet(address(newOracle));
    }

    function _setFeeConfig(FeeConfig memory newConfig) internal {
        if (
            !newConfig.calmFee.isValid() || !newConfig.normalFee.isValid() || !newConfig.volatileFee.isValid()
                || newConfig.calmFee > newConfig.normalFee || newConfig.normalFee > newConfig.volatileFee
                || newConfig.normalThresholdBips > newConfig.volatileThresholdBips
        ) {
            revert InvalidFeeConfig();
        }

        feeConfig = newConfig;
        emit FeeConfigSet(
            newConfig.calmFee,
            newConfig.normalFee,
            newConfig.volatileFee,
            newConfig.normalThresholdBips,
            newConfig.volatileThresholdBips
        );
    }
}
