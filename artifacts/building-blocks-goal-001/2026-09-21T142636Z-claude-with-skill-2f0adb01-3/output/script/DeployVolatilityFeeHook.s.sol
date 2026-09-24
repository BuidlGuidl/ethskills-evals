// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {HookMiner} from "v4-periphery/test/shared/HookMiner.sol";
import {VolatilityFeeHook} from "../src/VolatilityFeeHook.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

/// @notice Deploys oracle stub (optional) + hook at a mined address, then initializes the dynamic-fee pool.
/// Env: OWNER (must be the broadcaster — only owner may initialize), TOKEN_A, TOKEN_B (address(0) = native ETH),
///      SQRT_PRICE_X96, TICK_SPACING (default 60), POOL_MANAGER (default mainnet), ORACLE (default: deploy stub)
contract DeployVolatilityFeeHook is Script {
    using PoolIdLibrary for PoolKey;

    address constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;

    function run() external {
        address owner = vm.envAddress("OWNER");
        IPoolManager manager = IPoolManager(vm.envOr("POOL_MANAGER", MAINNET_POOL_MANAGER));
        address tokenA = vm.envAddress("TOKEN_A");
        address tokenB = vm.envAddress("TOKEN_B");
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));
        int24 tickSpacing = int24(int256(vm.envOr("TICK_SPACING", uint256(60))));
        address oracleAddr = vm.envOr("ORACLE", address(0));

        require(address(manager).code.length > 0, "PoolManager not deployed on this chain");

        // Starting config: 0.05% when calm (<=30% vol), ramping to 1.00% at >=150% vol; fail closed to the max.
        VolatilityFeeHook.FeeConfig memory config = VolatilityFeeHook.FeeConfig({
            minFee: 500, maxFee: 10_000, fallbackFee: 10_000, volLow: 3_000, volHigh: 15_000
        });

        vm.startBroadcast();

        if (oracleAddr == address(0)) oracleAddr = address(new ManualVolatilityOracle(owner));

        // Hook address low 14 bits must equal the permission flags. `new X{salt:}` inside a forge script
        // is routed through the canonical CREATE2 deployer, so mine against that address.
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args = abi.encode(manager, owner, IVolatilityOracle(oracleAddr), config);
        (address expected, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(VolatilityFeeHook).creationCode, args);

        VolatilityFeeHook hook =
            new VolatilityFeeHook{salt: salt}(manager, owner, IVolatilityOracle(oracleAddr), config);
        require(address(hook) == expected, "hook address mismatch");

        (address c0, address c1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG, // required: marks the pool as dynamic-fee, forever
            tickSpacing: tickSpacing,
            hooks: IHooks(address(hook))
        });
        manager.initialize(key, sqrtPriceX96);

        vm.stopBroadcast();

        console2.log("oracle", oracleAddr);
        console2.log("hook", address(hook));
        console2.logBytes32(PoolId.unwrap(key.toId()));
    }
}
