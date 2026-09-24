// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {StubVolatilityOracle} from "../src/mocks/StubVolatilityOracle.sol";

contract RevertingOracle {
    function volatility(PoolKey calldata) external pure returns (uint256) {
        revert("boom");
    }
}

contract DynamicFeeHookTest is Test, Deployers {
    DynamicFeeHook hook;
    StubVolatilityOracle oracle;
    DynamicFeeHook.FeeConfig cfg =
        DynamicFeeHook.FeeConfig({minFee: 500, maxFee: 10_000, fallbackFee: 3000, lowVol: 2000, highVol: 10_000});

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        oracle = new StubVolatilityOracle(address(this), 0);
        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (1 << 144));
        deployCodeTo("DynamicFeeHook.sol", abi.encode(manager, address(this), oracle, cfg), hookAddr);
        hook = DynamicFeeHook(hookAddr);

        (key,) = initPoolAndAddLiquidity(
            currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1
        );
    }

    function _out(uint256 vol) internal returns (int128) {
        oracle.setVolatility(vol);
        BalanceDelta d = swap(key, true, -1e15, ZERO_BYTES);
        return d.amount1();
    }

    function test_feeMapping() public view {
        assertEq(hook.feeForVolatility(cfg, 0), 500);
        assertEq(hook.feeForVolatility(cfg, 6000), 5250);
        assertEq(hook.feeForVolatility(cfg, 50_000), 10_000);
    }

    function test_higherVolatilityChargesMore() public {
        int128 calmOut = _out(0);
        int128 volatileOut = _out(20_000);
        assertGt(calmOut, volatileOut);
    }

    function test_oracleRevertUsesFallback() public {
        hook.setOracle(IVolatilityOracle(address(new RevertingOracle())));
        assertEq(hook.currentFee(key), 3000);
        swap(key, true, -1e15, ZERO_BYTES); // swaps keep working
    }

    function test_rejectsStaticFeePool() public {
        vm.expectRevert();
        initPool(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
    }

    function test_onlyOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(DynamicFeeHook.NotOwner.selector);
        hook.setFeeConfig(cfg);
    }
}
