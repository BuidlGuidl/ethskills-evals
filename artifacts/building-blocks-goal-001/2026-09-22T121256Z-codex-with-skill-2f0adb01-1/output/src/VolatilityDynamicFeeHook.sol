// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilityFeeOracle} from "./IVolatilityFeeOracle.sol";

/// @notice Uniswap v4 beforeSwap hook that chooses this swap's LP fee from a volatility oracle.
contract VolatilityDynamicFeeHook {
    using LPFeeLibrary for uint24;

    uint32 public constant DEFAULT_ORACLE_GAS_LIMIT = 50_000;

    IPoolManager public immutable POOL_MANAGER;

    address public owner;
    IVolatilityFeeOracle public feeOracle;
    uint24 public defaultFee;
    uint24 public maxFee;
    uint32 public oracleGasLimit;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeOracleSet(address indexed oracle);
    event FeeConfigSet(uint24 defaultFee, uint24 maxFee);
    event OracleGasLimitSet(uint32 oracleGasLimit);

    error OnlyOwner();
    error OnlyPoolManager();
    error ZeroAddress();
    error InvalidFeeConfig();
    error PoolMustUseDynamicFee();
    error WrongHook();

    constructor(
        IPoolManager _poolManager,
        IVolatilityFeeOracle _feeOracle,
        uint24 _defaultFee,
        uint24 _maxFee,
        uint32 _oracleGasLimit
    ) {
        if (address(_poolManager) == address(0)) revert ZeroAddress();

        POOL_MANAGER = _poolManager;
        owner = msg.sender;

        _setFeeConfig(_defaultFee, _maxFee);
        _setFeeOracle(_feeOracle);
        _setOracleGasLimit(_oracleGasLimit == 0 ? DEFAULT_ORACLE_GAS_LIMIT : _oracleGasLimit);

        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    /// @notice Exact hook permissions encoded into the deployed hook address.
    function getHookPermissions() public pure returns (Hooks.Permissions memory permissions) {
        permissions.beforeSwap = true;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeeOracle(IVolatilityFeeOracle newOracle) external onlyOwner {
        _setFeeOracle(newOracle);
    }

    function setFeeConfig(uint24 newDefaultFee, uint24 newMaxFee) external onlyOwner {
        _setFeeConfig(newDefaultFee, newMaxFee);
    }

    function setOracleGasLimit(uint32 newOracleGasLimit) external onlyOwner {
        _setOracleGasLimit(newOracleGasLimit);
    }

    /// @notice Called by Uniswap v4 immediately before a swap.
    /// @dev The returned fee must set OVERRIDE_FEE_FLAG. PoolManager applies it only for dynamic-fee pools.
    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (msg.sender != address(POOL_MANAGER)) revert OnlyPoolManager();
        if (address(key.hooks) != address(this)) revert WrongHook();
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();

        uint24 fee = _resolveFee(key, params, hookData);
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _resolveFee(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        view
        returns (uint24 fee)
    {
        fee = defaultFee;

        IVolatilityFeeOracle oracle = feeOracle;
        if (address(oracle) == address(0)) return fee;

        (bool success, bytes memory data) = address(oracle).staticcall{gas: oracleGasLimit}(
            abi.encodeCall(IVolatilityFeeOracle.getFee, (key, params, hookData))
        );

        if (success && data.length >= 32) {
            uint256 candidate = abi.decode(data, (uint256));
            // casting is safe because candidate is bounded by maxFee, which is uint24
            // forge-lint: disable-next-line(unsafe-typecast)
            if (candidate <= maxFee) fee = uint24(candidate);
        }
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert OnlyOwner();
    }

    function _setFeeOracle(IVolatilityFeeOracle newOracle) internal {
        feeOracle = newOracle;
        emit FeeOracleSet(address(newOracle));
    }

    function _setFeeConfig(uint24 newDefaultFee, uint24 newMaxFee) internal {
        if (newDefaultFee > newMaxFee || newMaxFee > LPFeeLibrary.MAX_LP_FEE) revert InvalidFeeConfig();

        defaultFee = newDefaultFee;
        maxFee = newMaxFee;
        emit FeeConfigSet(newDefaultFee, newMaxFee);
    }

    function _setOracleGasLimit(uint32 newOracleGasLimit) internal {
        if (newOracleGasLimit == 0) revert InvalidFeeConfig();

        oracleGasLimit = newOracleGasLimit;
        emit OracleGasLimitSet(newOracleGasLimit);
    }
}
