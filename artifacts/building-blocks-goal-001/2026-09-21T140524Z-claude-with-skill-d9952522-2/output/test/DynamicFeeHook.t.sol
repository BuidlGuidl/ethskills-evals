// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {CustomRevert} from "v4-core/libraries/CustomRevert.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {StubVolatilitySignal} from "../src/StubVolatilitySignal.sol";
import {IVolatilitySignal} from "../src/interfaces/IVolatilitySignal.sol";

contract RevertingSignal {
    function volatility(bytes32) external pure returns (uint256) {
        revert("boom");
    }
}

contract DynamicFeeHookTest is Test, Deployers {
    DynamicFeeHook hook;
    StubVolatilitySignal signal;
    DynamicFeeHook.FeeParams params =
        DynamicFeeHook.FeeParams({minFee: 500, maxFee: 10_000, fallbackFee: 3000, lowVol: 2000, highVol: 15_000});

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();
        signal = new StubVolatilitySignal(address(this), 0);

        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (uint160(0x4444) << 144));
        deployCodeTo("DynamicFeeHook.sol:DynamicFeeHook", abi.encode(manager, address(this), signal, params), hookAddr);
        hook = DynamicFeeHook(hookAddr);

        (key,) = initPoolAndAddLiquidity(currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);
    }

    function _swapOut() internal returns (int128) {
        BalanceDelta d = swap(key, true, -1e15, ZERO_BYTES); // exact input 1e15 token0
        return d.amount1();
    }

    function test_feeCurve() public view {
        assertEq(hook.feeForVolatility(0, params), 500);
        assertEq(hook.feeForVolatility(2000, params), 500);
        assertEq(hook.feeForVolatility(8500, params), 5250);
        assertEq(hook.feeForVolatility(15_000, params), 10_000);
        assertEq(hook.feeForVolatility(1e30, params), 10_000);
    }

    function test_volatileSwapPaysMore() public {
        uint256 snap = vm.snapshotState();
        signal.set(0);
        int128 calmOut = _swapOut();
        vm.revertToState(snap);
        signal.set(20_000);
        int128 volOut = _swapOut();
        assertGt(calmOut, volOut);
        // ~0.95% more fee on input -> output lower by roughly that
        // forge-lint: disable-next-line(unsafe-typecast)
        assertApproxEqRel(uint128(volOut), uint128(calmOut) * (1e6 - 10_000) / (1e6 - 500), 0.001e18);
    }

    function test_revertingSignalUsesFallback() public {
        hook.setSignal(IVolatilitySignal(address(new RevertingSignal())));
        (, uint24 fee, bool ok) = hook.currentFee();
        assertFalse(ok);
        assertEq(fee, 3000);
        _swapOut(); // swaps still work
    }

    function test_onlyOwnerCanInitialize() public {
        PoolKey memory k2 = key;
        k2.tickSpacing = 10;
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        manager.initialize(k2, SQRT_PRICE_1_1);
    }

    function test_secondPoolRejected() public {
        PoolKey memory k2 = key;
        k2.tickSpacing = 10;
        vm.expectRevert();
        manager.initialize(k2, SQRT_PRICE_1_1);
    }

    function test_adminGuards() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(DynamicFeeHook.NotOwner.selector);
        hook.setSignal(IVolatilitySignal(address(0)));

        DynamicFeeHook.FeeParams memory bad = params;
        bad.maxFee = 200_000;
        vm.expectRevert(DynamicFeeHook.InvalidFeeParams.selector);
        hook.setFeeParams(bad);
    }
}
