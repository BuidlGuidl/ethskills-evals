// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {HookMiner} from "v4-periphery/test/shared/HookMiner.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {StubVolatilitySignal} from "../src/StubVolatilitySignal.sol";
import {IVolatilitySignal} from "../src/interfaces/IVolatilitySignal.sol";

/// @notice Deploys signal + hook (mined address), creates the dynamic-fee pool, hands ownership to a multisig.
/// env: POOL_MANAGER, TOKEN, PAIR_TOKEN (address(0) = native ETH), SQRT_PRICE_X96, TICK_SPACING, FINAL_OWNER
contract DeployDynamicFeeHook is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        IPoolManager manager = IPoolManager(vm.envAddress("POOL_MANAGER"));
        address token = vm.envAddress("TOKEN");
        address pairToken = vm.envAddress("PAIR_TOKEN");
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));
        // forge-lint: disable-next-line(unsafe-typecast)
        int24 tickSpacing = int24(int256(vm.envUint("TICK_SPACING")));
        address finalOwner = vm.envAddress("FINAL_OWNER");

        // placeholder numbers: 0.05% calm .. 1% volatile, 0.30% if signal fails
        DynamicFeeHook.FeeParams memory params = DynamicFeeHook.FeeParams({
            minFee: 500, maxFee: 10_000, fallbackFee: 3000, lowVol: 2000, highVol: 15_000
        });

        vm.startBroadcast();
        address deployer = msg.sender;

        IVolatilitySignal signal = new StubVolatilitySignal(finalOwner, 0);

        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args = abi.encode(manager, deployer, signal, params);
        (address expected, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(DynamicFeeHook).creationCode, args);
        DynamicFeeHook hook = new DynamicFeeHook{salt: salt}(manager, deployer, signal, params);
        require(address(hook) == expected, "hook address mismatch");

        (address a, address b) = token < pairToken ? (token, pairToken) : (pairToken, token);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(a),
            currency1: Currency.wrap(b),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(hook))
        });
        // must be called directly (not via PositionManager multicall): hook checks sender == owner
        manager.initialize(key, sqrtPriceX96);

        hook.transferOwnership(finalOwner); // finalOwner must call acceptOwnership()
        vm.stopBroadcast();

        console2.log("signal", address(signal));
        console2.log("hook", address(hook));
    }
}
