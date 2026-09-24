// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

/// @notice Creates the dynamic-fee pool. MUST be broadcast by the hook owner calling
///         PoolManager directly (hook rejects any other initializer).
/// env: HOOK, TOKEN, PAIR (address(0) = native ETH), SQRT_PRICE_X96, TICK_SPACING
contract InitPool is Script {
    using PoolIdLibrary for PoolKey;

    IPoolManager constant POOL_MANAGER = IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);

    function run() external returns (PoolKey memory key) {
        address hook = vm.envAddress("HOOK");
        address token = vm.envAddress("TOKEN");
        address pair = vm.envAddress("PAIR");
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));
        int24 tickSpacing = int24(vm.envInt("TICK_SPACING"));

        (address c0, address c1) = token < pair ? (token, pair) : (pair, token); // currencies must be sorted
        key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG, // 0x800000: marks pool as dynamic-fee
            tickSpacing: tickSpacing,
            hooks: IHooks(hook)
        });

        vm.broadcast();
        POOL_MANAGER.initialize(key, sqrtPriceX96);

        console.log("poolId");
        console.logBytes32(PoolId.unwrap(key.toId()));
    }
}
