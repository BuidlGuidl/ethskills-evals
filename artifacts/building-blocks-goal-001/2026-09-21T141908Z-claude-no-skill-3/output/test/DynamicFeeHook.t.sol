// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

contract RevertingOracle is IVolatilityOracle {
    function volatility(PoolId) external pure returns (uint256) {
        revert("down");
    }
}

contract DynamicFeeHookTest is Test, Deployers {
    DynamicFeeHook hook;
    ManualVolatilityOracle oracle;

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        oracle = new ManualVolatilityOracle(address(this), 0);
        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (1 << 144));
        DynamicFeeHook.FeeConfig memory cfg = DynamicFeeHook.FeeConfig(500, 10_000, 10_000, 100, 1_000);
        deployCodeTo(
            "DynamicFeeHook.sol:DynamicFeeHook",
            abi.encode(manager, currency0, currency1, int24(60), address(this), address(this), oracle, cfg),
            hookAddr
        );
        hook = DynamicFeeHook(hookAddr);

        (key,) = initPoolAndAddLiquidity(currency0, currency1, hook, LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);
    }

    function _swapFee() internal returns (uint24) {
        vm.recordLogs();
        swap(key, true, -1e15, ZERO_BYTES);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == IPoolManager.Swap.selector) {
                (,,,,, uint24 fee) = abi.decode(logs[i].data, (int128, int128, uint160, uint128, int24, uint24));
                return fee;
            }
        }
        revert("no swap event");
    }

    function test_feeFollowsVolatility() public {
        oracle.setVolatility(50); // calm
        assertEq(_swapFee(), 500);

        oracle.setVolatility(550); // halfway between 100 and 1000
        assertEq(_swapFee(), 5_250);

        oracle.setVolatility(5_000); // volatile
        assertEq(_swapFee(), 10_000);
    }

    function test_brokenOracleUsesFallback() public {
        hook.setOracle(new RevertingOracle());
        assertEq(_swapFee(), 10_000);
    }

    function test_rejectsOtherPools() public {
        // same hook, different tick spacing -> different pool -> rejected
        vm.expectRevert();
        initPool(currency0, currency1, hook, LPFeeLibrary.DYNAMIC_FEE_FLAG, 10, SQRT_PRICE_1_1);

        // static-fee pool -> rejected
        vm.expectRevert();
        initPool(currency0, currency1, hook, 3000, 60, SQRT_PRICE_1_1);
    }

    function test_onlyOwnerCanConfigure() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(DynamicFeeHook.NotOwner.selector);
        hook.setOracle(IVolatilityOracle(address(0)));
    }
}
