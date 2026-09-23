// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BatchTransfer, IERC20} from "../src/BatchTransfer.sol";

/// @notice Measures the gas cost of a batched payout against real USDC state on
///         a Base fork. Every batching number in PLAN.md comes from here.
///
///   forge test --match-contract GasBenchmark --fork-url $BASE_RPC_URL -vv
///
/// Method note: a forge test harness adds a fixed ~25k of overhead versus a real
/// EOA transaction (the test contract's own dispatch, a cold CALL into USDC that
/// a real tx gets pre-warmed by EIP-2929, etc). That overhead is a constant, so
/// we report the *marginal* gas per additional recipient - the slope between two
/// batch sizes - which cancels it out exactly. Baseline single-transfer costs are
/// taken from real mainnet receipts instead (see scripts/sample-onchain-cost.mjs).
///
/// The dominant variable is whether the recipient already holds the token:
/// a zero -> non-zero balance write is a 20,000 gas SSTORE, a non-zero -> non-zero
/// write is 2,900. So we measure both populations separately.
contract GasBenchmarkTest is Test {
    IERC20 constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    address constant USDC_ADDR = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    address relayer = address(0xBEEF);
    BatchTransfer batcher;

    uint256 constant AMOUNT = 5_000_000; // 5 USDC

    function setUp() public {
        batcher = new BatchTransfer(relayer);
        deal(USDC_ADDR, relayer, 1_000_000_000e6);
        vm.prank(relayer);
        (bool ok,) = USDC_ADDR.call(
            abi.encodeWithSignature("approve(address,uint256)", address(batcher), type(uint256).max)
        );
        require(ok, "approve failed");
    }

    function _recipients(uint256 n, uint256 salt) internal pure returns (address[] memory r) {
        r = new address[](n);
        for (uint256 i; i < n; ++i) {
            r[i] = address(uint160(uint256(keccak256(abi.encode(salt, i)))));
        }
    }

    /// Run one batch and return total tx-equivalent gas (execution + intrinsic +
    /// calldata), so the slope between sizes is a real per-payout cost.
    function _runBatch(uint256 n, uint256 salt, bool prefund) internal returns (uint256) {
        address[] memory r = _recipients(n, salt);
        uint256[] memory a = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            a[i] = AMOUNT;
            // Give the recipient an existing balance, modelling a repeat payee.
            if (prefund) deal(USDC_ADDR, r[i], 1e6);
        }

        vm.prank(relayer);
        uint256 g0 = gasleft();
        batcher.batchTransfer(USDC, r, a);
        uint256 exec = g0 - gasleft();

        // batchTransfer calldata: 4 selector bytes + 3 head words + 2 length
        // words + 2 words per recipient. Addresses/amounts are mostly zero bytes
        // in this synthetic set, so charge the conservative non-zero rate of 16.
        uint256 calldataGas = (4 + 32 * (5 + 2 * n)) * 16;
        return exec + 21000 + calldataGas;
    }

    /// Marginal gas per payout for recipients who have never held the token.
    function test_MarginalGas_NewRecipients() public {
        uint256 g25 = _runBatch(25, 1001, false);
        uint256 g75 = _runBatch(75, 1002, false);
        console.log("NEW recipients");
        console.log("  batch 25 total gas    :", g25);
        console.log("  batch 75 total gas    :", g75);
        console.log("  marginal gas / payout :", (g75 - g25) / 50);
        console.log("  fixed overhead / batch:", g25 - 25 * ((g75 - g25) / 50));
    }

    /// Marginal gas per payout for recipients who already hold the token.
    /// This is the population that matters for a recurring payments app.
    function test_MarginalGas_ExistingRecipients() public {
        uint256 g25 = _runBatch(25, 2001, true);
        uint256 g75 = _runBatch(75, 2002, true);
        console.log("EXISTING recipients");
        console.log("  batch 25 total gas    :", g25);
        console.log("  batch 75 total gas    :", g75);
        console.log("  marginal gas / payout :", (g75 - g25) / 50);
        console.log("  fixed overhead / batch:", g25 - 25 * ((g75 - g25) / 50));
    }

    /// The uniform-amount variant drops one calldata word per recipient.
    function test_MarginalGas_SameAmountVariant() public {
        uint256[2] memory sizes = [uint256(25), uint256(75)];
        uint256[2] memory totals;
        for (uint256 s; s < 2; ++s) {
            uint256 n = sizes[s];
            address[] memory r = _recipients(n, 3001 + s);
            for (uint256 i; i < n; ++i) deal(USDC_ADDR, r[i], 1e6);
            vm.prank(relayer);
            uint256 g0 = gasleft();
            batcher.batchTransferSameAmount(USDC, r, AMOUNT);
            uint256 exec = g0 - gasleft();
            totals[s] = exec + 21000 + (4 + 32 * (4 + n)) * 16;
        }
        console.log("EXISTING recipients, uniform amount");
        console.log("  marginal gas / payout :", (totals[1] - totals[0]) / 50);
    }

    /// Guard: the batch must revert as a unit if any single leg fails, so a bad
    /// payout can never leave a partially-applied run to reconcile.
    function test_RevertsAtomically() public {
        address[] memory r = _recipients(3, 9001);
        uint256[] memory a = new uint256[](3);
        a[0] = AMOUNT;
        a[1] = type(uint256).max; // more than the relayer holds
        a[2] = AMOUNT;
        vm.prank(relayer);
        vm.expectRevert();
        batcher.batchTransfer(USDC, r, a);
    }

    /// Guard: only the configured relayer can move the payer's allowance.
    function test_OnlyRelayer() public {
        address[] memory r = _recipients(1, 9002);
        uint256[] memory a = new uint256[](1);
        a[0] = AMOUNT;
        vm.prank(address(0xDEAD));
        vm.expectRevert(BatchTransfer.NotRelayer.selector);
        batcher.batchTransfer(USDC, r, a);
    }
}
