// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {IVolatilitySignal} from "./interfaces/IVolatilitySignal.sol";

/// @title DynamicFeeHook
/// @notice Uniswap v4 hook that sets the LP fee of one dynamic-fee pool on every swap,
///         scaling it between minFee (calm) and maxFee (volatile) from an external volatility signal.
/// @dev Hook address must have exactly BEFORE_INITIALIZE and BEFORE_SWAP flag bits set (mined via CREATE2).
///      The hook itself is immutable; signal source and fee curve are owner-tunable so nothing needs redeploying.
contract DynamicFeeHook is IHooks {
    using PoolIdLibrary for PoolKey;

    /// @notice hard cap on any fee the owner can configure: 10% (fee units are hundredths of a bip, 1e6 = 100%)
    uint24 public constant MAX_FEE_CAP = 100_000;
    /// @notice gas forwarded to the signal; a broken/griefing signal can't block swaps
    uint256 public constant SIGNAL_GAS_LIMIT = 50_000;

    IPoolManager public immutable poolManager;

    struct FeeParams {
        uint24 minFee; // fee at or below lowVol
        uint24 maxFee; // fee at or above highVol
        uint24 fallbackFee; // fee used if the signal fails
        uint256 lowVol; // signal value treated as "calm"
        uint256 highVol; // signal value treated as "volatile"
    }

    address public owner;
    address public pendingOwner;
    IVolatilitySignal public signal;
    FeeParams public feeParams;

    /// @notice the single pool this hook serves; set once in beforeInitialize
    PoolId public poolId;
    bool public poolInitialized;

    event FeeApplied(PoolId indexed poolId, uint256 vol, uint24 fee, bool signalOk);
    event SignalUpdated(address signal);
    event FeeParamsUpdated(FeeParams params);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error NotOwner();
    error NotPendingOwner();
    error NotInitializer();
    error PoolAlreadyInitialized();
    error NotDynamicFeePool();
    error InvalidFeeParams();
    error HookNotImplemented();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IPoolManager _poolManager, address _owner, IVolatilitySignal _signal, FeeParams memory _params) {
        poolManager = _poolManager;
        owner = _owner;
        signal = _signal;
        _setFeeParams(_params);
        emit OwnershipTransferred(address(0), _owner);
        emit SignalUpdated(address(_signal));
        // reverts if the deployed address doesn't encode exactly these permissions
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
    // Hook callbacks
    // ---------------------------------------------------------------------

    /// @dev Binds the hook to one pool, only the owner may create it (blocks init-price front-running
    ///      and strangers attaching other pools to our signal). Owner must call PoolManager.initialize directly,
    ///      since `sender` is the immediate caller of the PoolManager.
    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external
        onlyPoolManager
        returns (bytes4)
    {
        if (sender != owner) revert NotInitializer();
        if (poolInitialized) revert PoolAlreadyInitialized();
        if (!LPFeeLibrary.isDynamicFee(key.fee)) revert NotDynamicFeePool();
        poolInitialized = true;
        poolId = key.toId();
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Returns the fee with OVERRIDE_FEE_FLAG so the PoolManager uses it for this swap only.
    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        (uint256 vol, uint24 fee, bool ok) = currentFee();
        emit FeeApplied(key.toId(), vol, fee, ok);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ---------------------------------------------------------------------
    // Fee logic
    // ---------------------------------------------------------------------

    /// @notice fee the next swap would pay (without the override flag)
    function currentFee() public view returns (uint256 vol, uint24 fee, bool ok) {
        FeeParams memory p = feeParams;
        (ok, vol) = _readSignal();
        fee = ok ? feeForVolatility(vol, p) : p.fallbackFee;
    }

    /// @notice linear interpolation minFee -> maxFee across [lowVol, highVol], clamped at both ends
    function feeForVolatility(uint256 vol, FeeParams memory p) public pure returns (uint24) {
        if (vol <= p.lowVol) return p.minFee;
        if (vol >= p.highVol) return p.maxFee;
        // result <= maxFee, fits uint24
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint24(p.minFee + (uint256(p.maxFee - p.minFee) * (vol - p.lowVol)) / (p.highVol - p.lowVol));
    }

    /// @dev low-level staticcall with gas cap: revert, OOG, or short return data all fall back instead of bricking swaps
    function _readSignal() internal view returns (bool ok, uint256 vol) {
        address s = address(signal);
        if (s.code.length == 0) return (false, 0);
        bytes memory data;
        (ok, data) = s.staticcall{gas: SIGNAL_GAS_LIMIT}(abi.encodeCall(IVolatilitySignal.volatility, (poolId)));
        if (!ok || data.length < 32) return (false, 0);
        vol = abi.decode(data, (uint256));
    }

    // ---------------------------------------------------------------------
    // Admin (owner should be a timelocked multisig)
    // ---------------------------------------------------------------------

    function setSignal(IVolatilitySignal _signal) external onlyOwner {
        signal = _signal;
        emit SignalUpdated(address(_signal));
    }

    function setFeeParams(FeeParams calldata _params) external onlyOwner {
        _setFeeParams(_params);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function _setFeeParams(FeeParams memory p) internal {
        if (
            p.minFee > p.maxFee || p.maxFee > MAX_FEE_CAP || p.lowVol >= p.highVol || p.fallbackFee < p.minFee
                || p.fallbackFee > p.maxFee
        ) revert InvalidFeeParams();
        feeParams = p;
        emit FeeParamsUpdated(p);
    }

    // ---------------------------------------------------------------------
    // Unused callbacks (flags not set, PoolManager never calls them)
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
