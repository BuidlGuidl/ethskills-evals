// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BatchTransfer, IERC20} from "../src/BatchTransfer.sol";

/// @dev Forked-Base measurements that back the savings table in PLAN.md.
///      Run: forge test --fork-url https://mainnet.base.org -vv
///
///      All headline figures are MARGINAL gas — the cost of adding one more
///      recipient, taken as the difference between a 100-payout batch and a
///      50-payout batch. Differencing cancels the fixed overhead that the
///      `vm.prank` + `gasleft()` harness adds to any single measurement, so the
///      marginal numbers are directly comparable to on-chain receipts.
contract BatchTransferTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant RELAYER = address(0xBEEF);

    BatchTransfer batch;

    function setUp() public {
        batch = new BatchTransfer(RELAYER);
        deal(USDC, RELAYER, 100_000_000e6);
        vm.prank(RELAYER);
        IERC20(USDC).approve(address(batch), type(uint256).max);
    }

    function _recipients(uint256 n, uint256 salt, bool prefund)
        internal
        returns (address[] memory to, uint256[] memory amt)
    {
        to = new address[](n);
        amt = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            to[i] = address(uint160(uint256(keccak256(abi.encode(salt, i)))));
            amt[i] = 10e6;
            if (prefund) {
                vm.prank(RELAYER);
                IERC20(USDC).transfer(to[i], 1e6); // recipient balance slot already non-zero
            }
        }
    }

    function _pack(address[] memory to, uint256[] memory amt) internal pure returns (bytes32[] memory p) {
        p = new bytes32[](to.length);
        for (uint256 i; i < to.length; ++i) {
            p[i] = bytes32((uint256(uint160(to[i])) << 96) | amt[i]);
        }
    }

    enum Mode {
        Disperse,
        Packed,
        From
    }

    function _measure(uint256 n, uint256 salt, bool prefund, Mode m) internal returns (uint256 used) {
        (address[] memory to, uint256[] memory amt) = _recipients(n, salt, prefund);
        vm.prank(RELAYER);
        uint256 g = gasleft();
        if (m == Mode.Disperse) batch.disperse(IERC20(USDC), to, amt);
        else if (m == Mode.Packed) batch.dispersePacked(IERC20(USDC), _pack(to, amt));
        else batch.disperseFrom(IERC20(USDC), to, amt);
        used = g - gasleft();
    }

    /// Marginal gas per additional recipient, by entry point, for brand-new payees.
    function test_marginalGas_newRecipients() public {
        console.log("marginal gas per additional NEW recipient (100-batch minus 50-batch):");
        console.log("  disperse      :", (_measure(100, 1, false, Mode.Disperse) - _measure(50, 2, false, Mode.Disperse)) / 50);
        console.log("  dispersePacked:", (_measure(100, 3, false, Mode.Packed) - _measure(50, 4, false, Mode.Packed)) / 50);
        console.log("  disperseFrom  :", (_measure(100, 5, false, Mode.From) - _measure(50, 6, false, Mode.From)) / 50);
    }

    /// Marginal gas per additional recipient for repeat payees (balance slot warm).
    function test_marginalGas_existingRecipients() public {
        console.log("marginal gas per additional EXISTING recipient (100-batch minus 50-batch):");
        console.log("  disperse      :", (_measure(100, 11, true, Mode.Disperse) - _measure(50, 12, true, Mode.Disperse)) / 50);
        console.log("  dispersePacked:", (_measure(100, 13, true, Mode.Packed) - _measure(50, 14, true, Mode.Packed)) / 50);
        console.log("  disperseFrom  :", (_measure(100, 15, true, Mode.From) - _measure(50, 16, true, Mode.From)) / 50);
    }

    /// Fixed cost of a batch: the part that is paid once regardless of size.
    function test_batchFixedOverhead() public {
        uint256 g100 = _measure(100, 21, true, Mode.Packed);
        uint256 g50 = _measure(50, 22, true, Mode.Packed);
        uint256 marginal = (g100 - g50) / 50;
        console.log("packed batch of 50, total execution gas:", g50);
        console.log("implied fixed cost per batch (excl. 21k intrinsic):", g50 - marginal * 50);
    }

    function test_onlyOwnerCanDisperse() public {
        (address[] memory to, uint256[] memory amt) = _recipients(2, 99, false);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        batch.disperse(IERC20(USDC), to, amt);
    }

    function test_rejectsMismatchedLengths() public {
        (address[] memory to,) = _recipients(3, 98, false);
        uint256[] memory amt = new uint256[](2);
        vm.prank(RELAYER);
        vm.expectRevert(BatchTransfer.LengthMismatch.selector);
        batch.disperse(IERC20(USDC), to, amt);
    }

    function test_rejectsEmptyBatch() public {
        vm.prank(RELAYER);
        vm.expectRevert(BatchTransfer.EmptyBatch.selector);
        batch.disperse(IERC20(USDC), new address[](0), new uint256[](0));
    }

    /// The contract must not retain dust: everything pulled in must go out.
    function test_dispersePacked_leavesNoResidualBalance() public {
        (address[] memory to, uint256[] memory amt) = _recipients(25, 55, false);
        vm.prank(RELAYER);
        batch.dispersePacked(IERC20(USDC), _pack(to, amt));
        assertEq(IERC20(USDC).balanceOf(address(batch)), 0, "batch contract retained funds");
        for (uint256 i; i < to.length; ++i) {
            assertEq(IERC20(USDC).balanceOf(to[i]), amt[i], "recipient underpaid");
        }
    }
}
