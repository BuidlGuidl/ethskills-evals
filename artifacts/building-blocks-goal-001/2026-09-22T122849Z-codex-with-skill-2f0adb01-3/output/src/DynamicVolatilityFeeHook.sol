// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";
import {Owned} from "./utils/Owned.sol";

import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/// @notice Uniswap v4 hook that overrides a dynamic pool's LP fee on every swap.
/// @dev The hook address must be mined so its low permission bits equal Hooks.BEFORE_SWAP_FLAG.
contract DynamicVolatilityFeeHook is IHooks, Owned {
    using LPFeeLibrary for uint24;

    struct FeeConfig {
        uint24 calmFee;
        uint24 normalFee;
        uint24 volatileFee;
        uint256 normalVolatilityBps;
        uint256 volatileVolatilityBps;
    }

    error HookNotImplemented();
    error NotPoolManager();
    error PoolMustUseThisHook();
    error PoolMustBeDynamicFee();
    error InvalidFeeThresholds();
    error ZeroAddress();

    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event FeeConfigUpdated(FeeConfig config);

    IPoolManager public immutable POOL_MANAGER;
    IVolatilityOracle public oracle;
    FeeConfig public feeConfig;

    constructor(
        IPoolManager poolManager_,
        IVolatilityOracle oracle_,
        FeeConfig memory initialFeeConfig,
        address initialOwner
    ) Owned(initialOwner)
    {
        if (address(poolManager_) == address(0) || address(oracle_) == address(0)) revert ZeroAddress();

        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());

        POOL_MANAGER = poolManager_;
        oracle = oracle_;
        _setFeeConfig(initialFeeConfig);
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function requiredHookFlags() external pure returns (uint160) {
        return Hooks.BEFORE_SWAP_FLAG;
    }

    function dynamicPoolFeeFlag() external pure returns (uint24) {
        return LPFeeLibrary.DYNAMIC_FEE_FLAG;
    }

    function setOracle(IVolatilityOracle newOracle) external onlyOwner {
        if (address(newOracle) == address(0)) revert ZeroAddress();
        emit OracleUpdated(address(oracle), address(newOracle));
        oracle = newOracle;
    }

    function setFeeConfig(FeeConfig calldata newFeeConfig) external onlyOwner {
        _setFeeConfig(newFeeConfig);
    }

    function previewFee(uint256 volatilityBps) external view returns (uint24) {
        return _feeForVolatility(volatilityBps);
    }

    function beforeSwap(address swapper, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (msg.sender != address(POOL_MANAGER)) revert NotPoolManager();
        if (address(key.hooks) != address(this)) revert PoolMustUseThisHook();
        if (!key.fee.isDynamicFee()) revert PoolMustBeDynamicFee();

        uint256 currentVolatilityBps = oracle.volatilityBps(key, swapper, params, hookData);
        uint24 swapFee = _feeForVolatility(currentVolatilityBps);

        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            swapFee | LPFeeLibrary.OVERRIDE_FEE_FLAG
        );
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        override
        returns (bytes4, int128)
    {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function _setFeeConfig(FeeConfig memory newFeeConfig) internal {
        newFeeConfig.calmFee.validate();
        newFeeConfig.normalFee.validate();
        newFeeConfig.volatileFee.validate();

        if (newFeeConfig.normalVolatilityBps >= newFeeConfig.volatileVolatilityBps) {
            revert InvalidFeeThresholds();
        }

        feeConfig = newFeeConfig;
        emit FeeConfigUpdated(newFeeConfig);
    }

    function _feeForVolatility(uint256 volatilityBps) internal view returns (uint24) {
        FeeConfig memory config = feeConfig;

        if (volatilityBps >= config.volatileVolatilityBps) return config.volatileFee;
        if (volatilityBps >= config.normalVolatilityBps) return config.normalFee;
        return config.calmFee;
    }
}
