// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";

/// @notice Pluggable volatility source used by VolatilityFeeHook.
/// @dev Return value is basis points of volatility. The implementation can be replaced
///      with an oracle, keeper-updated model, or onchain calculation before launch.
interface IVolatilitySignal {
    function volatilityBps(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        returns (uint32);
}

/// @notice Simple admin-set volatility signal for staging and launch rehearsals.
contract ManualVolatilitySignal is IVolatilitySignal {
    error NotOwner();
    error ZeroOwner();

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event VolatilityUpdated(uint32 volatilityBps);

    address public owner;
    uint32 public manualVolatilityBps;

    constructor(address initialOwner, uint32 initialVolatilityBps) {
        if (initialOwner == address(0)) revert ZeroOwner();

        owner = initialOwner;
        manualVolatilityBps = initialVolatilityBps;

        emit OwnershipTransferred(address(0), initialOwner);
        emit VolatilityUpdated(initialVolatilityBps);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function setVolatilityBps(uint32 newVolatilityBps) external onlyOwner {
        manualVolatilityBps = newVolatilityBps;
        emit VolatilityUpdated(newVolatilityBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroOwner();

        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function volatilityBps(PoolKey calldata, SwapParams calldata, bytes calldata) external view returns (uint32) {
        return manualVolatilityBps;
    }
}

abstract contract PoolManagerHook is IHooks {
    error NotPoolManager();

    IPoolManager public immutable POOL_MANAGER;

    constructor(IPoolManager manager) {
        POOL_MANAGER = manager;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    modifier onlyPoolManager() {
        _onlyPoolManager();
        _;
    }

    function _onlyPoolManager() internal view {
        if (msg.sender != address(POOL_MANAGER)) revert NotPoolManager();
    }

    function getHookPermissions() public pure virtual returns (Hooks.Permissions memory);

    function beforeInitialize(address, PoolKey calldata, uint160) external virtual onlyPoolManager returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24)
        external
        virtual
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        virtual
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external virtual onlyPoolManager returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        virtual
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external virtual onlyPoolManager returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external
        virtual
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        virtual
        onlyPoolManager
        returns (bytes4, int128)
    {
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }
}

/// @notice Uniswap v4 hook that updates a dynamic LP fee from a volatility signal on each swap.
contract VolatilityFeeHook is PoolManagerHook {
    using LPFeeLibrary for uint24;

    error FeeTooLarge(uint24 fee);
    error InvalidThresholds();
    error NotOwner();
    error ZeroAddress();

    event FeePolicyUpdated(FeePolicy policy);
    event SignalUpdated(address indexed oldSignal, address indexed newSignal);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event DynamicFeeApplied(uint24 fee, uint32 volatilityBps);

    struct FeePolicy {
        uint24 calmFee;
        uint24 normalFee;
        uint24 volatileFee;
        uint32 normalVolatilityBps;
        uint32 volatileVolatilityBps;
    }

    address public owner;
    IVolatilitySignal public volatilitySignal;
    FeePolicy public feePolicy;

    constructor(
        IPoolManager manager,
        IVolatilitySignal initialSignal,
        address initialOwner,
        FeePolicy memory initialPolicy
    ) PoolManagerHook(manager) {
        if (address(initialSignal) == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }

        owner = initialOwner;
        volatilitySignal = initialSignal;
        _validatePolicy(initialPolicy);
        feePolicy = initialPolicy;

        emit OwnershipTransferred(address(0), initialOwner);
        emit SignalUpdated(address(0), address(initialSignal));
        emit FeePolicyUpdated(initialPolicy);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
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

    function setVolatilitySignal(IVolatilitySignal newSignal) external onlyOwner {
        if (address(newSignal) == address(0)) revert ZeroAddress();

        emit SignalUpdated(address(volatilitySignal), address(newSignal));
        volatilitySignal = newSignal;
    }

    function setFeePolicy(FeePolicy calldata newPolicy) external onlyOwner {
        _validatePolicy(newPolicy);
        feePolicy = newPolicy;
        emit FeePolicyUpdated(newPolicy);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function afterInitialize(address, PoolKey calldata key, uint160, int24)
        external
        override
        onlyPoolManager
        returns (bytes4)
    {
        uint24 initialFee = feePolicy.normalFee;
        POOL_MANAGER.updateDynamicLPFee(key, initialFee);
        emit DynamicFeeApplied(initialFee, feePolicy.normalVolatilityBps);
        return IHooks.afterInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint32 observedVolatilityBps = volatilitySignal.volatilityBps(key, params, hookData);
        uint24 fee = feeForVolatilityBps(observedVolatilityBps);

        POOL_MANAGER.updateDynamicLPFee(key, fee);
        emit DynamicFeeApplied(fee, observedVolatilityBps);

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function feeForVolatilityBps(uint32 volatilityBps) public view returns (uint24) {
        FeePolicy memory policy = feePolicy;

        if (volatilityBps >= policy.volatileVolatilityBps) return policy.volatileFee;
        if (volatilityBps >= policy.normalVolatilityBps) return policy.normalFee;
        return policy.calmFee;
    }

    function _validatePolicy(FeePolicy memory policy) private pure {
        _validateFee(policy.calmFee);
        _validateFee(policy.normalFee);
        _validateFee(policy.volatileFee);

        if (
            policy.normalVolatilityBps == 0 || policy.volatileVolatilityBps <= policy.normalVolatilityBps
                || policy.calmFee > policy.normalFee || policy.normalFee > policy.volatileFee
        ) {
            revert InvalidThresholds();
        }
    }

    function _validateFee(uint24 fee) private pure {
        if (!fee.isValid()) revert FeeTooLarge(fee);
    }
}
