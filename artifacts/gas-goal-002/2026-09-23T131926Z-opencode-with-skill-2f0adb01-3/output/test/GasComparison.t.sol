// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BatchPayments} from "../contracts/BatchPayments.sol";
import {MockERC20} from "../contracts/mocks/MockERC20.sol";

interface Vm {
    function writeFile(string calldata path, string calldata data) external;
}

/// Measures the L2 execution gas of 20 individual ERC-20 transfers vs one
/// batched transfer of 20 payments. Recipients are fresh addresses in both
/// cases (cold storage — the realistic, conservative case for a payments app).
///
/// gasleft() deltas exclude intrinsic gas, so the test adds it explicitly:
///   - individual tx: 21,000 + ~700 calldata gas per tx
///   - batch tx:      21,000 + ~9,500 calldata gas once (≈1.3 KB calldata)
contract GasComparisonTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 constant N = 20;
    uint256 constant AMOUNT = 50e6; // 50 USDC-style

    // Intrinsic gas: 21,000 base + calldata (4 gas/zero byte, 16 gas/nonzero).
    uint256 constant INDIVIDUAL_INTRINSIC = 21_700; // ~68-byte calldata, mostly zero
    uint256 constant BATCH_INTRINSIC = 30_500; // ~1.3 KB calldata, mixed

    function testGasComparison() external {
        MockERC20 token = new MockERC20("USD Coin", "USDC");
        BatchPayments batch = new BatchPayments();

        address[] memory recipients = new address[](N);
        uint256[] memory amounts = new uint256[](N);
        for (uint256 i = 0; i < N; ++i) {
            recipients[i] = address(uint160(0xBEEF0000 + i));
            amounts[i] = AMOUNT;
        }

        token.mint(address(this), AMOUNT * N);
        token.mint(address(batch), AMOUNT * N);

        // --- individual transfers (what the relayer does today) ---
        uint256 individualTotal = 0;
        for (uint256 i = 0; i < N; ++i) {
            uint256 g0 = gasleft();
            token.transfer(recipients[i], amounts[i]);
            individualTotal += (g0 - gasleft()) + INDIVIDUAL_INTRINSIC;
        }

        // --- batched transfer ---
        uint256 g1 = gasleft();
        batch.batchTransfer(address(token), recipients, amounts);
        uint256 batchTotal = (g1 - gasleft()) + BATCH_INTRINSIC;

        string memory out = string.concat(
            "individual_total=", _u2s(individualTotal),
            "\nindividual_per_payment=", _u2s(individualTotal / N),
            "\nbatch_total=", _u2s(batchTotal),
            "\nbatch_per_payment=", _u2s(batchTotal / N),
            "\nsavings_pct=", _u2s((individualTotal - batchTotal) * 100 / individualTotal),
            "\n"
        );
        vm.writeFile("out/gas-results.txt", out);
    }

    function _u2s(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) ++len;
        bytes memory b = new bytes(len);
        while (v != 0) {
            b[--len] = bytes1(uint8(48 + v % 10));
            v /= 10;
        }
        return string(b);
    }
}
