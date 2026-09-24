// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Uniswap v4 hook that adjusts one pool's LP fee on every swap.
/// @dev The pool must be initialized with LPFeeLibrary.DYNAMIC_FEE_FLAG and this hook address.
contract VolatilityDynamicFeeHook is IHooks {
    using PoolIdLibrary for PoolKey;

    struct FeeConfig {
        uint24 calmFee;
        uint24 normalFee;
        uint24 volatileFee;
        uint256 elevatedVolatilityBps;
        uint256 highVolatilityBps;
    }

    error HookNotImplemented();
    error InvalidFeeConfig();
    error InvalidPool();
    error OnlyOwner();
    error OnlyPoolManager();
    error ZeroAddress();
    error ZeroOwner();

    event FeeConfigUpdated(FeeConfig config);
    event FeeSelected(PoolId indexed poolId, address indexed swapSender, uint256 volatilityBps, uint24 lpFee);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);

    IPoolManager public immutable poolManager;
    PoolId public immutable targetPoolId;
    Currency public immutable currency0;
    Currency public immutable currency1;
    int24 public immutable tickSpacing;

    address public owner;
    IVolatilityOracle public volatilityOracle;
    FeeConfig public feeConfig;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(
        IPoolManager _poolManager,
        Currency _currency0,
        Currency _currency1,
        int24 _tickSpacing,
        IVolatilityOracle _volatilityOracle,
        FeeConfig memory _feeConfig,
        address initialOwner
    ) {
        if (address(_poolManager) == address(0) || address(_volatilityOracle) == address(0)) {
            revert ZeroAddress();
        }
        if (initialOwner == address(0)) revert ZeroOwner();
        if (!(Currency.unwrap(_currency0) < Currency.unwrap(_currency1)) || _tickSpacing <= 0) revert InvalidPool();

        Hooks.validateHookPermissions(
            IHooks(address(this)),
            Hooks.Permissions({
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
            })
        );

        _validateFeeConfig(_feeConfig);

        poolManager = _poolManager;
        currency0 = _currency0;
        currency1 = _currency1;
        tickSpacing = _tickSpacing;
        volatilityOracle = _volatilityOracle;
        feeConfig = _feeConfig;
        owner = initialOwner;

        PoolKey memory key = PoolKey({
            currency0: _currency0,
            currency1: _currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: _tickSpacing,
            hooks: IHooks(address(this))
        });
        targetPoolId = key.toId();

        emit OwnerTransferred(address(0), initialOwner);
        emit OracleUpdated(address(0), address(_volatilityOracle));
        emit FeeConfigUpdated(_feeConfig);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroOwner();

        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setVolatilityOracle(IVolatilityOracle newOracle) external onlyOwner {
        if (address(newOracle) == address(0)) revert ZeroAddress();

        emit OracleUpdated(address(volatilityOracle), address(newOracle));
        volatilityOracle = newOracle;
    }

    function setFeeConfig(FeeConfig calldata newConfig) external onlyOwner {
        _validateFeeConfig(newConfig);

        feeConfig = newConfig;
        emit FeeConfigUpdated(newConfig);
    }

    function feeForVolatility(uint256 volatilityBps) public view returns (uint24) {
        FeeConfig memory config = feeConfig;

        if (volatilityBps >= config.highVolatilityBps) return config.volatileFee;
        if (volatilityBps >= config.elevatedVolatilityBps) return config.normalFee;
        return config.calmFee;
    }

    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (
            PoolId.unwrap(key.toId()) != PoolId.unwrap(targetPoolId) || key.fee != LPFeeLibrary.DYNAMIC_FEE_FLAG
                || address(key.hooks) != address(this)
        ) {
            revert InvalidPool();
        }

        uint256 volatilityBps = volatilityOracle.currentVolatilityBps(key, params, hookData);
        uint24 lpFee = feeForVolatility(volatilityBps);

        emit FeeSelected(targetPoolId, sender, volatilityBps, lpFee);

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpFee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
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
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
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
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, int128)
    {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function _validateFeeConfig(FeeConfig memory config) internal pure {
        if (
            config.calmFee > LPFeeLibrary.MAX_LP_FEE || config.normalFee > LPFeeLibrary.MAX_LP_FEE
                || config.volatileFee > LPFeeLibrary.MAX_LP_FEE || config.calmFee > config.normalFee
                || config.normalFee > config.volatileFee || config.elevatedVolatilityBps >= config.highVolatilityBps
        ) {
            revert InvalidFeeConfig();
        }
    }
}
