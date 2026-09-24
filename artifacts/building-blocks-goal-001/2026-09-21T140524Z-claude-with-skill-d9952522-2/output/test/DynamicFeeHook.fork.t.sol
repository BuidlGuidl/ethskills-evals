// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {PoolNestedActionsTest} from "v4-core/test/PoolNestedActionsTest.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {HookMiner} from "v4-periphery/test/shared/HookMiner.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {StubVolatilitySignal} from "../src/StubVolatilitySignal.sol";

/// @notice Runs against the live mainnet PoolManager. Skipped unless MAINNET_RPC_URL is set.
contract DynamicFeeHookForkTest is Deployers {
    address constant POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;

    function test_fork_dynamicFeeOnLivePoolManager() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);

        manager = IPoolManager(POOL_MANAGER);
        swapRouter = new PoolSwapTest(manager);
        modifyLiquidityRouter = new PoolModifyLiquidityTest(manager);
        nestedActionRouter = new PoolNestedActionsTest(manager); // Deployers' approve loop needs it
        deployMintAndApprove2Currencies();

        StubVolatilitySignal signal = new StubVolatilitySignal(address(this), 0);
        DynamicFeeHook.FeeParams memory p =
            DynamicFeeHook.FeeParams({minFee: 500, maxFee: 10_000, fallbackFee: 3000, lowVol: 2000, highVol: 15_000});
        bytes memory args = abi.encode(manager, address(this), signal, p);
        (address expected, bytes32 salt) = HookMiner.find(
            address(this), uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG), type(DynamicFeeHook).creationCode, args
        );
        DynamicFeeHook hook = new DynamicFeeHook{salt: salt}(manager, address(this), signal, p);
        assertEq(address(hook), expected);

        (key,) = initPoolAndAddLiquidity(currency0, currency1, IHooks(address(hook)), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);

        uint256 snap = vm.snapshotState();
        BalanceDelta calm = swap(key, true, -1e15, ZERO_BYTES);
        vm.revertToState(snap);
        signal.set(20_000);
        BalanceDelta vol = swap(key, true, -1e15, ZERO_BYTES);
        assertGt(calm.amount1(), vol.amount1());
    }
}
