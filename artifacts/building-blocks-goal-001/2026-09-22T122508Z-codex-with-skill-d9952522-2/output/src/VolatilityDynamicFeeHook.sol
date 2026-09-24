// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @notice Uniswap v4 hook that raises or lowers the LP fee from an external volatility signal.
/// @dev Pools must be created with LPFeeLibrary.DYNAMIC_FEE_FLAG and this hook address.
contract VolatilityDynamicFeeHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    struct FeeConfig {
        uint24 calmFee;
        uint24 volatileFee;
        uint256 volatilityThresholdBps;
    }

    address public owner;
    IVolatilityOracle public volatilityOracle;
    FeeConfig public feeConfig;

    error NotOwner();
    error FeeTooLarge(uint24 fee);
    error VolatileFeeBelowCalmFee(uint24 calmFee, uint24 volatileFee);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event VolatilityOracleUpdated(address indexed oracle);
    event FeeConfigUpdated(uint24 calmFee, uint24 volatileFee, uint256 volatilityThresholdBps);
    event DynamicFeeSelected(
        PoolId indexed poolId, address indexed sender, uint256 volatilityBps, uint24 fee, bool volatilePeriod
    );

    constructor(
        IPoolManager manager,
        address initialOwner,
        IVolatilityOracle initialOracle,
        FeeConfig memory initialFeeConfig
    ) BaseHook(manager) {
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
        _setVolatilityOracle(initialOracle);
        _setFeeConfig(initialFeeConfig);
        emit OwnershipTransferred(address(0), owner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory permissions) {
        permissions.beforeSwap = true;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnershipTransferred(msg.sender, newOwner);
    }

    function setVolatilityOracle(IVolatilityOracle newOracle) external onlyOwner {
        _setVolatilityOracle(newOracle);
    }

    function setFeeConfig(FeeConfig calldata newFeeConfig) external onlyOwner {
        _setFeeConfig(newFeeConfig);
    }

    function previewFee(uint256 volatilityBps) external view returns (uint24 fee, bool volatilePeriod) {
        return _feeForVolatility(volatilityBps);
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint256 currentVolatilityBps = _volatilityBps(key, params, hookData);
        (uint24 selectedFee, bool volatilePeriod) = _feeForVolatility(currentVolatilityBps);

        emit DynamicFeeSelected(key.toId(), sender, currentVolatilityBps, selectedFee, volatilePeriod);

        return
            (
                IHooks.beforeSwap.selector,
                BeforeSwapDeltaLibrary.ZERO_DELTA,
                selectedFee | LPFeeLibrary.OVERRIDE_FEE_FLAG
            );
    }

    function _volatilityBps(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        view
        virtual
        returns (uint256)
    {
        return volatilityOracle.volatilityBps(key, params, hookData);
    }

    function _feeForVolatility(uint256 volatilityBps) internal view returns (uint24 fee, bool volatilePeriod) {
        FeeConfig memory config = feeConfig;
        volatilePeriod = volatilityBps >= config.volatilityThresholdBps;
        fee = volatilePeriod ? config.volatileFee : config.calmFee;
    }

    function _setVolatilityOracle(IVolatilityOracle newOracle) internal {
        volatilityOracle = newOracle;
        emit VolatilityOracleUpdated(address(newOracle));
    }

    function _setFeeConfig(FeeConfig memory newFeeConfig) internal {
        _validateFee(newFeeConfig.calmFee);
        _validateFee(newFeeConfig.volatileFee);
        if (newFeeConfig.volatileFee < newFeeConfig.calmFee) {
            revert VolatileFeeBelowCalmFee(newFeeConfig.calmFee, newFeeConfig.volatileFee);
        }

        feeConfig = newFeeConfig;
        emit FeeConfigUpdated(newFeeConfig.calmFee, newFeeConfig.volatileFee, newFeeConfig.volatilityThresholdBps);
    }

    function _validateFee(uint24 fee) internal pure {
        if (fee > LPFeeLibrary.MAX_LP_FEE) revert FeeTooLarge(fee);
    }
}
