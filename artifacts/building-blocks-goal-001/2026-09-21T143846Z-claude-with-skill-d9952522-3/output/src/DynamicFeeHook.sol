// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @title DynamicFeeHook
/// @notice Uniswap v4 hook that sets the LP fee of one dynamic-fee pool on every swap,
///         interpolating between minFee (calm) and maxFee (volatile) from an oracle signal.
/// @dev Uses beforeSwap's fee-override return (no storage write to PoolManager per swap).
///      Oracle and fee curve are owner-configurable, so the signal can be replaced without
///      touching the pool or its liquidity.
contract DynamicFeeHook is IHooks {
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;

    /// @notice Hard ceiling the owner can never exceed: 10%.
    uint24 public constant MAX_FEE_CAP = 100_000;
    /// @notice Gas forwarded to the oracle; bounds cost and griefing of every swap.
    uint256 public constant ORACLE_GAS_LIMIT = 50_000;

    struct FeeConfig {
        uint24 minFee; // fee at or below volLow (hundredths of a bip, 3000 = 0.30%)
        uint24 maxFee; // fee at or above volHigh
        uint24 fallbackFee; // used if the oracle is unset, reverts, or returns garbage
        uint256 volLow; // signal threshold for "calm"
        uint256 volHigh; // signal threshold for "volatile"
    }

    IPoolManager public immutable poolManager;

    // The only pool this hook will serve. Fixed at deploy so no one can squat a
    // different pool (other tickSpacing, other pair) on our hook.
    Currency public immutable currency0;
    Currency public immutable currency1;
    int24 public immutable tickSpacing;

    address public owner;
    address public pendingOwner;
    IVolatilityOracle public oracle;
    FeeConfig public feeConfig;

    event OracleUpdated(address indexed oracle);
    event FeeConfigUpdated(FeeConfig config);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error NotOwner();
    error HookNotImplemented();
    error PoolNotAllowed();
    error InvalidFeeConfig();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        IPoolManager _poolManager,
        Currency _currency0,
        Currency _currency1,
        int24 _tickSpacing,
        address _owner,
        IVolatilityOracle _oracle,
        FeeConfig memory _config
    ) {
        poolManager = _poolManager;
        currency0 = _currency0;
        currency1 = _currency1;
        tickSpacing = _tickSpacing;
        owner = _owner;
        oracle = _oracle;
        _setFeeConfig(_config);

        // Reverts unless the deployed address encodes exactly these permission bits.
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());

        emit OwnershipTransferred(address(0), _owner);
        emit OracleUpdated(address(_oracle));
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
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

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    /// @dev Only the one configured pool, and only as a dynamic-fee pool. A static-fee
    ///      pool would silently ignore our override, so reject it outright.
    function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
        if (
            !key.fee.isDynamicFee() || key.tickSpacing != tickSpacing
                || Currency.unwrap(key.currency0) != Currency.unwrap(currency0)
                || Currency.unwrap(key.currency1) != Currency.unwrap(currency1)
        ) revert PoolNotAllowed();
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Returned fee has OVERRIDE_FEE_FLAG set, so PoolManager applies it to this
    ///      swap only. Nothing is written to pool state.
    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = currentFee(key.toId());
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ---------------------------------------------------------------------
    // Fee logic
    // ---------------------------------------------------------------------

    /// @notice Fee that would be charged on a swap right now.
    function currentFee(PoolId poolId) public view returns (uint24) {
        FeeConfig memory c = feeConfig;
        (bool ok, uint256 vol) = _readVolatility(poolId);
        if (!ok) return c.fallbackFee;
        return feeForVolatility(vol, c);
    }

    /// @notice Linear ramp: minFee below volLow, maxFee above volHigh, interpolated between.
    function feeForVolatility(uint256 vol, FeeConfig memory c) public pure returns (uint24) {
        if (vol <= c.volLow) return c.minFee;
        if (vol >= c.volHigh) return c.maxFee;
        return uint24(c.minFee + (uint256(c.maxFee - c.minFee) * (vol - c.volLow)) / (c.volHigh - c.volLow));
    }

    /// @dev Gas-capped staticcall; any revert, OOG, or malformed return falls back instead
    ///      of bricking swaps. A broken oracle must never halt trading.
    function _readVolatility(PoolId poolId) internal view returns (bool ok, uint256 vol) {
        address o = address(oracle);
        if (o == address(0)) return (false, 0);
        bytes memory ret;
        (ok, ret) = o.staticcall{gas: ORACLE_GAS_LIMIT}(abi.encodeCall(IVolatilityOracle.getVolatility, (poolId)));
        if (!ok || ret.length != 32) return (false, 0);
        vol = abi.decode(ret, (uint256));
    }

    // ---------------------------------------------------------------------
    // Admin (owner should be a multisig behind a timelock)
    // ---------------------------------------------------------------------

    function setOracle(IVolatilityOracle _oracle) external onlyOwner {
        oracle = _oracle;
        emit OracleUpdated(address(_oracle));
    }

    function setFeeConfig(FeeConfig calldata _config) external onlyOwner {
        _setFeeConfig(_config);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function _setFeeConfig(FeeConfig memory c) internal {
        if (
            c.minFee > c.maxFee || c.maxFee > MAX_FEE_CAP || c.fallbackFee < c.minFee || c.fallbackFee > c.maxFee
                || c.volLow >= c.volHigh
        ) revert InvalidFeeConfig();
        feeConfig = c;
        emit FeeConfigUpdated(c);
    }

    // ---------------------------------------------------------------------
    // Unused callbacks (permission bits are off, PoolManager never calls these)
    // ---------------------------------------------------------------------

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
}
