// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Vm} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolNestedActionsTest} from "@uniswap/v4-core/src/test/PoolNestedActionsTest.sol";

import {VolatilityFeeHook} from "../src/VolatilityFeeHook.sol";
import {IVolatilitySignal} from "../src/interfaces/IVolatilitySignal.sol";
import {StubVolatilitySignal} from "../src/mocks/StubVolatilitySignal.sol";

contract RevertingSignal is IVolatilitySignal {
    function volatility() external pure returns (uint256) {
        revert("down");
    }
}

contract GasHogSignal is IVolatilitySignal {
    function volatility() external view returns (uint256 x) {
        while (gasleft() > 100) x++;
    }
}

abstract contract HookTestBase is Deployers {
    bytes32 constant SWAP_EVENT = keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)");

    VolatilityFeeHook hook;
    StubVolatilitySignal signal;

    function _setUpHookAndPool() internal {
        deployMintAndApprove2Currencies();
        signal = new StubVolatilitySignal(address(this), 0);

        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (uint160(0xbeef) << 144));
        deployCodeTo(
            "VolatilityFeeHook.sol:VolatilityFeeHook",
            abi.encode(manager, address(this), signal, _config()),
            hookAddr
        );
        hook = VolatilityFeeHook(hookAddr);

        (key,) = initPool(currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);
        modifyLiquidityRouter.modifyLiquidity(key, LIQUIDITY_PARAMS, ZERO_BYTES);
    }

    function _config() internal pure returns (VolatilityFeeHook.FeeConfig memory) {
        return VolatilityFeeHook.FeeConfig({minFee: 500, maxFee: 10_000, lowVolatility: 2_000, highVolatility: 12_000});
    }

    /// Swaps and returns the fee the PoolManager reported in its Swap event.
    function _swapFee() internal returns (uint24 fee) {
        vm.recordLogs();
        swap(key, true, -1e15, ZERO_BYTES);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == SWAP_EVENT) {
                (,,,,, fee) = abi.decode(logs[i].data, (int128, int128, uint160, uint128, int24, uint24));
                return fee;
            }
        }
        revert("no Swap event");
    }

    function _checkFeeFollowsSignal() internal {
        signal.set(0);
        assertEq(_swapFee(), 500, "calm -> min fee");
        signal.set(50_000);
        assertEq(_swapFee(), 10_000, "volatile -> max fee");
        signal.set(7_000); // halfway between thresholds
        assertEq(_swapFee(), 5_250, "mid -> interpolated");
    }
}

contract VolatilityFeeHookTest is HookTestBase {
    function setUp() public {
        deployFreshManagerAndRouters();
        _setUpHookAndPool();
    }

    function test_feeFollowsSignal() public {
        _checkFeeFollowsSignal();
    }

    function test_ownerRetunesWithoutTouchingPool() public {
        signal.set(0);
        hook.setFeeConfig(VolatilityFeeHook.FeeConfig({minFee: 100, maxFee: 30_000, lowVolatility: 1, highVolatility: 2}));
        assertEq(_swapFee(), 100);

        StubVolatilitySignal next = new StubVolatilitySignal(address(this), 5);
        hook.setSignal(next);
        assertEq(_swapFee(), 30_000);
    }

    function test_brokenSignalChargesMaxFee() public {
        hook.setSignal(new RevertingSignal());
        assertEq(_swapFee(), 10_000);
        hook.setSignal(new GasHogSignal());
        assertEq(_swapFee(), 10_000);
        hook.setSignal(IVolatilitySignal(address(0xdead))); // no code
        assertEq(_swapFee(), 10_000);
    }

    function test_onlyOwnerAdmin() public {
        vm.startPrank(address(0xbad));
        vm.expectRevert(VolatilityFeeHook.NotOwner.selector);
        hook.setSignal(IVolatilitySignal(address(1)));
        vm.expectRevert(VolatilityFeeHook.NotOwner.selector);
        hook.setFeeConfig(_config());
        vm.stopPrank();
    }

    function test_rejectsBadConfig() public {
        VolatilityFeeHook.FeeConfig memory c = _config();
        c.maxFee = 50_001;
        vm.expectRevert(VolatilityFeeHook.InvalidFeeConfig.selector);
        hook.setFeeConfig(c);
        c = _config();
        c.minFee = c.maxFee + 1;
        vm.expectRevert(VolatilityFeeHook.InvalidFeeConfig.selector);
        hook.setFeeConfig(c);
        c = _config();
        c.lowVolatility = c.highVolatility;
        vm.expectRevert(VolatilityFeeHook.InvalidFeeConfig.selector);
        hook.setFeeConfig(c);
    }

    function test_onlyOneOwnerInitializedDynamicPool() public {
        PoolKey memory other = key;
        other.tickSpacing = 10;
        vm.expectRevert(); // second pool, even by owner
        manager.initialize(other, SQRT_PRICE_1_1);

        vm.prank(address(0xbad));
        vm.expectRevert(); // non-owner
        manager.initialize(other, SQRT_PRICE_1_1);
    }

    function test_hookCallbacksOnlyFromPoolManager() public {
        vm.expectRevert(VolatilityFeeHook.NotPoolManager.selector);
        hook.beforeSwap(address(this), key, SWAP_PARAMS, ZERO_BYTES);
    }

    function test_twoStepOwnership() public {
        hook.transferOwnership(address(0xa11ce));
        assertEq(hook.owner(), address(this));
        vm.prank(address(0xa11ce));
        hook.acceptOwnership();
        assertEq(hook.owner(), address(0xa11ce));
    }
}

/// Same flow against the live mainnet PoolManager. Skipped unless MAINNET_RPC_URL is set.
contract VolatilityFeeHookForkTest is HookTestBase {
    IPoolManager constant MAINNET_POOL_MANAGER = IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) vm.skip(true);
        vm.createSelectFork(rpc);
        manager = MAINNET_POOL_MANAGER;
        swapRouter = new PoolSwapTest(manager);
        modifyLiquidityRouter = new PoolModifyLiquidityTest(manager);
        nestedActionRouter = new PoolNestedActionsTest(manager); // only needed by Deployers' token approvals
        _setUpHookAndPool();
    }

    function test_fork_feeFollowsSignal() public {
        _checkFeeFollowsSignal();
    }
}
