// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";

import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

/// Env: TOKEN, PAIR_TOKEN (address(0) = native ETH), OWNER (multisig/timelock),
///      ORACLE_UPDATER, TICK_SPACING, SQRT_PRICE_X96.
/// Run: forge script script/DeployDynamicFeeHook.s.sol --rpc-url mainnet --broadcast --verify
contract DeployDynamicFeeHook is Script {
    // Uniswap v4 PoolManager, Ethereum mainnet (verified onchain 2026-09-21, block 26026557).
    IPoolManager constant POOL_MANAGER = IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);
    // Deterministic CREATE2 deployer forge routes `new X{salt: s}` through.
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        address token = vm.envAddress("TOKEN");
        address pair = vm.envAddress("PAIR_TOKEN");
        address owner = vm.envAddress("OWNER");
        address updater = vm.envAddress("ORACLE_UPDATER");
        int24 tickSpacing = int24(vm.envInt("TICK_SPACING"));
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));

        (Currency c0, Currency c1) =
            token < pair ? (Currency.wrap(token), Currency.wrap(pair)) : (Currency.wrap(pair), Currency.wrap(token));

        vm.startBroadcast();

        IVolatilityOracle oracle = new ManualVolatilityOracle(updater, 2000);
        bytes memory initCode = abi.encodePacked(
            type(DynamicFeeHook).creationCode,
            abi.encode(POOL_MANAGER, c0, c1, tickSpacing, owner, oracle, _feeConfig())
        );
        address hook = _deployHook(initCode);

        PoolKey memory key = PoolKey({
            currency0: c0,
            currency1: c1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks: IHooks(hook)
        });
        POOL_MANAGER.initialize(key, sqrtPriceX96);

        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("hook  ", hook);
    }

    /// Example curve: 0.05% when calm (vol <= 20%), 1.00% when volatile (vol >= 150%).
    function _feeConfig() internal pure returns (DynamicFeeHook.FeeConfig memory) {
        return DynamicFeeHook.FeeConfig({minFee: 500, maxFee: 10_000, fallbackFee: 3000, volLow: 2000, volHigh: 15_000});
    }

    /// Mine a salt so the address's low 14 bits equal the hook's permission flags, then
    /// deploy through the CREATE2 deployer.
    function _deployHook(bytes memory initCode) internal returns (address hook) {
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        (address expected, bytes32 salt) = HookMiner.find(CREATE2_DEPLOYER, flags, initCode, "");
        (bool ok,) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, initCode));
        require(ok && expected.code.length > 0, "hook deploy failed");
        return expected;
    }
}
