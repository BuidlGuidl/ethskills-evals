// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ManualVolatilityOracle} from "../src/ManualVolatilityOracle.sol";
import {VolatilityDynamicFeeHook} from "../src/VolatilityDynamicFeeHook.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

contract VolatilityDynamicFeeHookTest is Test {
    address internal constant OWNER = address(0xA11CE);
    address internal constant MANAGER = address(0xBEEF);

    Currency internal constant CURRENCY0 = Currency.wrap(address(0x1000));
    Currency internal constant CURRENCY1 = Currency.wrap(address(0x2000));
    int24 internal constant TICK_SPACING = 60;

    ManualVolatilityOracle internal oracle;
    VolatilityDynamicFeeHook internal hook;
    PoolKey internal key;

    function setUp() public {
        oracle = new ManualVolatilityOracle(OWNER, 0);

        VolatilityDynamicFeeHook.FeeConfig memory config = VolatilityDynamicFeeHook.FeeConfig({
            calmFee: 500, normalFee: 3000, volatileFee: 10_000, elevatedVolatilityBps: 200, highVolatilityBps: 800
        });

        address hookAddress = address(uint160(Hooks.BEFORE_SWAP_FLAG));
        deployCodeTo(
            "VolatilityDynamicFeeHook.sol:VolatilityDynamicFeeHook",
            abi.encode(IPoolManager(MANAGER), CURRENCY0, CURRENCY1, TICK_SPACING, oracle, config, OWNER),
            hookAddress
        );
        hook = VolatilityDynamicFeeHook(hookAddress);

        key = PoolKey({
            currency0: CURRENCY0,
            currency1: CURRENCY1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
    }

    function testFeeBands() public view {
        assertEq(hook.feeForVolatility(0), 500);
        assertEq(hook.feeForVolatility(199), 500);
        assertEq(hook.feeForVolatility(200), 3000);
        assertEq(hook.feeForVolatility(799), 3000);
        assertEq(hook.feeForVolatility(800), 10_000);
    }

    function testBeforeSwapReturnsOverrideFee() public {
        vm.prank(OWNER);
        oracle.setVolatilityBps(900);

        SwapParams memory params =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 4_295_128_739});

        vm.prank(MANAGER);
        (bytes4 selector, BeforeSwapDelta delta, uint24 feeOverride) = hook.beforeSwap(address(0xCAFE), key, params, "");

        assertEq(selector, IHooks.beforeSwap.selector);
        assertEq(BeforeSwapDelta.unwrap(delta), 0);
        assertEq(feeOverride, LPFeeLibrary.OVERRIDE_FEE_FLAG | 10_000);
    }

    function testOnlyPoolManagerCanCallBeforeSwap() public {
        SwapParams memory params =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 4_295_128_739});

        vm.expectRevert(VolatilityDynamicFeeHook.OnlyPoolManager.selector);
        hook.beforeSwap(address(this), key, params, "");
    }

    function testRejectsStaticFeePool() public {
        key.fee = 3000;

        SwapParams memory params =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 4_295_128_739});

        vm.prank(MANAGER);
        vm.expectRevert(VolatilityDynamicFeeHook.InvalidPool.selector);
        hook.beforeSwap(address(this), key, params, "");
    }
}
