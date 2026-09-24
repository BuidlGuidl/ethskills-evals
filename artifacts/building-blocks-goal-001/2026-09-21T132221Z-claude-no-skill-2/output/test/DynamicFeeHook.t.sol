// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

contract RevertingOracle is IVolatilityOracle {
    function volatilityScore(PoolKey calldata) external pure returns (uint256) {
        revert("boom");
    }
}

contract DynamicFeeHookTest is Test, Deployers {
    DynamicFeeHook hook;
    ManualVolatilityOracle oracle;

    uint24 constant MIN_FEE = 500;
    uint24 constant MAX_FEE = 10_000;
    uint24 constant FALLBACK_FEE = 3_000;

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        oracle = new ManualVolatilityOracle(address(this), 0);
        address hookAddr = address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (uint160(0x4444) << 144));
        deployCodeTo(
            "DynamicFeeHook.sol:DynamicFeeHook",
            abi.encode(manager, address(this), IVolatilityOracle(address(oracle)), MIN_FEE, MAX_FEE, FALLBACK_FEE),
            hookAddr
        );
        hook = DynamicFeeHook(hookAddr);

        (key,) = initPoolAndAddLiquidity(currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);
    }

    function _swapOut() internal returns (uint256) {
        uint256 snap = vm.snapshotState();
        BalanceDelta d = swap(key, true, -1e15, ZERO_BYTES); // exact in 0.001 token0
        vm.revertToState(snap);
        return uint128(d.amount1());
    }

    function _expectedOut(uint24 fee) internal pure returns (uint256) {
        return 1e15 * (1e6 - uint256(fee)) / 1e6;
    }

    function test_feeFollowsScore() public {
        assertEq(hook.currentFee(key), MIN_FEE);
        uint256 calmOut = _swapOut();

        oracle.setScore(0.5e18);
        assertEq(hook.currentFee(key), MIN_FEE + (MAX_FEE - MIN_FEE) / 2);
        uint256 midOut = _swapOut();

        oracle.setScore(1e18);
        assertEq(hook.currentFee(key), MAX_FEE);
        uint256 volOut = _swapOut();

        assertGt(calmOut, midOut);
        assertGt(midOut, volOut);
        // ~1% fee on a tiny swap at 1:1 price
        assertApproxEqRel(volOut, _expectedOut(MAX_FEE), 0.001e18);
        assertApproxEqRel(calmOut, _expectedOut(MIN_FEE), 0.001e18);
    }

    function test_brokenOracleUsesFallback() public {
        hook.setOracle(new RevertingOracle());
        assertEq(hook.currentFee(key), FALLBACK_FEE);
        assertApproxEqRel(_swapOut(), _expectedOut(FALLBACK_FEE), 0.001e18);
    }

    function test_swapOracleWithoutRedeploy() public {
        ManualVolatilityOracle next = new ManualVolatilityOracle(address(this), 1e18);
        hook.setOracle(next);
        assertEq(hook.currentFee(key), MAX_FEE);
    }

    function test_rejectsStaticFeePool() public {
        vm.expectRevert();
        initPool(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
    }

    function test_onlyOwnerAdmin() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(DynamicFeeHook.NotOwner.selector);
        hook.setFees(0, 0, 0);

        vm.expectRevert(DynamicFeeHook.InvalidFees.selector);
        hook.setFees(0, 100_001, 0);
    }

    function test_onlyPoolManagerCallsHook() public {
        vm.expectRevert(DynamicFeeHook.NotPoolManager.selector);
        hook.beforeInitialize(address(this), key, SQRT_PRICE_1_1);
    }
}
