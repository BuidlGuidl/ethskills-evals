// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {HookMiner} from "v4-periphery/test/shared/HookMiner.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {StubVolatilityOracle} from "../src/mocks/StubVolatilityOracle.sol";

/// @notice Deploys stub oracle + hook (at a mined address) and initializes the dynamic-fee pool.
/// Env: OWNER, TOKEN, PAIR_TOKEN (address(0) = native ETH), SQRT_PRICE_X96, TICK_SPACING (default 60)
contract DeployDynamicFeeHook is Script {
    // Uniswap v4 PoolManager, Ethereum mainnet
    IPoolManager constant POOL_MANAGER = IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);
    // Deterministic CREATE2 deployer used by forge for `new X{salt: s}` in broadcasts
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        address owner = vm.envAddress("OWNER");
        address token = vm.envAddress("TOKEN");
        address pair = vm.envOr("PAIR_TOKEN", address(0));
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));
        int24 tickSpacing = int24(int256(vm.envOr("TICK_SPACING", uint256(60))));

        // 0.05% calm .. 1% volatile; 0.30% if the oracle fails. Vol thresholds in bps (placeholder units).
        DynamicFeeHook.FeeConfig memory cfg =
            DynamicFeeHook.FeeConfig({minFee: 500, maxFee: 10_000, fallbackFee: 3000, lowVol: 2000, highVol: 10_000});

        vm.startBroadcast();

        IVolatilityOracle oracle = new StubVolatilityOracle(owner, 0);

        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args = abi.encode(POOL_MANAGER, owner, oracle, cfg);
        (address expected, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(DynamicFeeHook).creationCode, args);

        DynamicFeeHook hook = new DynamicFeeHook{salt: salt}(POOL_MANAGER, owner, oracle, cfg);
        require(address(hook) == expected, "hook address mismatch");

        (address c0, address c1) = token < pair ? (token, pair) : (pair, token);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG, // required, otherwise hook's fee is ignored
            tickSpacing: tickSpacing,
            hooks: IHooks(address(hook))
        });
        POOL_MANAGER.initialize(key, sqrtPriceX96);

        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("hook", address(hook));
    }
}
