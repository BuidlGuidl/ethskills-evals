// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

import {StubVolatilityOracle} from "../src/StubVolatilityOracle.sol";
import {VolatilityDynamicFeeHook} from "../src/VolatilityDynamicFeeHook.sol";
import {VolatilityDynamicFeeHookHarness} from "./harness/VolatilityDynamicFeeHookHarness.sol";

contract VolatilityDynamicFeeHookTest is Test {
    using LPFeeLibrary for uint24;

    address private constant OWNER = address(0xA11CE);
    IPoolManager private constant MANAGER = IPoolManager(address(0x4444));

    StubVolatilityOracle private oracle;
    VolatilityDynamicFeeHookHarness private hook;

    function setUp() public {
        oracle = new StubVolatilityOracle(OWNER, 100);
        hook = new VolatilityDynamicFeeHookHarness(
            MANAGER,
            OWNER,
            oracle,
            VolatilityDynamicFeeHook.FeeConfig({calmFee: 500, volatileFee: 3000, volatilityThresholdBps: 250})
        );
    }

    function testPreviewFeeUsesCalmFeeBelowThreshold() public view {
        (uint24 fee, bool volatilePeriod) = hook.previewFee(249);

        assertEq(fee, 500);
        assertFalse(volatilePeriod);
    }

    function testPreviewFeeUsesVolatileFeeAtThreshold() public view {
        (uint24 fee, bool volatilePeriod) = hook.previewFee(250);

        assertEq(fee, 3000);
        assertTrue(volatilePeriod);
    }

    function testBeforeSwapReturnsFeeOverrideFromOracle() public {
        vm.prank(OWNER);
        oracle.setStubVolatilityBps(900);

        vm.prank(address(MANAGER));
        (bytes4 selector,, uint24 feeOverride) = hook.beforeSwap(address(this), _dynamicFeePoolKey(), _swapParams(), "");

        assertEq(selector, IHooks.beforeSwap.selector);
        assertEq(feeOverride, uint24(3000 | LPFeeLibrary.OVERRIDE_FEE_FLAG));
        assertEq(feeOverride.removeOverrideFlagAndValidate(), 3000);
    }

    function testBeforeSwapReturnsZeroDelta() public {
        vm.prank(address(MANAGER));
        (, BeforeSwapDelta rawDelta,) = hook.beforeSwap(address(this), _dynamicFeePoolKey(), _swapParams(), "");

        assertEq(BeforeSwapDelta.unwrap(rawDelta), BeforeSwapDelta.unwrap(BeforeSwapDeltaLibrary.ZERO_DELTA));
    }

    function testOnlyOwnerCanUpdateFeeConfig() public {
        vm.expectRevert(VolatilityDynamicFeeHook.NotOwner.selector);
        hook.setFeeConfig(
            VolatilityDynamicFeeHook.FeeConfig({calmFee: 100, volatileFee: 200, volatilityThresholdBps: 1})
        );

        vm.prank(OWNER);
        hook.setFeeConfig(
            VolatilityDynamicFeeHook.FeeConfig({calmFee: 100, volatileFee: 200, volatilityThresholdBps: 1})
        );

        (uint24 fee,) = hook.previewFee(1);
        assertEq(fee, 200);
    }

    function testRejectsVolatileFeeBelowCalmFee() public {
        vm.expectRevert(
            abi.encodeWithSelector(VolatilityDynamicFeeHook.VolatileFeeBelowCalmFee.selector, uint24(3000), uint24(500))
        );
        new VolatilityDynamicFeeHookHarness(
            MANAGER,
            OWNER,
            oracle,
            VolatilityDynamicFeeHook.FeeConfig({calmFee: 3000, volatileFee: 500, volatilityThresholdBps: 250})
        );
    }

    function _dynamicFeePoolKey() private view returns (PoolKey memory key) {
        key.fee = LPFeeLibrary.DYNAMIC_FEE_FLAG;
        key.tickSpacing = 60;
        key.hooks = IHooks(address(hook));
    }

    function _swapParams() private pure returns (SwapParams memory params) {
        params.zeroForOne = true;
        params.amountSpecified = -1 ether;
        params.sqrtPriceLimitX96 = 0;
    }
}
