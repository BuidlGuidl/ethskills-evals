// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {DynamicVolatilityFeeHook} from "../src/DynamicVolatilityFeeHook.sol";
import {MockVolatilityOracle} from "../src/mocks/MockVolatilityOracle.sol";

contract DynamicVolatilityFeeHookTest is Test {
    using PoolIdLibrary for PoolKey;

    address internal constant POOL_MANAGER = address(0x1111);
    uint24 internal constant CALM_FEE = 500;
    uint24 internal constant VOLATILE_FEE = 10_000;
    uint256 internal constant THRESHOLD_BPS = 250;

    DynamicVolatilityFeeHook internal hook;
    MockVolatilityOracle internal oracle;
    PoolKey internal key;
    SwapParams internal params;

    function setUp() public {
        oracle = new MockVolatilityOracle();
        hook = new DynamicVolatilityFeeHook(
            IPoolManager(POOL_MANAGER),
            oracle,
            CALM_FEE,
            VOLATILE_FEE,
            THRESHOLD_BPS
        );

        key = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        params = SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 0});

        hook.setTargetPool(key);
    }

    function testPreviewFeeUsesCalmFeeBelowThreshold() public {
        oracle.setVolatilityBps(249);

        assertEq(hook.previewFee(key, params, ""), CALM_FEE);
    }

    function testBeforeSwapReturnsVolatileFeeOverrideAtThreshold() public {
        oracle.setVolatilityBps(THRESHOLD_BPS);

        vm.prank(POOL_MANAGER);
        (bytes4 selector, BeforeSwapDelta delta, uint24 feeOverride) = hook.beforeSwap(address(this), key, params, "");

        assertEq(selector, IHooks.beforeSwap.selector);
        assertEq(BeforeSwapDelta.unwrap(delta), BeforeSwapDelta.unwrap(BeforeSwapDeltaLibrary.ZERO_DELTA));
        assertEq(feeOverride, VOLATILE_FEE | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function testBeforeSwapRejectsWrongCaller() public {
        vm.expectRevert(DynamicVolatilityFeeHook.NotPoolManager.selector);
        hook.beforeSwap(address(this), key, params, "");
    }

    function testBeforeSwapRejectsOtherPool() public {
        PoolKey memory otherKey = key;
        otherKey.tickSpacing = 10;

        vm.prank(POOL_MANAGER);
        vm.expectRevert();
        hook.beforeSwap(address(this), otherKey, params, "");
    }
}
