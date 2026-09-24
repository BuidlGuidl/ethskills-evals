// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilitySignal} from "./interfaces/IVolatilitySignal.sol";

/// @title VolatilityFeeHook
/// @notice Uniswap v4 hook for ONE dynamic-fee pool. On every swap it reads a volatility
///         signal, maps it to an LP fee in [minFee, maxFee], and returns that fee to the
///         PoolManager as a per-swap override. Signal + fee curve can be changed by the
///         owner without touching the pool or its liquidity.
/// @dev Fees are in hundredths of a bip (1_000_000 = 100%, 3000 = 0.30%).
///      Must be deployed at an address whose low bits encode exactly
///      BEFORE_INITIALIZE_FLAG | BEFORE_SWAP_FLAG (see script/Deploy.s.sol).
contract VolatilityFeeHook is IHooks {
    using PoolIdLibrary for PoolKey;

    /// @notice Hard ceiling for any configured fee (5%). Limits what a compromised owner can do.
    uint24 public constant MAX_FEE = 50_000;
    /// @notice Gas forwarded to the signal. Keeps swaps cheap and bounds a misbehaving signal.
    uint256 public constant SIGNAL_GAS_LIMIT = 50_000;

    struct FeeConfig {
        uint24 minFee; // fee at or below lowVolatility
        uint24 maxFee; // fee at or above highVolatility, and when the signal fails
        uint256 lowVolatility;
        uint256 highVolatility;
    }

    IPoolManager public immutable poolManager;

    address public owner;
    address public pendingOwner;
    IVolatilitySignal public signal;
    FeeConfig public feeConfig;
    /// @notice The single pool this hook serves; set when the owner initializes it.
    PoolId public poolId;
    bool public poolInitialized;

    event SignalUpdated(address signal);
    event FeeConfigUpdated(uint24 minFee, uint24 maxFee, uint256 lowVolatility, uint256 highVolatility);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error NotOwner();
    error InvalidInitializer();
    error PoolAlreadyInitialized();
    error PoolNotDynamicFee();
    error WrongPool();
    error InvalidFeeConfig();
    error InsufficientGasForSignal();
    error HookNotImplemented();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IPoolManager _poolManager, address _owner, IVolatilitySignal _signal, FeeConfig memory _config) {
        poolManager = _poolManager;
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
        _setSignal(_signal);
        _setFeeConfig(_config);

        // Reverts unless this contract was deployed to an address with exactly these flags.
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
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

    /// @notice Fee that the next swap would pay right now.
    function currentFee() public view returns (uint24) {
        (bool ok, uint256 vol) = _readSignal();
        return ok ? feeForVolatility(vol) : feeConfig.maxFee;
    }

    /// @notice Linear map: <= low -> minFee, >= high -> maxFee, in between interpolated.
    function feeForVolatility(uint256 vol) public view returns (uint24) {
        FeeConfig memory c = feeConfig;
        if (vol <= c.lowVolatility) return c.minFee;
        if (vol >= c.highVolatility) return c.maxFee;
        uint256 span = uint256(c.maxFee - c.minFee) * (vol - c.lowVolatility) / (c.highVolatility - c.lowVolatility);
        // span < maxFee - minFee <= MAX_FEE, so it fits in uint24
        // forge-lint: disable-next-line(unsafe-typecast)
        return c.minFee + uint24(span);
    }

    /// @dev Bounded staticcall so a broken/expensive/reverting signal can't brick swaps.
    ///      Any failure is reported as !ok and the caller charges maxFee (fail-expensive).
    function _readSignal() internal view returns (bool ok, uint256 vol) {
        // Stop a swapper from starving the call of gas (63/64 rule) to force the fallback fee.
        if (gasleft() < SIGNAL_GAS_LIMIT * 64 / 63 + 2_000) revert InsufficientGasForSignal();
        (bool success, bytes memory data) =
            address(signal).staticcall{gas: SIGNAL_GAS_LIMIT}(abi.encodeCall(IVolatilitySignal.volatility, ()));
        if (!success || data.length != 32) return (false, 0);
        return (true, abi.decode(data, (uint256)));
    }

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    /// @dev Only the owner may create the pool, only once, and it must be a dynamic-fee pool.
    ///      `sender` is whoever called PoolManager.initialize, so the owner must call it directly.
    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external
        onlyPoolManager
        returns (bytes4)
    {
        if (sender != owner) revert InvalidInitializer();
        if (poolInitialized) revert PoolAlreadyInitialized();
        if (!LPFeeLibrary.isDynamicFee(key.fee)) revert PoolNotDynamicFee();
        poolId = key.toId();
        poolInitialized = true;
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Returns the fee with OVERRIDE_FEE_FLAG set; PoolManager uses it for this swap only.
    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (PoolId.unwrap(key.toId()) != PoolId.unwrap(poolId)) revert WrongPool();
        uint24 fee = currentFee();
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setSignal(IVolatilitySignal _signal) external onlyOwner {
        _setSignal(_signal);
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

    function _setSignal(IVolatilitySignal _signal) internal {
        signal = _signal;
        emit SignalUpdated(address(_signal));
    }

    function _setFeeConfig(FeeConfig memory c) internal {
        if (c.minFee > c.maxFee || c.maxFee > MAX_FEE || c.lowVolatility >= c.highVolatility) {
            revert InvalidFeeConfig();
        }
        feeConfig = c;
        emit FeeConfigUpdated(c.minFee, c.maxFee, c.lowVolatility, c.highVolatility);
    }

    // ---------------------------------------------------------------------
    // Unused callbacks (flags not set, PoolManager never calls these)
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
