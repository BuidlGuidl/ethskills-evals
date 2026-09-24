// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Owned} from "./Owned.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary,
    HookFlags,
    LPFeeLibrary,
    PoolId,
    PoolIdLibrary,
    PoolKey,
    SwapParams
} from "./V4Types.sol";

contract VolatilityDynamicFeeHook is Owned {
    using PoolIdLibrary for PoolKey;

    struct HookPermissions {
        bool beforeInitialize;
        bool afterInitialize;
        bool beforeAddLiquidity;
        bool afterAddLiquidity;
        bool beforeRemoveLiquidity;
        bool afterRemoveLiquidity;
        bool beforeSwap;
        bool afterSwap;
        bool beforeDonate;
        bool afterDonate;
        bool beforeSwapReturnDelta;
        bool afterSwapReturnDelta;
        bool afterAddLiquidityReturnDelta;
        bool afterRemoveLiquidityReturnDelta;
    }

    struct FeeConfig {
        bool enabled;
        uint24 minFee;
        uint24 maxFee;
        uint24 baseFee;
        uint24 volatilityMultiplier;
    }

    error NotPoolManager();
    error InvalidHookAddress(address hook);
    error InvalidPoolHook(address configuredHook);
    error PoolMustUseDynamicFee(uint24 fee);
    error PoolNotEnabled(PoolId poolId);
    error InvalidFeeConfig();
    error FeeTooLarge(uint24 fee);

    address public immutable POOL_MANAGER;
    IVolatilityOracle public volatilityOracle;

    mapping(PoolId poolId => FeeConfig config) public feeConfigs;

    event VolatilityOracleSet(address indexed oracle);
    event PoolConfigured(
        PoolId indexed poolId, uint24 minFee, uint24 maxFee, uint24 baseFee, uint24 volatilityMultiplier
    );
    event PoolDisabled(PoolId indexed poolId);

    modifier onlyPoolManager() {
        _onlyPoolManager();
        _;
    }

    constructor(address initialOwner, address _poolManager, IVolatilityOracle initialOracle) Owned(initialOwner) {
        if (_poolManager == address(0) || address(initialOracle) == address(0)) revert ZeroAddress();
        if (!_hasBeforeSwapFlag(address(this))) revert InvalidHookAddress(address(this));

        POOL_MANAGER = _poolManager;
        volatilityOracle = initialOracle;
        emit VolatilityOracleSet(address(initialOracle));
    }

    function getHookPermissions() public pure returns (HookPermissions memory) {
        return HookPermissions({
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

    function setVolatilityOracle(IVolatilityOracle newOracle) external onlyOwner {
        if (address(newOracle) == address(0)) revert ZeroAddress();
        volatilityOracle = newOracle;
        emit VolatilityOracleSet(address(newOracle));
    }

    function configurePool(
        PoolKey calldata key,
        uint24 minFee,
        uint24 maxFee,
        uint24 baseFee,
        uint24 volatilityMultiplier
    ) external onlyOwner {
        _validatePoolKey(key);
        _validateFeeConfig(minFee, maxFee, baseFee, volatilityMultiplier);

        PoolId poolId = key.toIdCalldata();
        feeConfigs[poolId] = FeeConfig({
            enabled: true, minFee: minFee, maxFee: maxFee, baseFee: baseFee, volatilityMultiplier: volatilityMultiplier
        });

        emit PoolConfigured(poolId, minFee, maxFee, baseFee, volatilityMultiplier);
    }

    function disablePool(PoolKey calldata key) external onlyOwner {
        PoolId poolId = key.toIdCalldata();
        delete feeConfigs[poolId];
        emit PoolDisabled(poolId);
    }

    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = _feeForSwap(sender, key, params, hookData);
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function previewFee(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        returns (uint24 fee)
    {
        return _feeForSwap(sender, key, params, hookData);
    }

    function requiredHookFlags() external pure returns (uint160) {
        return HookFlags.BEFORE_SWAP_FLAG;
    }

    function _feeForSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        view
        returns (uint24)
    {
        PoolId poolId = key.toIdCalldata();
        FeeConfig memory config = feeConfigs[poolId];
        if (!config.enabled) revert PoolNotEnabled(poolId);

        uint256 volatilityE18 = volatilityOracle.currentVolatility(sender, key, params, hookData);
        uint256 unclampedFee = uint256(config.baseFee) + (volatilityE18 * uint256(config.volatilityMultiplier)) / 1e18;

        if (unclampedFee < config.minFee) return config.minFee;
        if (unclampedFee > config.maxFee) return config.maxFee;
        // Safe because maxFee was validated to be at most LPFeeLibrary.MAX_LP_FEE.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint24(unclampedFee);
    }

    function _onlyPoolManager() internal view {
        if (msg.sender != POOL_MANAGER) revert NotPoolManager();
    }

    function _validatePoolKey(PoolKey calldata key) internal view {
        if (address(key.hooks) != address(this)) revert InvalidPoolHook(address(key.hooks));
        if (!LPFeeLibrary.isDynamicFee(key.fee)) revert PoolMustUseDynamicFee(key.fee);
    }

    function _validateFeeConfig(uint24 minFee, uint24 maxFee, uint24 baseFee, uint24 volatilityMultiplier)
        internal
        pure
    {
        if (!LPFeeLibrary.isValid(minFee)) revert FeeTooLarge(minFee);
        if (!LPFeeLibrary.isValid(maxFee)) revert FeeTooLarge(maxFee);
        if (!LPFeeLibrary.isValid(baseFee)) revert FeeTooLarge(baseFee);
        if (!LPFeeLibrary.isValid(volatilityMultiplier)) revert FeeTooLarge(volatilityMultiplier);
        if (minFee > maxFee || baseFee < minFee || baseFee > maxFee) revert InvalidFeeConfig();
    }

    function _hasBeforeSwapFlag(address hook) internal pure returns (bool) {
        return (uint160(hook) & HookFlags.BEFORE_SWAP_FLAG) != 0;
    }
}
