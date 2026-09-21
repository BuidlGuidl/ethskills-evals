// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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
/// @notice Uniswap v4 hook that sets the LP fee of a single dynamic-fee pool on every swap,
///         based on a pluggable volatility signal. Calm -> minFee, volatile -> maxFee, linear in between.
/// @dev Uses only BEFORE_INITIALIZE and BEFORE_SWAP. Must be deployed at an address whose low 14 bits
///      equal exactly those flags (see script/DeployDynamicFeeHook.s.sol).
contract DynamicFeeHook is IHooks {
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;

    /// @notice Hard ceiling on any fee the owner can configure (10%). Fee units: hundredths of a bip (1e6 = 100%).
    uint24 public constant FEE_CAP = 100_000;
    /// @notice Gas forwarded to the oracle. Bounds swap gas and stops a broken oracle from eating the tx.
    uint256 public constant ORACLE_GAS_LIMIT = 50_000;

    struct FeeConfig {
        uint24 minFee; // fee when vol <= volLow
        uint24 maxFee; // fee when vol >= volHigh
        uint24 fallbackFee; // fee when oracle is unset or fails
        uint64 volLow; // oracle units (bps)
        uint64 volHigh; // oracle units (bps)
    }

    IPoolManager public immutable poolManager;
    /// @notice The only pool this hook will serve.
    PoolId public immutable poolId;
    /// @notice Only this address may initialize the pool (blocks front-run init at a bad price).
    address public immutable initializer;

    address public owner;
    address public pendingOwner;
    IVolatilityOracle public oracle;
    FeeConfig public config;

    event OracleUpdated(address indexed oracle);
    event FeeConfigUpdated(FeeConfig config);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error NotOwner();
    error HookNotImplemented();
    error WrongPool();
    error NotInitializer();
    error PoolMustUseDynamicFee();
    error InvalidConfig();
    error OracleNotContract();

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
        Currency currency0,
        Currency currency1,
        int24 tickSpacing,
        address _initializer,
        address _owner,
        IVolatilityOracle _oracle,
        FeeConfig memory _config
    ) {
        // Reverts unless this contract was deployed at an address encoding exactly our permissions.
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());

        poolManager = _poolManager;
        initializer = _initializer;
        poolId = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(this))
        }).toId();

        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
        _setOracle(_oracle);
        _setConfig(_config);
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

    /// @notice Fee the next swap will pay (without override flag). Handy for UIs / monitoring.
    function currentFee() public view returns (uint24) {
        FeeConfig memory c = config;
        IVolatilityOracle o = oracle;
        if (address(o) == address(0)) return c.fallbackFee;

        // Low-level staticcall: a reverting, out-of-gas or malformed oracle falls back instead of bricking swaps.
        (bool ok, bytes memory ret) =
            address(o).staticcall{gas: ORACLE_GAS_LIMIT}(abi.encodeCall(IVolatilityOracle.volatility, (poolId)));
        if (!ok || ret.length != 32) return c.fallbackFee;
        return feeForVolatility(abi.decode(ret, (uint256)), c);
    }

    /// @notice Piecewise-linear map: vol <= volLow -> minFee, vol >= volHigh -> maxFee.
    function feeForVolatility(uint256 vol, FeeConfig memory c) public pure returns (uint24) {
        if (vol <= c.volLow) return c.minFee;
        if (vol >= c.volHigh) return c.maxFee;
        uint256 span = uint256(c.maxFee) - c.minFee;
        return uint24(c.minFee + (span * (vol - c.volLow)) / (c.volHigh - c.volLow));
    }

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external
        view
        onlyPoolManager
        returns (bytes4)
    {
        if (sender != initializer) revert NotInitializer();
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();
        if (PoolId.unwrap(key.toId()) != PoolId.unwrap(poolId)) revert WrongPool();
        return IHooks.beforeInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // Only one pool can be initialized with this hook, so no key check needed here.
        // OVERRIDE_FEE_FLAG tells the PoolManager to use this fee for this swap only.
        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            currentFee() | LPFeeLibrary.OVERRIDE_FEE_FLAG
        );
    }

    // ---------------------------------------------------------------------
    // Admin (owner should be a multisig / timelock)
    // ---------------------------------------------------------------------

    function setOracle(IVolatilityOracle newOracle) external onlyOwner {
        _setOracle(newOracle);
    }

    function setFeeConfig(FeeConfig calldata newConfig) external onlyOwner {
        _setConfig(newConfig);
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

    /// @notice Freezes oracle + config forever.
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
        pendingOwner = address(0);
    }

    function _setOracle(IVolatilityOracle newOracle) internal {
        // Guard against typos: an EOA would silently always yield fallbackFee.
        if (address(newOracle) != address(0) && address(newOracle).code.length == 0) revert OracleNotContract();
        oracle = newOracle;
        emit OracleUpdated(address(newOracle));
    }

    function _setConfig(FeeConfig memory c) internal {
        if (
            c.minFee > c.maxFee || c.maxFee > FEE_CAP || c.fallbackFee > FEE_CAP || c.volLow >= c.volHigh
        ) revert InvalidConfig();
        config = c;
        emit FeeConfigUpdated(c);
    }

    // ---------------------------------------------------------------------
    // Unused callbacks — never called because their permission bits are 0.
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
