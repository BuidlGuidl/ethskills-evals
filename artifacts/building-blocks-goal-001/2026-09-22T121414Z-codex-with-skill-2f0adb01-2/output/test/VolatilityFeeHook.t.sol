// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {ManualVolatilitySignal, VolatilityFeeHook} from "../src/VolatilityFeeHook.sol";

contract VolatilityFeeHookTest is Test {
    address internal constant OWNER = address(0xA11CE);
    address internal constant POOL_MANAGER = address(0x4444);
    address internal constant HOOK_ADDRESS = address(uint160(0x1080));

    function testFeeForVolatilityBpsUsesConfiguredTiers() public {
        ManualVolatilitySignal signal = new ManualVolatilitySignal(OWNER, 0);

        VolatilityFeeHook.FeePolicy memory policy = VolatilityFeeHook.FeePolicy({
            calmFee: 500, normalFee: 3000, volatileFee: 10_000, normalVolatilityBps: 100, volatileVolatilityBps: 500
        });

        bytes memory args = abi.encode(IPoolManager(POOL_MANAGER), signal, OWNER, policy);
        deployCodeTo("VolatilityFeeHook.sol:VolatilityFeeHook", args, HOOK_ADDRESS);
        VolatilityFeeHook hook = VolatilityFeeHook(HOOK_ADDRESS);

        assertEq(hook.feeForVolatilityBps(99), 500);
        assertEq(hook.feeForVolatilityBps(100), 3000);
        assertEq(hook.feeForVolatilityBps(499), 3000);
        assertEq(hook.feeForVolatilityBps(500), 10_000);
    }

    function testManualVolatilitySignalIsOwnerSet() public {
        ManualVolatilitySignal signal = new ManualVolatilitySignal(OWNER, 123);

        assertEq(signal.manualVolatilityBps(), 123);

        vm.prank(OWNER);
        signal.setVolatilityBps(456);

        assertEq(signal.manualVolatilityBps(), 456);
    }
}
