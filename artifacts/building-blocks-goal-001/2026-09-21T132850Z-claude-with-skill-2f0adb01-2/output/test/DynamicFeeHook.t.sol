// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {TestERC20} from "@uniswap/v4-core/src/test/TestERC20.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {StubVolatilityOracle} from "../src/StubVolatilityOracle.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {HookMiner} from "../script/HookMiner.sol";

contract RevertingOracle {
    function getVolatility(bytes32) external pure returns (uint256, uint256) {
        revert("down");
    }
}

contract DynamicFeeHookTest is Test {
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    bytes32 constant SWAP_SIG = keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)");

    PoolManager manager;
    PoolSwapTest swapRouter;
    PoolModifyLiquidityTest lpRouter;
    StubVolatilityOracle oracle;
    DynamicFeeHook hook;
    PoolKey key;

    function setUp() public {
        manager = new PoolManager(address(this));
        swapRouter = new PoolSwapTest(manager);
        lpRouter = new PoolModifyLiquidityTest(manager);
        oracle = new StubVolatilityOracle(address(this), 0);

        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (uint160(0x4444) << 144));
        deployCodeTo(
            "DynamicFeeHook.sol:DynamicFeeHook",
            abi.encode(manager, address(this), IVolatilityOracle(address(oracle)), _config()),
            hookAddr
        );
        hook = DynamicFeeHook(hookAddr);

        TestERC20 a = new TestERC20(type(uint128).max);
        TestERC20 b = new TestERC20(type(uint128).max);
        (a, b) = address(a) < address(b) ? (a, b) : (b, a);
        a.approve(address(swapRouter), type(uint256).max);
        b.approve(address(swapRouter), type(uint256).max);
        a.approve(address(lpRouter), type(uint256).max);
        b.approve(address(lpRouter), type(uint256).max);

        key = PoolKey(Currency.wrap(address(a)), Currency.wrap(address(b)), LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, hook);
        manager.initialize(key, SQRT_PRICE_1_1);
        lpRouter.modifyLiquidity(key, ModifyLiquidityParams(-600, 600, 100e18, 0), "");
    }

    function _config() internal pure returns (DynamicFeeHook.FeeConfig memory) {
        return DynamicFeeHook.FeeConfig({
            minFee: 500, maxFee: 10_000, fallbackFee: 10_000, maxStaleness: 1 hours, volLow: 3_000, volHigh: 15_000
        });
    }

    /// @dev swaps and returns the fee PoolManager actually charged (from Swap event)
    function _swapFee() internal returns (uint24 fee) {
        vm.recordLogs();
        swapRouter.swap(
            key,
            SwapParams(true, -1e15, TickMath.MIN_SQRT_PRICE + 1),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == SWAP_SIG) {
                (,,,,, fee) = abi.decode(logs[i].data, (int128, int128, uint160, uint128, int24, uint24));
                return fee;
            }
        }
        revert("no Swap event");
    }

    function test_calmUsesMinFee() public {
        oracle.setVolatility(1_000);
        assertEq(_swapFee(), 500);
    }

    function test_volatileUsesMaxFee() public {
        oracle.setVolatility(20_000);
        assertEq(_swapFee(), 10_000);
    }

    function test_interpolatesBetween() public {
        oracle.setVolatility(9_000); // midpoint of [3000, 15000]
        assertEq(_swapFee(), 5_250);
    }

    function test_feeTracksSignalSwapToSwap() public {
        oracle.setVolatility(1_000);
        assertEq(_swapFee(), 500);
        oracle.setVolatility(20_000);
        assertEq(_swapFee(), 10_000);
    }

    function test_staleOracleUsesFallback() public {
        oracle.setVolatility(1_000);
        vm.warp(block.timestamp + 1 hours + 1);
        assertEq(_swapFee(), 10_000);
    }

    function test_revertingOracleUsesFallback() public {
        hook.setOracle(IVolatilityOracle(address(new RevertingOracle())));
        assertEq(_swapFee(), 10_000);
    }

    function test_unsetOracleUsesFallback() public {
        hook.setOracle(IVolatilityOracle(address(0)));
        assertEq(_swapFee(), 10_000);
    }

    function test_swapOracleWithoutMigration() public {
        StubVolatilityOracle next = new StubVolatilityOracle(address(this), 20_000);
        hook.setOracle(IVolatilityOracle(address(next)));
        assertEq(_swapFee(), 10_000);
    }

    function test_nonOwnerCannotInitPool() public {
        PoolKey memory k = key;
        k.tickSpacing = 10;
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        manager.initialize(k, SQRT_PRICE_1_1);
    }

    function test_staticFeePoolRejected() public {
        PoolKey memory k = key;
        k.fee = 3000;
        vm.expectRevert();
        manager.initialize(k, SQRT_PRICE_1_1);
    }

    function test_onlyOwnerAdmin() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(DynamicFeeHook.NotOwner.selector);
        hook.setOracle(IVolatilityOracle(address(0)));
    }

    function test_rejectsBadConfig() public {
        DynamicFeeHook.FeeConfig memory c = _config();
        c.maxFee = 200_000; // > 10% cap
        vm.expectRevert(DynamicFeeHook.InvalidFeeConfig.selector);
        hook.setFeeConfig(c);
    }

    function test_onlyPoolManagerCallsHook() public {
        vm.expectRevert(DynamicFeeHook.NotPoolManager.selector);
        hook.beforeSwap(address(this), key, SwapParams(true, -1, 0), "");
    }

    function test_minedSaltDeploysValidHook() public {
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args = abi.encode(manager, address(this), IVolatilityOracle(address(oracle)), _config());
        (address expected, bytes32 salt) =
            HookMiner.find(address(this), flags, type(DynamicFeeHook).creationCode, args);
        DynamicFeeHook h =
            new DynamicFeeHook{salt: salt}(manager, address(this), IVolatilityOracle(address(oracle)), _config());
        assertEq(address(h), expected);
    }

    function testFuzz_feeWithinBand(uint256 vol) public view {
        uint24 fee = hook.feeForVolatility(vol, _config());
        assertGe(fee, 500);
        assertLe(fee, 10_000);
    }
}
