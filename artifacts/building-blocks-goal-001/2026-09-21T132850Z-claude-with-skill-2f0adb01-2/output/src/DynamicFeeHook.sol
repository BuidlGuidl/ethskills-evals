// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @title DynamicFeeHook
/// @notice Uniswap v4 hook that sets the LP fee of each swap from a volatility signal.
///         Pool must be created with key.fee = LPFeeLibrary.DYNAMIC_FEE_FLAG and key.hooks = this.
///         Fee is returned from beforeSwap with OVERRIDE_FEE_FLAG, so it applies to that swap only
///         and costs no extra storage writes.
/// @dev Hook address must have exactly BEFORE_INITIALIZE | BEFORE_SWAP flag bits set (CREATE2-mined).
contract DynamicFeeHook is IHooks {
    using PoolIdLibrary for PoolKey;

    /// @dev fees in hundredths of a bip: 3000 = 0.30%
    struct FeeConfig {
        uint24 minFee; // fee at/below volLow
        uint24 maxFee; // fee at/above volHigh
        uint24 fallbackFee; // fee when oracle unset, reverts, returns junk, or is stale
        uint32 maxStaleness; // seconds; 0 disables staleness check
        uint64 volLow;
        uint64 volHigh;
    }

    /// @notice hard ceiling so a bad config can't set an abusive fee (10%)
    uint24 public constant MAX_FEE_CAP = 100_000;
    /// @notice gas forwarded to the oracle; bounds cost and griefing of every swap
    uint256 public constant ORACLE_GAS_LIMIT = 50_000;

    IPoolManager public immutable poolManager;

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
    error NotPendingOwner();
    error HookNotImplemented();
    error MustUseDynamicFee();
    error UnauthorizedPoolInit();
    error InvalidFeeConfig();
    error OracleHasNoCode();
    error InsufficientGas();

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
        // reverts if deployed at an address whose flag bits don't match permissions
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());

        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
        _setOracle(_oracle);
        _setFeeConfig(_config);
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

    // ─── Fee logic ───────────────────────────────────────────────────────────

    /// @notice fee the next swap in `poolId` would pay (hundredths of a bip)
    function currentFee(PoolId poolId) public view returns (uint24) {
        FeeConfig memory c = feeConfig;
        (bool ok, uint256 vol) = _readVolatility(poolId, c.maxStaleness);
        if (!ok) return c.fallbackFee;
        return feeForVolatility(vol, c);
    }

    /// @notice linear interpolation between minFee and maxFee across [volLow, volHigh]
    function feeForVolatility(uint256 vol, FeeConfig memory c) public pure returns (uint24) {
        if (vol <= c.volLow) return c.minFee;
        if (vol >= c.volHigh) return c.maxFee;
        uint256 span = uint256(c.maxFee) - c.minFee;
        return uint24(c.minFee + span * (vol - c.volLow) / (uint256(c.volHigh) - c.volLow));
    }

    /// @dev Never reverts on oracle failure: a broken oracle must not brick swaps. Low-level staticcall so
    ///      a missing contract or malformed return data also falls back instead of reverting.
    function _readVolatility(PoolId poolId, uint32 maxStaleness) internal view returns (bool, uint256) {
        address o = address(oracle);
        if (o == address(0)) return (false, 0);
        // Ensure oracle gets its full budget (EIP-150 forwards only 63/64). Otherwise a swapper
        // could pass just enough gas to make the oracle OOG and force fallbackFee.
        if (gasleft() < ORACLE_GAS_LIMIT * 64 / 63 + 2_000) revert InsufficientGas();

        (bool success, bytes memory ret) =
            o.staticcall{gas: ORACLE_GAS_LIMIT}(abi.encodeCall(IVolatilityOracle.getVolatility, (poolId)));
        if (!success || ret.length < 64) return (false, 0);

        (uint256 vol, uint256 updatedAt) = abi.decode(ret, (uint256, uint256));
        if (maxStaleness != 0 && (updatedAt > block.timestamp || block.timestamp - updatedAt > maxStaleness)) {
            return (false, 0);
        }
        return (true, vol);
    }

    // ─── Hook callbacks ──────────────────────────────────────────────────────

    /// @dev Only owner may create pools on this hook: blocks strangers from attaching pools
    ///      and from front-running our pool's init with a bad starting price.
    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external
        view
        onlyPoolManager
        returns (bytes4)
    {
        if (sender != owner) revert UnauthorizedPoolInit();
        if (!LPFeeLibrary.isDynamicFee(key.fee)) revert MustUseDynamicFee();
        return IHooks.beforeInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = currentFee(key.toId());
        // OVERRIDE_FEE_FLAG (0x400000) tells PoolManager to use this fee for this swap only
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice swap the volatility source live; pool and liquidity untouched
    function setOracle(IVolatilityOracle _oracle) external onlyOwner {
        _setOracle(_oracle);
    }

    function setFeeConfig(FeeConfig calldata _config) external onlyOwner {
        _setFeeConfig(_config);
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

    function _setOracle(IVolatilityOracle _oracle) internal {
        // address(0) allowed: hook then charges fallbackFee
        if (address(_oracle) != address(0) && address(_oracle).code.length == 0) revert OracleHasNoCode();
        oracle = _oracle;
        emit OracleUpdated(address(_oracle));
    }

    function _setFeeConfig(FeeConfig memory c) internal {
        if (
            c.minFee > c.maxFee || c.maxFee > MAX_FEE_CAP || c.fallbackFee > MAX_FEE_CAP
                || c.volLow >= c.volHigh
        ) revert InvalidFeeConfig();
        feeConfig = c;
        emit FeeConfigUpdated(c);
    }

    // ─── Unused callbacks (permission bits off; PoolManager never calls these) ─

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
