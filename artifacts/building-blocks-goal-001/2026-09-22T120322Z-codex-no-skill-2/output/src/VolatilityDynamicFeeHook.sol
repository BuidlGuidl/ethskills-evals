// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @notice Uniswap v4 hook that overrides a dynamic pool's LP fee on every swap.
/// @dev Deploy this hook to an address whose hook permission bits are exactly BEFORE_SWAP_FLAG.
contract VolatilityDynamicFeeHook is IHooks {
    using LPFeeLibrary for uint24;
    using PoolIdLibrary for PoolKey;

    struct FeeConfig {
        uint24 calmFee;
        uint24 normalFee;
        uint24 volatileFee;
        uint256 calmThresholdE18;
        uint256 volatileThresholdE18;
    }

    error FeeTooLarge(uint24 fee);
    error InvalidFeeOrder();
    error InvalidHookAddress(address hook);
    error InvalidPoolCurrencyOrder();
    error InvalidThresholds();
    error NotOwner();
    error NotPoolManager();
    error PoolMustUseDynamicFee();
    error UnauthorizedPool(PoolId poolId);
    error UnsupportedHook();

    event FeeConfigUpdated(FeeConfig config);
    event OracleUpdated(IVolatilityOracle indexed oracle);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);

    IPoolManager public immutable POOL_MANAGER;
    PoolId public immutable TARGET_POOL_ID;
    address public owner;
    IVolatilityOracle public volatilityOracle;
    FeeConfig public feeConfig;

    constructor(
        IPoolManager poolManager_,
        Currency currency0,
        Currency currency1,
        int24 tickSpacing,
        FeeConfig memory initialFeeConfig,
        IVolatilityOracle initialOracle
    ) {
        if (currency0 >= currency1) revert InvalidPoolCurrencyOrder();

        Hooks.Permissions memory permissions;
        permissions.beforeSwap = true;
        if (!hasExactHookPermissions(address(this), permissions)) revert InvalidHookAddress(address(this));

        POOL_MANAGER = poolManager_;
        owner = msg.sender;

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(this))
        });
        TARGET_POOL_ID = key.toId();

        _setFeeConfig(initialFeeConfig);
        volatilityOracle = initialOracle;

        emit OwnerTransferred(address(0), msg.sender);
        emit OracleUpdated(initialOracle);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlyPoolManager() {
        _onlyPoolManager();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnerTransferred(oldOwner, newOwner);
    }

    function setOracle(IVolatilityOracle newOracle) external onlyOwner {
        volatilityOracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    function setFeeConfig(FeeConfig calldata newFeeConfig) external onlyOwner {
        _setFeeConfig(newFeeConfig);
    }

    function quoteFee(PoolKey calldata key, bytes calldata hookData)
        external
        view
        returns (uint24 fee, uint256 volatilityE18)
    {
        _validatePool(key);
        volatilityE18 = _currentVolatility(key, hookData);
        fee = _feeForVolatility(volatilityE18);
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata hookData)
        external
        view
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        _validatePool(key);

        uint24 fee = _feeForVolatility(_currentVolatility(key, hookData));
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        revert UnsupportedHook();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        revert UnsupportedHook();
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert UnsupportedHook();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert UnsupportedHook();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert UnsupportedHook();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert UnsupportedHook();
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        override
        returns (bytes4, int128)
    {
        revert UnsupportedHook();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert UnsupportedHook();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert UnsupportedHook();
    }

    function hasExactHookPermissions(address hook, Hooks.Permissions memory permissions) public pure returns (bool) {
        uint160 flags = uint160(hook) & Hooks.ALL_HOOK_MASK;

        uint160 expected;
        if (permissions.beforeInitialize) expected |= Hooks.BEFORE_INITIALIZE_FLAG;
        if (permissions.afterInitialize) expected |= Hooks.AFTER_INITIALIZE_FLAG;
        if (permissions.beforeAddLiquidity) expected |= Hooks.BEFORE_ADD_LIQUIDITY_FLAG;
        if (permissions.afterAddLiquidity) expected |= Hooks.AFTER_ADD_LIQUIDITY_FLAG;
        if (permissions.beforeRemoveLiquidity) expected |= Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG;
        if (permissions.afterRemoveLiquidity) expected |= Hooks.AFTER_REMOVE_LIQUIDITY_FLAG;
        if (permissions.beforeSwap) expected |= Hooks.BEFORE_SWAP_FLAG;
        if (permissions.afterSwap) expected |= Hooks.AFTER_SWAP_FLAG;
        if (permissions.beforeDonate) expected |= Hooks.BEFORE_DONATE_FLAG;
        if (permissions.afterDonate) expected |= Hooks.AFTER_DONATE_FLAG;
        if (permissions.beforeSwapReturnDelta) expected |= Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG;
        if (permissions.afterSwapReturnDelta) expected |= Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG;
        if (permissions.afterAddLiquidityReturnDelta) expected |= Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG;
        if (permissions.afterRemoveLiquidityReturnDelta) expected |= Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;

        return flags == expected;
    }

    function _validatePool(PoolKey calldata key) internal view {
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();
        PoolId poolId = key.toId();
        if (PoolId.unwrap(poolId) != PoolId.unwrap(TARGET_POOL_ID)) revert UnauthorizedPool(poolId);
    }

    function _currentVolatility(PoolKey calldata key, bytes calldata hookData) internal view returns (uint256) {
        IVolatilityOracle oracle = volatilityOracle;
        if (address(oracle) == address(0)) return feeConfig.calmThresholdE18;
        return oracle.currentVolatility(TARGET_POOL_ID, key, hookData);
    }

    function _feeForVolatility(uint256 volatilityE18) internal view returns (uint24) {
        FeeConfig memory config = feeConfig;
        if (volatilityE18 <= config.calmThresholdE18) return config.calmFee;
        if (volatilityE18 >= config.volatileThresholdE18) return config.volatileFee;
        return config.normalFee;
    }

    function _setFeeConfig(FeeConfig memory newFeeConfig) internal {
        _validateFee(newFeeConfig.calmFee);
        _validateFee(newFeeConfig.normalFee);
        _validateFee(newFeeConfig.volatileFee);

        if (newFeeConfig.calmFee > newFeeConfig.normalFee || newFeeConfig.normalFee > newFeeConfig.volatileFee) {
            revert InvalidFeeOrder();
        }
        if (newFeeConfig.calmThresholdE18 >= newFeeConfig.volatileThresholdE18) revert InvalidThresholds();

        feeConfig = newFeeConfig;
        emit FeeConfigUpdated(newFeeConfig);
    }

    function _validateFee(uint24 fee) internal pure {
        if (!fee.isValid()) revert FeeTooLarge(fee);
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _onlyPoolManager() internal view {
        if (msg.sender != address(POOL_MANAGER)) revert NotPoolManager();
    }
}
