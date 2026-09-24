// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @notice Uniswap v4 hook that returns a low or high LP fee on every swap.
/// @dev Deploy this hook to an address whose low bits include BEFORE_SWAP_FLAG.
/// The target pool must be initialized with LPFeeLibrary.DYNAMIC_FEE_FLAG and
/// this hook address in its PoolKey.
contract DynamicVolatilityFeeHook is IHooks {
    using PoolIdLibrary for PoolKey;

    uint160 public constant ALL_HOOK_MASK = uint160((1 << 14) - 1);
    uint160 public constant REQUIRED_HOOK_FLAGS = 1 << 7;

    error NotPoolManager();
    error NotOwner();
    error InvalidFee();
    error InvalidFeeOrder();
    error InvalidOracle();
    error PoolNotConfigured();
    error TargetPoolAlreadySet();
    error UnauthorizedPool(PoolId expectedPoolId, PoolId actualPoolId);
    error HookNotImplemented();

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event FeePolicyUpdated(uint24 calmFee, uint24 volatileFee, uint256 volatilityThresholdBps);
    event TargetPoolSet(PoolId indexed poolId);

    IPoolManager public immutable POOL_MANAGER;

    address public owner;
    IVolatilityOracle public volatilityOracle;
    PoolId public targetPoolId;

    uint24 public calmFee;
    uint24 public volatileFee;
    uint256 public volatilityThresholdBps;

    constructor(
        IPoolManager _poolManager,
        IVolatilityOracle _volatilityOracle,
        uint24 _calmFee,
        uint24 _volatileFee,
        uint256 _volatilityThresholdBps
    ) {
        if (address(_poolManager) == address(0)) revert NotPoolManager();
        POOL_MANAGER = _poolManager;
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);

        _setOracle(_volatilityOracle);
        _setFeePolicy(_calmFee, _volatileFee, _volatilityThresholdBps);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlyPoolManager() {
        _onlyPoolManager();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _onlyPoolManager() internal view {
        if (msg.sender != address(POOL_MANAGER)) revert NotPoolManager();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert NotOwner();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    function hasExpectedHookAddress() external view returns (bool) {
        return (uint160(address(this)) & ALL_HOOK_MASK) == REQUIRED_HOOK_FLAGS;
    }

    function setOracle(IVolatilityOracle newOracle) external onlyOwner {
        _setOracle(newOracle);
    }

    function setFeePolicy(uint24 newCalmFee, uint24 newVolatileFee, uint256 newVolatilityThresholdBps)
        external
        onlyOwner
    {
        _setFeePolicy(newCalmFee, newVolatileFee, newVolatilityThresholdBps);
    }

    /// @notice Locks this hook to the intended v4 dynamic-fee pool.
    /// @dev Call before initializing the production pool. The key must contain
    /// this hook address and LPFeeLibrary.DYNAMIC_FEE_FLAG.
    function setTargetPool(PoolKey calldata key) external onlyOwner {
        if (PoolId.unwrap(targetPoolId) != bytes32(0)) revert TargetPoolAlreadySet();
        if (address(key.hooks) != address(this) || key.fee != LPFeeLibrary.DYNAMIC_FEE_FLAG) {
            revert PoolNotConfigured();
        }

        targetPoolId = key.toId();
        emit TargetPoolSet(targetPoolId);
    }

    function previewFee(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        returns (uint24 fee)
    {
        _validateTargetPool(key);
        fee = _feeForSwap(key, params, hookData);
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        _validateTargetPool(key);

        uint24 fee = _feeForSwap(key, params, hookData);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _feeForSwap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        view
        returns (uint24)
    {
        uint256 volatility = volatilityOracle.volatilityBps(targetPoolId, key, params, hookData);
        return volatility >= volatilityThresholdBps ? volatileFee : calmFee;
    }

    function _validateTargetPool(PoolKey calldata key) internal view {
        PoolId configuredPoolId = targetPoolId;
        if (PoolId.unwrap(configuredPoolId) == bytes32(0)) revert PoolNotConfigured();

        PoolId actualPoolId = key.toId();
        if (PoolId.unwrap(actualPoolId) != PoolId.unwrap(configuredPoolId)) {
            revert UnauthorizedPool(configuredPoolId, actualPoolId);
        }
    }

    function _setOracle(IVolatilityOracle newOracle) internal {
        if (address(newOracle) == address(0)) revert InvalidOracle();
        emit OracleUpdated(address(volatilityOracle), address(newOracle));
        volatilityOracle = newOracle;
    }

    function _setFeePolicy(uint24 newCalmFee, uint24 newVolatileFee, uint256 newVolatilityThresholdBps)
        internal
    {
        if (!LPFeeLibrary.isValid(newCalmFee) || !LPFeeLibrary.isValid(newVolatileFee)) revert InvalidFee();
        if (newCalmFee > newVolatileFee) revert InvalidFeeOrder();

        calmFee = newCalmFee;
        volatileFee = newVolatileFee;
        volatilityThresholdBps = newVolatilityThresholdBps;

        emit FeePolicyUpdated(newCalmFee, newVolatileFee, newVolatilityThresholdBps);
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
}
