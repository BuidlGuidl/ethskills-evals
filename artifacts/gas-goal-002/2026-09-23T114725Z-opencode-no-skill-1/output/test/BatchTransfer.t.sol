// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BatchTransfer, IERC20} from "../src/BatchTransfer.sol";
import {MockERC20} from "../src/test/MockERC20.sol";

/// Gas comparison: 50 payments, one-per-tx (today's setup) vs one batched tx.
/// forge measures execution gas only; we add the 21,000 intrinsic per tx manually.
contract BatchTransferGasTest is Test {
    uint256 constant N = 50;
    uint256 constant INTRINSIC = 21_000;
    uint256 constant AMOUNT = 25e6; // 25 USDC

    MockERC20 token;
    BatchTransfer batch;
    address relayer = address(0xE1A7e);
    address[] recipients;

    function setUp() public {
        token = new MockERC20();
        batch = new BatchTransfer();
        for (uint256 i; i < N; ++i) {
            // Deterministic distinct addresses, pre-warmed with a balance so
            // transfers hit the steady-state (nonzero -> nonzero) SSTORE cost.
            address r = address(uint160(uint256(keccak256(abi.encodePacked("recipient", i)))));
            recipients.push(r);
            token.mint(r, 1);
        }
        token.mint(relayer, AMOUNT * N * 10);
    }

    function _amounts() internal pure returns (uint256[] memory a) {
        a = new uint256[](N);
        for (uint256 i; i < N; ++i) a[i] = AMOUNT;
    }

    function _packed() internal view returns (bytes memory e) {
        e = new bytes(N * 32);
        for (uint256 i; i < N; ++i) {
            bytes20 addr = bytes20(recipients[i]);
            bytes12 amt = bytes12(uint96(AMOUNT));
            for (uint256 j; j < 20; ++j) e[i * 32 + j] = addr[j];
            for (uint256 j; j < 12; ++j) e[i * 32 + 20 + j] = amt[j];
        }
    }

    function test_gas_standalone_vs_batch() public {
        // --- Baseline: 50 individual transfer txs from the relayer EOA ---
        uint256 execGas;
        for (uint256 i; i < N; ++i) {
            vm.prank(relayer);
            uint256 g = gasleft();
            token.transfer(recipients[i], AMOUNT);
            execGas += g - gasleft();
        }
        uint256 standaloneTotal = execGas + N * INTRINSIC;
        console2.log("standalone: total gas for 50 txs      :", standaloneTotal);
        console2.log("standalone: gas per transfer          :", standaloneTotal / N);

        // Reset relayer funds for the batch runs.
        token.mint(address(batch), AMOUNT * N * 3);

        // --- ABI-array batch: 1 tx ---
        uint256 g = gasleft();
        batch.batchTransfer(IERC20(address(token)), recipients, _amounts());
        uint256 abiTotal = g - gasleft() + INTRINSIC;
        console2.log("batch ABI arrays: total gas for 1 tx  :", abiTotal);
        console2.log("batch ABI arrays: gas per transfer    :", abiTotal / N);

        // --- Packed-calldata batch: 1 tx ---
        g = gasleft();
        batch.batchTransferPacked(IERC20(address(token)), _packed());
        uint256 packedTotal = g - gasleft() + INTRINSIC;
        console2.log("batch packed: total gas for 1 tx      :", packedTotal);
        console2.log("batch packed: gas per transfer        :", packedTotal / N);

        console2.log("L2 execution saving vs standalone (%):",
            (standaloneTotal - packedTotal) * 100 / standaloneTotal);
    }

    function test_batchTransfer_movesFunds() public {
        token.mint(address(batch), AMOUNT * N);
        batch.batchTransfer(IERC20(address(token)), recipients, _amounts());
        for (uint256 i; i < N; ++i) {
            assertEq(token.balanceOf(recipients[i]), AMOUNT + 1);
        }
    }

    function test_batchTransferPacked_movesFunds() public {
        token.mint(address(batch), AMOUNT * N);
        batch.batchTransferPacked(IERC20(address(token)), _packed());
        for (uint256 i; i < N; ++i) {
            assertEq(token.balanceOf(recipients[i]), AMOUNT + 1);
        }
    }

    function test_batchTransferFrom_pullsWithApproval() public {
        vm.prank(relayer);
        token.approve(address(batch), type(uint256).max);
        vm.prank(relayer);
        uint256 g = gasleft();
        batch.batchTransferFrom(IERC20(address(token)), recipients, _amounts());
        uint256 total = g - gasleft() + INTRINSIC;
        console2.log("batchTransferFrom: gas per transfer   :", total / N);
        for (uint256 i; i < N; ++i) {
            assertEq(token.balanceOf(recipients[i]), AMOUNT + 1);
        }
    }

    function test_packed_revertsOnBadLength() public {
        bytes memory bad = new bytes(33);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.BadPackedLength.selector, 33));
        batch.batchTransferPacked(IERC20(address(token)), bad);
    }

    function test_sweep_onlyOwner() public {
        token.mint(address(batch), 100);
        vm.prank(relayer);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        batch.sweep(IERC20(address(token)), 100, relayer);

        batch.sweep(IERC20(address(token)), 100, relayer);
        assertEq(token.balanceOf(address(batch)), 0);
    }
}
