// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Fee signal consumed by VolatilityDynamicFeeHook.
/// @dev Fees are Uniswap v4 LP fees, denominated in hundredths of a bip:
///      500 = 0.05%, 3000 = 0.30%, 10000 = 1%.
interface IVolatilityFeeOracle {
    function getFee(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        returns (uint24 fee);
}
