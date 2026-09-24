// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @title DynamicFeeHook
/// @notice Uniswap v4 hook that sets the LP fee of a dynamic-fee pool on every swap from a volatility signal.
///         fee = minFee + (maxFee - minFee) * score / 1e18
/// @dev Permissions encoded in the deployed address: BEFORE_INITIALIZE | BEFORE_SWAP.
///      The hook address is part of the PoolKey, so this contract is never replaced once the pool is live.
///      Everything that may need to change later (signal source, fee bounds) is admin-settable state instead.
contract DynamicFeeHook is IHooks {
    using LPFeeLibrary for uint24;

    /// @notice Hard cap on any fee the admin can configure: 10% (fees are in hundredths of a bip, 1e6 = 100%).
    uint24 public constant MAX_FEE_CAP = 100_000;
    /// @notice Gas forwarded to the oracle. Bounds the cost a bad oracle can add to a swap.
    uint256 public constant ORACLE_GAS_LIMIT = 100_000;
    uint256 internal constant SCORE_ONE = 1e18;

    IPoolManager public immutable poolManager;

    address public owner;
    address public pendingOwner;

    IVolatilityOracle public oracle;
    uint24 public minFee; // fee when score == 0 (calm)
    uint24 public maxFee; // fee when score >= 1e18 (volatile)
    uint24 public fallbackFee; // fee when oracle is unset or fails

    event OracleSet(address oracle);
    event FeesSet(uint24 minFee, uint24 maxFee, uint24 fallbackFee);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error NotOwner();
    error NotPendingOwner();
    error HookNotImplemented();
    error PoolMustUseDynamicFee();
    error InvalidFees();
    error OracleHasNoCode();
    error InsufficientGasForOracle();

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
        address _owner,
        IVolatilityOracle _oracle,
        uint24 _minFee,
        uint24 _maxFee,
        uint24 _fallbackFee
    ) {
        poolManager = _poolManager;
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
        _setFees(_minFee, _maxFee, _fallbackFee);
        if (address(_oracle) != address(0)) _setOracle(_oracle);

        // Reverts unless deployed at an address whose low bits match exactly these permissions.
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

    /// @notice Fee (hundredths of a bip) the next swap on `key` would pay. Same code path as beforeSwap.
    function currentFee(PoolKey calldata key) public view returns (uint24) {
        (bool ok, uint256 score) = _readScore(key);
        if (!ok) return fallbackFee;
        if (score > SCORE_ONE) score = SCORE_ONE;
        // score <= 1e18, so result <= maxFee - minFee, fits uint24
        // forge-lint: disable-next-line(unsafe-typecast)
        return minFee + uint24((uint256(maxFee - minFee) * score) / SCORE_ONE);
    }

    /// @dev Low-level staticcall so a reverting, gas-hungry or malformed oracle degrades to fallbackFee
    ///      instead of bricking swaps.
    function _readScore(PoolKey calldata key) internal view returns (bool ok, uint256 score) {
        address o = address(oracle);
        if (o == address(0)) return (false, 0);

        // Caller must not be able to force the fallback by starving the oracle call of gas (EIP-150 63/64 rule).
        if (gasleft() < ORACLE_GAS_LIMIT + ORACLE_GAS_LIMIT / 63 + 5_000) revert InsufficientGasForOracle();

        bytes memory ret;
        (ok, ret) = o.staticcall{gas: ORACLE_GAS_LIMIT}(abi.encodeCall(IVolatilityOracle.volatilityScore, (key)));
        if (!ok || ret.length != 32) return (false, 0);
        score = abi.decode(ret, (uint256));
    }

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    /// @dev Only dynamic-fee pools may use this hook; on a static-fee pool the returned fee would be silently ignored.
    function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Returning fee | OVERRIDE_FEE_FLAG makes the PoolManager use this fee for this swap only.
    ///      No storage write, no call back into the PoolManager.
    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = currentFee(key);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // Callbacks below are not enabled in the address permission bits, so the PoolManager never calls them.

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

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Swap the volatility source. address(0) = always use fallbackFee.
    function setOracle(IVolatilityOracle _oracle) external onlyOwner {
        _setOracle(_oracle);
    }

    function setFees(uint24 _minFee, uint24 _maxFee, uint24 _fallbackFee) external onlyOwner {
        _setFees(_minFee, _maxFee, _fallbackFee);
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
        if (address(_oracle) != address(0) && address(_oracle).code.length == 0) revert OracleHasNoCode();
        oracle = _oracle;
        emit OracleSet(address(_oracle));
    }

    function _setFees(uint24 _minFee, uint24 _maxFee, uint24 _fallbackFee) internal {
        if (_minFee > _maxFee || _maxFee > MAX_FEE_CAP || _fallbackFee > MAX_FEE_CAP) revert InvalidFees();
        minFee = _minFee;
        maxFee = _maxFee;
        fallbackFee = _fallbackFee;
        emit FeesSet(_minFee, _maxFee, _fallbackFee);
    }
}
