// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {VolatilityDynamicFeeHook} from "../../src/VolatilityDynamicFeeHook.sol";
import {IVolatilityOracle} from "../../src/interfaces/IVolatilityOracle.sol";

contract VolatilityDynamicFeeHookHarness is VolatilityDynamicFeeHook {
    constructor(
        IPoolManager manager,
        address initialOwner,
        IVolatilityOracle initialOracle,
        FeeConfig memory initialFeeConfig
    ) VolatilityDynamicFeeHook(manager, initialOwner, initialOracle, initialFeeConfig) {}

    function validateHookAddress(BaseHook) internal pure override {}
}
