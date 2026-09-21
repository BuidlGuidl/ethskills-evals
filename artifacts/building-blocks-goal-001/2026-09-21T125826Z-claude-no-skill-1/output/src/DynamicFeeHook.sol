// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @title DynamicFeeHook
/// @notice Uniswap v4 hook that sets the LP fee of a dynamic-fee pool on every swap,
/// based on a pluggable volatility signal. Calm -> `minFee`, volatile -> `maxFee`,
/// linear in between. Oracle and fee curve are owner-updatable, so the pool (whose
/// PoolKey permanently embeds this hook's address) never needs to be migrated.
/// @dev Must be deployed (via CREATE2) to an address whose low bits encode exactly
/// BEFORE_INITIALIZE + BEFORE_SWAP. The constructor enforces this.
contract DynamicFeeHook is IHooks {
    using LPFeeLibrary for uint24;

    /// @notice Hard ceiling the owner can never exceed: 5% (fee units are pips, 1e6 = 100%).
    uint24 public constant MAX_FEE_CAP = 50_000;
    /// @notice Gas forwarded to the oracle. Bounds the cost a bad oracle can add to swaps.
    uint256 public constant ORACLE_GAS_LIMIT = 50_000;

    IPoolManager public immutable poolManager;
    /// @notice The launched token. Only pools containing it may use this hook.
    address public immutable token;

    /// @param minFee Fee at or below `lowVol` (pips).
    /// @param maxFee Fee at or above `highVol` (pips).
    /// @param fallbackFee Fee used if the oracle is unset, reverts, or returns garbage.
    /// @param lowVol Volatility at which the fee starts rising above `minFee`.
    /// @param highVol Volatility at which the fee reaches `maxFee`.
    struct FeeConfig {
        uint24 minFee;
        uint24 maxFee;
        uint24 fallbackFee;
        uint64 lowVol;
        uint64 highVol;
    }

    address public owner;
    address public pendingOwner;
    IVolatilityOracle public oracle;
    FeeConfig public feeConfig;

    event OracleUpdated(address oracle);
    event FeeConfigUpdated(FeeConfig config);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error NotOwner();
    error HookNotImplemented();
    error PoolMustUseDynamicFee();
    error PoolMustContainToken();
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
        address _token,
        address _owner,
        IVolatilityOracle _oracle,
        FeeConfig memory _config
    ) {
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
        poolManager = _poolManager;
        token = _token;
        owner = _owner;
        oracle = _oracle;
        _setFeeConfig(_config);
        emit OwnershipTransferred(address(0), _owner);
        emit OracleUpdated(address(_oracle));
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory p) {
        p.beforeInitialize = true;
        p.beforeSwap = true;
    }

    // ---------------------------------------------------------------------
    // Fee logic
    // ---------------------------------------------------------------------

    /// @notice The LP fee (pips) a swap on `key` would pay right now.
    function currentFee(PoolKey calldata key) public view returns (uint24) {
        FeeConfig memory c = feeConfig;
        (bool ok, uint256 vol) = _readVolatility(key);
        if (!ok) return c.fallbackFee;
        return feeForVolatility(c, vol);
    }

    /// @notice Pure fee curve: flat `minFee` below `lowVol`, flat `maxFee` above `highVol`, linear between.
    function feeForVolatility(FeeConfig memory c, uint256 vol) public pure returns (uint24) {
        if (vol <= c.lowVol) return c.minFee;
        if (vol >= c.highVol) return c.maxFee;
        uint256 span = uint256(c.maxFee - c.minFee) * (vol - c.lowVol) / (c.highVol - c.lowVol);
        // safe: span <= maxFee - minFee, which fits in uint24
        return c.minFee + uint24(span);
    }

    /// @dev Low-level, gas-capped staticcall so a missing/broken oracle (no code, revert,
    /// short return data) degrades to `fallbackFee` instead of bricking swaps.
    function _readVolatility(PoolKey calldata key) internal view returns (bool ok, uint256 vol) {
        address o = address(oracle);
        if (o == address(0)) return (false, 0);
        bytes memory ret;
        (ok, ret) = o.staticcall{gas: ORACLE_GAS_LIMIT}(abi.encodeCall(IVolatilityOracle.volatility, (key)));
        if (!ok || ret.length < 32) return (false, 0);
        vol = abi.decode(ret, (uint256));
    }

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    /// @dev Refuse static-fee pools (the override would be silently ignored) and pools
    /// unrelated to our token.
    function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();
        if (Currency.unwrap(key.currency0) != token && Currency.unwrap(key.currency1) != token) {
            revert PoolMustContainToken();
        }
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Returns the fee with OVERRIDE_FEE_FLAG set: PoolManager uses it for this swap only.
    /// No storage write, no `updateDynamicLPFee` call needed.
    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = currentFee(key);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ---------------------------------------------------------------------
    // Admin (owner should be a multisig behind a timelock)
    // ---------------------------------------------------------------------

    /// @notice Point the hook at a new volatility source. `address(0)` => always `fallbackFee`.
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
                || c.lowVol >= c.highVol
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

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }
}
