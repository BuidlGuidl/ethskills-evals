// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @title DynamicFeeHook
/// @notice Uniswap v4 hook that sets the LP fee of each swap from a volatility signal.
///         Calm -> minFee, volatile -> maxFee, linear in between.
/// @dev Pool must be created with `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` and `hooks = this`.
///      Hook address must have exactly BEFORE_INITIALIZE + BEFORE_SWAP flag bits set (mine a CREATE2 salt).
///      Fees are in hundredths of a bip: 3000 = 0.30%, 1_000_000 = 100%.
contract DynamicFeeHook is IHooks {
    using Hooks for IHooks;
    using LPFeeLibrary for uint24;

    struct FeeConfig {
        uint24 minFee; // fee at/below lowVol
        uint24 maxFee; // fee at/above highVol
        uint24 fallbackFee; // used if the oracle is unset, reverts, or returns garbage
        uint64 lowVol; // signal level treated as "calm"
        uint64 highVol; // signal level treated as "volatile"
    }

    /// @notice Hard ceiling the owner can never exceed (10%).
    uint24 public constant MAX_FEE_CAP = 100_000;
    /// @notice Gas forwarded to the oracle, so a broken/malicious oracle can't brick swaps.
    uint256 public constant ORACLE_GAS_LIMIT = 50_000;

    IPoolManager public immutable poolManager;

    address public owner;
    address public pendingOwner;
    IVolatilityOracle public oracle;
    FeeConfig public config;

    event OracleUpdated(address indexed oracle);
    event FeeConfigUpdated(FeeConfig config);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotPoolManager();
    error NotOwner();
    error HookNotImplemented();
    error MustUseDynamicFee();
    error InvalidFeeConfig();
    error InsufficientGasForOracle();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IPoolManager _poolManager, address _owner, IVolatilityOracle _oracle, FeeConfig memory _config) {
        poolManager = _poolManager;
        owner = _owner;
        oracle = _oracle;
        _setConfig(_config);
        // Reverts unless deployed at an address whose low bits match getHookPermissions().
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
    // Fee logic
    // ---------------------------------------------------------------------

    /// @notice Fee (hundredths of a bip) the next swap on `key` would pay.
    function currentFee(PoolKey calldata key) public view returns (uint24) {
        FeeConfig memory c = config;
        (bool ok, uint256 vol) = _readVolatility(key);
        if (!ok) return c.fallbackFee;
        return feeForVolatility(c, vol);
    }

    /// @notice Pure volatility -> fee mapping: flat below lowVol / above highVol, linear between.
    function feeForVolatility(FeeConfig memory c, uint256 vol) public pure returns (uint24) {
        if (vol <= c.lowVol) return c.minFee;
        if (vol >= c.highVol) return c.maxFee;
        uint256 span = uint256(c.maxFee - c.minFee) * (vol - c.lowVol) / (c.highVol - c.lowVol);
        // casting to uint24 is safe: span <= maxFee - minFee
        // forge-lint: disable-next-line(unsafe-typecast)
        return c.minFee + uint24(span);
    }

    function _readVolatility(PoolKey calldata key) internal view returns (bool ok, uint256 vol) {
        address o = address(oracle);
        if (o == address(0)) return (false, 0);
        // Make sure the oracle really gets ORACLE_GAS_LIMIT (63/64 rule); otherwise a swapper could
        // starve the call on purpose to get fallbackFee instead of the (higher) volatile fee.
        if (gasleft() < ORACLE_GAS_LIMIT * 64 / 63 + 2000) revert InsufficientGasForOracle();
        bytes memory ret;
        (ok, ret) = o.staticcall{gas: ORACLE_GAS_LIMIT}(abi.encodeCall(IVolatilityOracle.volatility, (key)));
        if (!ok || ret.length < 32) return (false, 0);
        vol = abi.decode(ret, (uint256));
    }

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    /// @dev Refuse to attach to a static-fee pool: the returned fee would be silently ignored.
    function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
        if (!key.fee.isDynamicFee()) revert MustUseDynamicFee();
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Called by PoolManager before every swap. Returning `fee | OVERRIDE_FEE_FLAG` makes the
    ///      pool charge `fee` for this swap only; without the flag the returned value is ignored.
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
    // Admin (should be a multisig / timelock)
    // ---------------------------------------------------------------------

    function setOracle(IVolatilityOracle _oracle) external onlyOwner {
        oracle = _oracle;
        emit OracleUpdated(address(_oracle));
    }

    function setFeeConfig(FeeConfig calldata _config) external onlyOwner {
        _setConfig(_config);
    }

    function transferOwnership(address to) external onlyOwner {
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function _setConfig(FeeConfig memory c) internal {
        if (
            c.minFee > c.maxFee || c.maxFee > MAX_FEE_CAP || c.fallbackFee > MAX_FEE_CAP || c.fallbackFee < c.minFee
                || c.lowVol >= c.highVol
        ) revert InvalidFeeConfig();
        config = c;
        emit FeeConfigUpdated(c);
    }

    // ---------------------------------------------------------------------
    // Unused callbacks — flag bits are unset, so PoolManager never calls these.
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
