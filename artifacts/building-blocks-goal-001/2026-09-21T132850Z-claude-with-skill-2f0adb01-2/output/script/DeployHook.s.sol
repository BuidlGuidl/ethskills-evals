// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {StubVolatilityOracle} from "../src/StubVolatilityOracle.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {HookMiner} from "./HookMiner.sol";

/// @notice Deploys stub oracle + DynamicFeeHook at a flag-correct CREATE2 address.
/// env: OWNER (hook owner; must later call PoolManager.initialize), ORACLE_UPDATER
contract DeployHook is Script {
    /// Uniswap v4 PoolManager, Ethereum mainnet
    IPoolManager constant POOL_MANAGER = IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);
    /// Deterministic CREATE2 factory used by forge for `new X{salt: ...}` in scripts
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external returns (DynamicFeeHook hook, StubVolatilityOracle oracle) {
        address owner = vm.envAddress("OWNER");
        address updater = vm.envAddress("ORACLE_UPDATER");
        require(address(POOL_MANAGER).code.length > 0, "PoolManager not found on this chain");

        // fees in hundredths of a bip; vol in bps (annualized). Tune before launch.
        DynamicFeeHook.FeeConfig memory config = DynamicFeeHook.FeeConfig({
            minFee: 500, // 0.05% when calm
            maxFee: 10_000, // 1.00% when volatile
            fallbackFee: 10_000, // oracle down => charge max (safe side for LPs)
            maxStaleness: 1 hours,
            volLow: 3_000, // <=30% vol => minFee
            volHigh: 15_000 // >=150% vol => maxFee
        });

        vm.startBroadcast();

        oracle = new StubVolatilityOracle(updater, 0);

        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args = abi.encode(POOL_MANAGER, owner, IVolatilityOracle(address(oracle)), config);
        (address expected, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(DynamicFeeHook).creationCode, args);

        hook = new DynamicFeeHook{salt: salt}(POOL_MANAGER, owner, IVolatilityOracle(address(oracle)), config);
        require(address(hook) == expected, "hook address mismatch");

        vm.stopBroadcast();

        console.log("oracle", address(oracle));
        console.log("hook  ", address(hook));
    }
}
