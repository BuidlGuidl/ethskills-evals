// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BatchTransfer, IERC20} from "../src/BatchTransfer.sol";

/// Real-world gas measurement against a fork of Base mainnet using real USDC.
/// Run: forge test --match-contract ForkGasTest --fork-url https://mainnet.base.org -vvv
///
/// forge gasleft() measures execution gas only; we add the 21,000 intrinsic
/// and 16 gas/calldata byte to get full on-chain L2 gas.
interface IUSDC is IERC20 {
    function balanceOf(address) external view returns (uint256);
}

contract ForkGasTest is Test {
    IUSDC constant USDC = IUSDC(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    uint256 constant N = 50;
    uint256 constant INTRINSIC = 21_000;
    uint256 constant AMOUNT = 25e6; // 25 USDC

    BatchTransfer batch;
    address relayer = makeAddr("relayer");
    address[] recipients;
    bytes packedEntries;

    // Large USDC holder on Base (Coinbase), used to fund accounts on the fork.
    address constant WHALE = 0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A;

    function setUp() public {
        batch = new BatchTransfer();
        vm.startPrank(WHALE);
        for (uint256 i; i < N; ++i) {
            // Pre-warmed recipients (already hold USDC) = steady-state cost.
            address r = makeAddr(string.concat("r", vm.toString(i)));
            recipients.push(r);
            USDC.transfer(r, 1);
            packedEntries = bytes.concat(packedEntries, abi.encodePacked(r, uint96(AMOUNT)));
        }
        USDC.transfer(relayer, AMOUNT * N);
        USDC.transfer(address(batch), AMOUNT * N);
        vm.stopPrank();
        // Fork mode charges the pranked sender the block base fee; fund for gas.
        vm.deal(relayer, 10 ether);
    }

    function _calldataGas(uint256 bytesLen) internal pure returns (uint256) {
        return bytesLen * 16; // upper bound: assumes all non-zero bytes
    }

    function test_fork_gas_comparison() public {
        // --- Today: 50 individual transfer txs from the relayer EOA ---
        uint256 exec;
        for (uint256 i; i < N; ++i) {
            vm.startPrank(relayer);
            uint256 g = gasleft();
            USDC.transfer(recipients[i], AMOUNT);
            exec += g - gasleft();
            vm.stopPrank();
        }
        // calldata per standalone transfer tx: 4 selector + 32 addr + 32 amount = 68 bytes
        uint256 standaloneTotal = exec + N * (INTRINSIC + _calldataGas(68));
        console2.log("standalone 50 txs : total L2 gas =", standaloneTotal);
        console2.log("standalone        : per transfer =", standaloneTotal / N);

        // --- Batched: 1 tx, packed calldata (32 bytes/entry) ---
        uint256 g = gasleft();
        batch.batchTransferPacked(USDC, packedEntries);
        uint256 batchExec = g - gasleft();
        // calldata: 4 selector + 32 token + 32 offset + 32 length + 32*N entries
        uint256 batchTotal = batchExec + INTRINSIC + _calldataGas(100 + 32 * N);
        console2.log("batch packed 1 tx : total L2 gas =", batchTotal);
        console2.log("batch packed      : per transfer =", batchTotal / N);
        console2.log("L2 gas saving (%):", (standaloneTotal - batchTotal) * 100 / standaloneTotal);

        for (uint256 i; i < N; ++i) {
            assertEq(USDC.balanceOf(recipients[i]), AMOUNT * 2 + 1);
        }
    }
}
