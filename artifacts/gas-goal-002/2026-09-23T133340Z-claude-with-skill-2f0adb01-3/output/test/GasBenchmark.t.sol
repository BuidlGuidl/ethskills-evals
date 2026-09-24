// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BatchPay} from "../src/BatchPay.sol";

interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// Measures what a payout actually costs on Base, one transfer at a time versus
/// batched. Runs against a Base fork so the numbers come from the real USDC
/// contract rather than a mock — USDC sits behind a proxy and packs its balance
/// with a blacklist flag, both of which move the result.
///
/// Gas accounting note: a `gasleft()` delta around a `vm.prank`ed top-level call
/// already includes the 21,000 intrinsic charge and the calldata charge, so
/// those must NOT be added back by hand. `test_BaselineMatchesObservedOnchainGas`
/// pins this to real Base receipts so the assumption cannot rot silently.
contract GasBenchmarkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// Pinned so the fork cache is reusable and results are reproducible.
    uint256 constant FORK_BLOCK = 51690700;

    BatchPay batcher;
    address funder = makeAddr("funder");
    address relayer = makeAddr("relayer");

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_RPC_URL"), FORK_BLOCK);
        batcher = new BatchPay(USDC, funder, address(this));
        batcher.setRelayer(relayer, true);

        deal(USDC, funder, 100_000_000e6);
        vm.prank(funder);
        IERC20(USDC).approve(address(batcher), type(uint256).max);
    }

    function _recipients(uint256 n, uint256 salt) internal pure returns (address[] memory a) {
        a = new address[](n);
        for (uint256 i = 0; i < n; ++i) {
            a[i] = address(uint160(uint256(keccak256(abi.encode(salt, i)))));
        }
    }

    /// Baseline: what the relayer does today — one signed transaction per payment.
    /// `warm == true` pre-funds recipients so their balance slot is already
    /// non-zero, which is the difference between a 20k and a ~2.9k SSTORE.
    function _measureIndividual(uint256 n, bool warm, uint256 salt)
        internal
        returns (uint256 totalGas)
    {
        address[] memory to = _recipients(n, salt);
        if (warm) {
            for (uint256 i = 0; i < n; ++i) {
                deal(USDC, to[i], 1e6);
            }
        }
        for (uint256 i = 0; i < n; ++i) {
            vm.prank(funder);
            uint256 before = gasleft();
            IERC20(USDC).transfer(to[i], 1e6);
            totalGas += before - gasleft();
        }
    }

    /// Batched: one signed transaction carrying n packed payments.
    function _measureBatch(uint256 n, bool warm, uint256 salt)
        internal
        returns (uint256 totalGas, uint256 calldataBytes)
    {
        address[] memory to = _recipients(n, salt);
        if (warm) {
            for (uint256 i = 0; i < n; ++i) {
                deal(USDC, to[i], 1e6);
            }
        }

        bytes memory packed = new bytes(n * 32);
        for (uint256 i = 0; i < n; ++i) {
            bytes32 w = bytes32((uint256(uint160(to[i])) << 96) | uint256(1e6));
            assembly {
                mstore(add(add(packed, 32), mul(i, 32)), w)
            }
        }
        calldataBytes = abi.encodeCall(BatchPay.pay, (packed)).length;

        vm.prank(relayer);
        uint256 before = gasleft();
        batcher.pay(packed);
        totalGas = before - gasleft();
    }

    /// Pins the baseline to reality. Observed on Base 2026-09-23: a USDC
    /// transfer receipt reported 45,047 gasUsed, and `eth_estimateGas` on a live
    /// node returned 45,223 (existing holder) / 45,439 (fresh recipient).
    /// If this test starts failing, every savings number below is suspect.
    function test_BaselineMatchesObservedOnchainGas() public {
        uint256 warmGas = _measureIndividual(1, true, 1);
        uint256 coldGas = _measureIndividual(1, false, 2);
        console2.log("single transfer, recipient already holds USDC :", warmGas);
        console2.log("single transfer, recipient balance starts zero :", coldGas);

        // On-chain observations on 2026-09-23 spanned 40,271 (receipt) to 45,439
        // (estimateGas, fresh recipient); fork measurement sits just above that
        // band because every account in the test starts cold. Assert the order
        // of magnitude, not a false-precision point value.
        assertGt(warmGas, 38_000, "warm baseline implausibly low");
        assertLt(warmGas, 52_000, "warm baseline drifted above observed on-chain range");
        assertGt(coldGas, warmGas, "cold recipient should cost more than warm");
    }

    function test_BatchVsIndividual_50() public {
        _report(50);
    }

    function test_BatchVsIndividual_100() public {
        _report(100);
    }

    function test_BatchVsIndividual_250() public {
        _report(250);
    }

    function test_BatchVsIndividual_500() public {
        _report(500);
    }

    /// Marginal cost of one extra payment inside an already-large batch. This is
    /// the number that decides the ceiling on batching savings: it is the part
    /// that does not amortise away no matter how big the batch gets.
    function test_MarginalCostPerPaymentInBatch() public {
        (uint256 g200,) = _measureBatch(200, true, 901);
        (uint256 g400,) = _measureBatch(400, true, 902);
        console2.log("batch 200 gas", g200);
        console2.log("batch 400 gas", g400);
        console2.log("marginal gas per extra payment", (g400 - g200) / 200);
    }

    function _report(uint256 n) internal {
        uint256 indivWarm = _measureIndividual(n, true, 100 + n);
        (uint256 batchWarm, uint256 cdBytes) = _measureBatch(n, true, 200 + n);
        uint256 indivCold = _measureIndividual(n, false, 300 + n);
        (uint256 batchCold,) = _measureBatch(n, false, 400 + n);

        console2.log("=== batch size ===", n);
        console2.log("warm: individual total gas   ", indivWarm);
        console2.log("warm: batched total gas      ", batchWarm);
        console2.log("warm: pct gas saved          ", 100 - (batchWarm * 100) / indivWarm);
        console2.log("warm: per-payment individual ", indivWarm / n);
        console2.log("warm: per-payment batched    ", batchWarm / n);
        console2.log("cold: individual total gas   ", indivCold);
        console2.log("cold: batched total gas      ", batchCold);
        console2.log("cold: pct gas saved          ", 100 - (batchCold * 100) / indivCold);
        console2.log("cold: per-payment individual ", indivCold / n);
        console2.log("cold: per-payment batched    ", batchCold / n);
        console2.log("batch tx calldata bytes      ", cdBytes);

        assertLt(batchWarm, indivWarm, "batching should beat individual transfers");
    }
}
