// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {ManualVolatilityOracle} from "../src/ManualVolatilityOracle.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";

contract DynamicFeeHookTest is Test, Deployers {
    DynamicFeeHook hook;
    ManualVolatilityOracle oracle;

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        oracle = new ManualVolatilityOracle(address(this), 0);
        DynamicFeeHook.FeeConfig memory config = DynamicFeeHook.FeeConfig({
            minFee: 500, maxFee: 10_000, fallbackFee: 3000, lowVol: 3000, highVol: 15_000
        });

        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) ^ (0x4444 << 144));
        deployCodeTo(
            "DynamicFeeHook.sol:DynamicFeeHook",
            abi.encode(manager, Currency.unwrap(currency0), address(this), IVolatilityOracle(address(oracle)), config),
            hookAddr
        );
        hook = DynamicFeeHook(hookAddr);

        (key,) = initPoolAndAddLiquidity(currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);
    }

    function _swapOut(uint256 vol) internal returns (int128) {
        oracle.setVolatility(vol);
        uint256 snap = vm.snapshotState();
        BalanceDelta d = swap(key, true, -1e15, ZERO_BYTES);
        vm.revertToState(snap);
        return d.amount1();
    }

    function test_feeFollowsVolatility() public {
        oracle.setVolatility(0);
        assertEq(hook.currentFee(key), 500);
        oracle.setVolatility(9000);
        assertEq(hook.currentFee(key), 500 + (10_000 - 500) / 2);
        oracle.setVolatility(1e9);
        assertEq(hook.currentFee(key), 10_000);
    }

    function test_calmSwapGetsMoreOutput() public {
        assertGt(_swapOut(0), _swapOut(1e9));
    }

    function test_brokenOracleUsesFallback() public {
        hook.setOracle(IVolatilityOracle(address(0xdead))); // no code
        assertEq(hook.currentFee(key), 3000);
        swap(key, true, -1e15, ZERO_BYTES); // still swappable
    }

    function test_rejectsStaticFeePool() public {
        vm.expectRevert();
        initPool(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
    }

    function test_onlyOwnerAdmin() public {
        vm.prank(address(0xbad));
        vm.expectRevert(DynamicFeeHook.NotOwner.selector);
        hook.setOracle(IVolatilityOracle(address(0)));
    }
}
