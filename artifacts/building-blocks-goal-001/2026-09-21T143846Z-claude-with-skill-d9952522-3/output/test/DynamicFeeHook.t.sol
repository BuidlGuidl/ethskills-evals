// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

contract RevertingOracle {
    function getVolatility(bytes32) external pure returns (uint256) {
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
        DynamicFeeHook.FeeConfig memory cfg =
            DynamicFeeHook.FeeConfig({minFee: 500, maxFee: 10_000, fallbackFee: 3000, volLow: 2000, volHigh: 15_000});

        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (1 << 150));
        deployCodeTo(
            "DynamicFeeHook.sol:DynamicFeeHook",
            abi.encode(manager, currency0, currency1, int24(60), address(this), oracle, cfg),
            hookAddr
        );
        hook = DynamicFeeHook(hookAddr);

        (key,) = initPoolAndAddLiquidity(
            currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1
        );
    }

    function _swapIn(uint256 amountIn) internal returns (uint256 out) {
        BalanceDelta d = swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(amountIn), sqrtPriceLimitX96: MIN_PRICE_LIMIT}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
        out = uint256(int256(d.amount1()));
    }

    function test_feeRisesWithVolatility() public {
        uint256 snap = vm.snapshotState();
        oracle.setVolatility(0); // calm -> 0.05%
        assertEq(hook.currentFee(key.toId()), 500);
        uint256 calmOut = _swapIn(1e15);

        vm.revertToState(snap);
        oracle.setVolatility(20_000); // volatile -> 1%
        assertEq(hook.currentFee(key.toId()), 10_000);
        uint256 volOut = _swapIn(1e15);

        assertLt(volOut, calmOut);
    }

    function test_interpolates() public {
        oracle.setVolatility(8500); // midpoint of 2000..15000
        assertEq(hook.currentFee(key.toId()), 5250);
    }

    function test_brokenOracleFallsBack() public {
        hook.setOracle(ManualVolatilityOracle(address(new RevertingOracle())));
        assertEq(hook.currentFee(key.toId()), 3000);
        _swapIn(1e15); // swaps still work
    }

    function test_rejectsStaticFeePool() public {
        vm.expectRevert();
        initPool(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
    }

    function test_onlyOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(DynamicFeeHook.NotOwner.selector);
        hook.setOracle(oracle);
    }
}
