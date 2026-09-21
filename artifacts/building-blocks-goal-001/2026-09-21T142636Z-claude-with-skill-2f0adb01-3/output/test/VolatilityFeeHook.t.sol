// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {VolatilityFeeHook} from "../src/VolatilityFeeHook.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

contract RevertingOracle is IVolatilityOracle {
    function volatility(PoolKey calldata) external pure returns (uint256) {
        revert("down");
    }
}

contract VolatilityFeeHookTest is Test, Deployers {
    VolatilityFeeHook hook;
    ManualVolatilityOracle oracle;

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();
        oracle = new ManualVolatilityOracle(address(this));

        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (uint160(0x4444) << 144));
        VolatilityFeeHook.FeeConfig memory c =
            VolatilityFeeHook.FeeConfig({minFee: 500, maxFee: 10_000, fallbackFee: 10_000, volLow: 3_000, volHigh: 15_000});
        deployCodeTo("VolatilityFeeHook.sol:VolatilityFeeHook", abi.encode(manager, address(this), oracle, c), hookAddr);
        hook = VolatilityFeeHook(hookAddr);

        (key,) = initPoolAndAddLiquidity(currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);
    }

    function _swapFee() internal returns (uint24 fee) {
        vm.recordLogs();
        swap(key, true, -1e15, ZERO_BYTES);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == IPoolManager.Swap.selector) {
                (,,,,,fee) = abi.decode(logs[i].data, (int128, int128, uint160, uint128, int24, uint24));
            }
        }
    }

    function test_feeTracksVolatility() public {
        oracle.setVolatility(key.toId(), 1_000); // calm
        assertEq(_swapFee(), 500);
        oracle.setVolatility(key.toId(), 9_000); // halfway
        assertEq(_swapFee(), 5_250);
        oracle.setVolatility(key.toId(), 50_000); // wild
        assertEq(_swapFee(), 10_000);
    }

    function test_oracleFailureUsesFallback() public {
        hook.setOracle(new RevertingOracle());
        assertEq(_swapFee(), 10_000);
    }

    function test_rejectsStaticFeePool() public {
        vm.expectRevert();
        initPool(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
    }

    function test_onlyOwnerInitializes() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        manager.initialize(PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 10, IHooks(address(hook))), SQRT_PRICE_1_1);
    }

    function test_configBounds() public {
        vm.expectRevert(VolatilityFeeHook.InvalidFeeConfig.selector);
        hook.setFeeConfig(VolatilityFeeHook.FeeConfig(500, 200_000, 500, 1, 2));
        vm.prank(address(0xBEEF));
        vm.expectRevert(VolatilityFeeHook.NotOwner.selector);
        hook.setOracle(IVolatilityOracle(address(0)));
    }
}
