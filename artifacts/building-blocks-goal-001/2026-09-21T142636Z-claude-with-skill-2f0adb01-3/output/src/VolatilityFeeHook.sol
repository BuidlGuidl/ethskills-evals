// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @title VolatilityFeeHook
/// @notice Uniswap v4 hook that sets the LP fee of a dynamic-fee pool on every swap from a volatility signal.
/// @dev Only `beforeInitialize` and `beforeSwap` are enabled. The hook address must have exactly those two
///      permission bits set (mine a CREATE2 salt — see script/DeployVolatilityFeeHook.s.sol).
///      Fee units are hundredths of a bip: 1_000_000 = 100%, 3000 = 0.30%, 500 = 0.05%.
contract VolatilityFeeHook is IHooks {
    using LPFeeLibrary for uint24;

    /// @notice Hard ceiling on any fee the owner can configure (10%). Protects traders from a bad config.
    uint24 public constant MAX_FEE_CAP = 100_000;
    /// @notice Gas forwarded to the oracle. Bounds swap cost and stops a broken oracle from eating all gas.
    uint256 public constant ORACLE_GAS_LIMIT = 50_000;

    struct FeeConfig {
        uint24 minFee; // fee at or below `volLow`
        uint24 maxFee; // fee at or above `volHigh`
        uint24 fallbackFee; // fee when the oracle is unset/fails; recommended = maxFee
        uint32 volLow; // signal level where fee starts rising above minFee
        uint32 volHigh; // signal level where fee reaches maxFee
    }

    IPoolManager public immutable poolManager;

    address public owner;
    address public pendingOwner;
    IVolatilityOracle public oracle;
    FeeConfig public feeConfig;

    event OracleSet(address indexed oracle);
    event FeeConfigSet(uint24 minFee, uint24 maxFee, uint24 fallbackFee, uint32 volLow, uint32 volHigh);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error NotOwner();
    error HookNotImplemented();
    error NotDynamicFeePool();
    error UnauthorizedInitializer();
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

    /// @param _owner explicit owner — NOT msg.sender, which is the CREATE2 deployer proxy when deployed via script
    constructor(IPoolManager _poolManager, address _owner, IVolatilityOracle _oracle, FeeConfig memory _config) {
        poolManager = _poolManager;
        // Reverts unless the deployed address encodes exactly our permission bits.
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

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    /// @dev Only dynamic-fee pools, and only the owner may create pools that use this hook.
    ///      `sender` is whoever called PoolManager.initialize (the EOA when initializing directly).
    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external
        view
        onlyPoolManager
        returns (bytes4)
    {
        if (!key.fee.isDynamicFee()) revert NotDynamicFeePool();
        if (sender != owner) revert UnauthorizedInitializer();
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Returns the fee with OVERRIDE_FEE_FLAG so PoolManager uses it for this swap only.
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
    // Fee logic
    // ---------------------------------------------------------------------

    /// @notice Fee the next swap on `key` would pay (without override flag).
    function currentFee(PoolKey calldata key) public view returns (uint24) {
        FeeConfig memory c = feeConfig;
        (bool ok, uint256 vol) = _readVolatility(key);
        if (!ok) return c.fallbackFee;
        return feeForVolatility(c, vol);
    }

    /// @notice Linear ramp: minFee below volLow, maxFee above volHigh, interpolated in between.
    function feeForVolatility(FeeConfig memory c, uint256 vol) public pure returns (uint24) {
        if (vol <= c.volLow) return c.minFee;
        if (vol >= c.volHigh) return c.maxFee;
        return uint24(c.minFee + (uint256(c.maxFee - c.minFee) * (vol - c.volLow)) / (c.volHigh - c.volLow));
    }

    /// @dev STATICCALL with a gas cap: the oracle can't reenter, change state, or brick swaps by reverting.
    ///      Requires enough gas that the oracle gets its full budget, so a swapper can't starve the call
    ///      on purpose to force the fallback fee (EIP-150 63/64 rule).
    function _readVolatility(PoolKey calldata key) internal view returns (bool ok, uint256 vol) {
        address o = address(oracle);
        if (o == address(0)) return (false, 0);
        if (gasleft() < (ORACLE_GAS_LIMIT * 64) / 63 + 2_000) revert InsufficientGasForOracle();

        bytes memory ret;
        (ok, ret) = o.staticcall{gas: ORACLE_GAS_LIMIT}(abi.encodeCall(IVolatilityOracle.volatility, (key)));
        if (!ok || ret.length < 32) return (false, 0);
        vol = abi.decode(ret, (uint256));
    }

    // ---------------------------------------------------------------------
    // Admin — the hook address is baked into the PoolKey, so it can never change;
    // these setters are how the pool is tuned/rewired after launch.
    // ---------------------------------------------------------------------

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
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function _setOracle(IVolatilityOracle _oracle) internal {
        oracle = _oracle;
        emit OracleSet(address(_oracle));
    }

    function _setFeeConfig(FeeConfig memory c) internal {
        if (c.minFee > c.maxFee || c.maxFee > MAX_FEE_CAP || c.fallbackFee > MAX_FEE_CAP || c.volLow >= c.volHigh) {
            revert InvalidFeeConfig();
        }
        feeConfig = c;
        emit FeeConfigSet(c.minFee, c.maxFee, c.fallbackFee, c.volLow, c.volHigh);
    }

    // ---------------------------------------------------------------------
    // Disabled callbacks (permission bits are off; PoolManager never calls these)
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
