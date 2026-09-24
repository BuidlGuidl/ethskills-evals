// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";

import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

/// @notice Deploys oracle stub + hook (at a mined CREATE2 address) and initializes the dynamic-fee pool.
/// Env:
///   TOKEN          our token
///   PAIR_TOKEN     other side, optional (default address(0) = native ETH)
///   SQRT_PRICE_X96 sqrt(currency1 per currency0, raw units) * 2^96
///   OWNER          hook admin (multisig/timelock)
///   POOL_MANAGER   optional, defaults to Ethereum mainnet v4 PoolManager
///   TICK_SPACING   optional, default 60
contract DeployDynamicFeeHook is Script {
    using PoolIdLibrary for PoolKey;

    address constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;

    function run() external {
        IPoolManager manager = IPoolManager(vm.envOr("POOL_MANAGER", MAINNET_POOL_MANAGER));
        address token = vm.envAddress("TOKEN");
        address pair = vm.envOr("PAIR_TOKEN", address(0));
        address owner = vm.envAddress("OWNER");
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token < pair ? token : pair),
            currency1: Currency.wrap(token < pair ? pair : token),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG, // must be set at init; can't be changed later
            tickSpacing: int24(int256(vm.envOr("TICK_SPACING", uint256(60)))),
            hooks: IHooks(address(0)) // filled in after deploy
        });

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers(); // the EOA actually signing
        ManualVolatilityOracle oracle = new ManualVolatilityOracle(owner, 0);
        key.hooks = IHooks(_deployHook(manager, key, deployer, owner, address(oracle)));
        manager.initialize(key, sqrtPriceX96);
        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("hook  ", address(key.hooks));
        console2.log("poolId");
        console2.logBytes32(PoolId.unwrap(key.toId()));
    }

    /// @param initializer EOA running this script; the only address allowed to initialize the pool.
    function _deployHook(IPoolManager manager, PoolKey memory key, address initializer, address owner, address oracle)
        internal
        returns (address hook)
    {
        // Fees in hundredths of a bip: 500 = 0.05%, 3000 = 0.30%, 10000 = 1%.
        DynamicFeeHook.FeeConfig memory cfg = DynamicFeeHook.FeeConfig({
            minFee: 500,
            maxFee: 10_000,
            fallbackFee: 10_000, // fail high so nobody profits from breaking/griefing the oracle
            volLow: 100, // 1%
            volHigh: 1_000 // 10%
        });

        bytes memory args =
            abi.encode(manager, key.currency0, key.currency1, key.tickSpacing, initializer, owner, oracle, cfg);
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes32 salt;
        (hook, salt) = HookMiner.find(CREATE2_FACTORY, flags, type(DynamicFeeHook).creationCode, args);

        // Canonical CREATE2 factory: calldata = salt ++ initcode.
        (bool ok,) = CREATE2_FACTORY.call(abi.encodePacked(salt, type(DynamicFeeHook).creationCode, args));
        require(ok && hook.code.length > 0, "hook deploy failed");
    }
}
