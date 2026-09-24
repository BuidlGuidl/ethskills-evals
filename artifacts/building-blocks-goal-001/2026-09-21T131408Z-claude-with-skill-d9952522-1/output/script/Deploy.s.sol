// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {VolatilityFeeHook} from "../src/VolatilityFeeHook.sol";
import {IVolatilitySignal} from "../src/interfaces/IVolatilitySignal.sol";
import {StubVolatilitySignal} from "../src/mocks/StubVolatilitySignal.sol";

/// Deploys signal (stub unless SIGNAL is set) + hook, initializes the dynamic-fee pool,
/// then starts ownership handoff to FINAL_OWNER (who must call acceptOwnership()).
///
/// env: TOKEN, PAIR (0x0 = native ETH), SQRT_PRICE_X96, TICK_SPACING (default 60),
///      FINAL_OWNER, SIGNAL (optional), MIN_FEE, MAX_FEE, LOW_VOL, HIGH_VOL
contract Deploy is Script {
    // Uniswap v4 PoolManager, Ethereum mainnet (verified onchain 2026-09-21).
    IPoolManager constant POOL_MANAGER = IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);
    // Deterministic CREATE2 deployer forge uses for `new X{salt: ...}` in scripts.
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        address finalOwner = vm.envAddress("FINAL_OWNER");

        VolatilityFeeHook.FeeConfig memory config = VolatilityFeeHook.FeeConfig({
            minFee: uint24(vm.envOr("MIN_FEE", uint256(500))), // 0.05%
            maxFee: uint24(vm.envOr("MAX_FEE", uint256(10_000))), // 1%
            lowVolatility: vm.envOr("LOW_VOL", uint256(2_000)),
            highVolatility: vm.envOr("HIGH_VOL", uint256(15_000))
        });

        vm.startBroadcast();
        address deployer = msg.sender;

        IVolatilitySignal signal = IVolatilitySignal(vm.envOr("SIGNAL", address(0)));
        if (address(signal) == address(0)) signal = new StubVolatilitySignal(finalOwner, 0);

        // Hook address low bits must equal its permission flags.
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args = abi.encode(POOL_MANAGER, deployer, signal, config);
        (address expected, bytes32 salt) = mineSalt(flags, abi.encodePacked(type(VolatilityFeeHook).creationCode, args));

        VolatilityFeeHook hook = new VolatilityFeeHook{salt: salt}(POOL_MANAGER, deployer, signal, config);
        require(address(hook) == expected, "hook address mismatch");

        PoolKey memory key = poolKey(hook);
        POOL_MANAGER.initialize(key, uint160(vm.envUint("SQRT_PRICE_X96")));

        hook.transferOwnership(finalOwner);
        vm.stopBroadcast();

        console2.log("signal", address(signal));
        console2.log("hook", address(hook));
        console2.logBytes32(keccak256(abi.encode(key)));
    }

    function poolKey(VolatilityFeeHook hook) internal view returns (PoolKey memory) {
        address token = vm.envAddress("TOKEN");
        address pair = vm.envOr("PAIR", address(0));
        (address a, address b) = token < pair ? (token, pair) : (pair, token);
        return PoolKey({
            currency0: Currency.wrap(a),
            currency1: Currency.wrap(b),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: int24(int256(vm.envOr("TICK_SPACING", uint256(60)))),
            hooks: IHooks(address(hook))
        });
    }

    function mineSalt(uint160 flags, bytes memory initCode) internal view returns (address, bytes32) {
        bytes32 initHash = keccak256(initCode);
        for (uint256 i; i < 500_000; i++) {
            address a = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, bytes32(i), initHash))))
            );
            if (uint160(a) & Hooks.ALL_HOOK_MASK == flags && a.code.length == 0) return (a, bytes32(i));
        }
        revert("salt not found");
    }
}
