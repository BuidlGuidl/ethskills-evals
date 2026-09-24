// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {StubVolatilityOracle} from "../src/StubVolatilityOracle.sol";
import {VolatilityDynamicFeeHook} from "../src/VolatilityDynamicFeeHook.sol";

contract DeployVolatilityDynamicFeeHook is Script {
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address internal constant ETHEREUM_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;

    function run()
        external
        returns (VolatilityDynamicFeeHook hook, IVolatilityOracle oracle, bytes32 salt, address minedHookAddress)
    {
        IPoolManager manager = IPoolManager(vm.envOr("POOL_MANAGER", ETHEREUM_POOL_MANAGER));
        address owner = vm.envAddress("OWNER");
        address oracleAddress = vm.envOr("VOLATILITY_ORACLE", address(0));

        VolatilityDynamicFeeHook.FeeConfig memory feeConfig = VolatilityDynamicFeeHook.FeeConfig({
            calmFee: uint24(vm.envOr("CALM_FEE", uint256(500))),
            volatileFee: uint24(vm.envOr("VOLATILE_FEE", uint256(3000))),
            volatilityThresholdBps: vm.envOr("VOLATILITY_THRESHOLD_BPS", uint256(250))
        });

        if (oracleAddress == address(0)) {
            uint256 initialStubVolatilityBps = vm.envOr("INITIAL_STUB_VOLATILITY_BPS", uint256(0));
            vm.broadcast();
            oracle = new StubVolatilityOracle(owner, initialStubVolatilityBps);
        } else {
            oracle = IVolatilityOracle(oracleAddress);
        }

        bytes memory constructorArgs = abi.encode(manager, owner, oracle, feeConfig);
        (minedHookAddress, salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            uint160(Hooks.BEFORE_SWAP_FLAG),
            type(VolatilityDynamicFeeHook).creationCode,
            constructorArgs
        );

        vm.broadcast();
        hook = new VolatilityDynamicFeeHook{salt: salt}(manager, owner, oracle, feeConfig);

        require(address(hook) == minedHookAddress, "hook address mismatch");
    }
}
