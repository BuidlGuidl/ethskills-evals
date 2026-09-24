// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PayoutBatcher} from "../src/PayoutBatcher.sol";

interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// Correctness tests, run against forked Base so the real USDC implementation
/// (proxy + blacklist checks) is exercised.
///
/// Gas numbers are deliberately NOT measured here: `gasleft()` inside a forge
/// test does not reproduce real transaction accounting. See script/bench.py,
/// which sends real transactions and reads gasUsed off receipts.
contract PayoutBatcherTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    PayoutBatcher batcher;
    address owner = address(this);
    address relayer = address(0xBEEF);
    uint256 constant AMOUNT = 5_000_000;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"));
        batcher = new PayoutBatcher(USDC, owner);
        batcher.setRelayer(relayer, true);
        deal(USDC, address(batcher), 1_000_000e6);
    }

    function _recipients(uint256 n, uint256 salt) internal pure returns (address[] memory r) {
        r = new address[](n);
        for (uint256 i; i < n; ++i) {
            r[i] = address(uint160(uint256(keccak256(abi.encode(salt, i)))));
        }
    }

    function _pack(address[] memory to, uint256 amount) internal pure returns (bytes memory p) {
        for (uint256 i; i < to.length; ++i) {
            p = bytes.concat(p, bytes20(to[i]), bytes11(uint88(amount)));
        }
    }

    function test_deliversExactAmountsToEveryRecipient() public {
        address[] memory to = _recipients(50, 1);
        vm.prank(relayer);
        batcher.batchTransferPacked(_pack(to, AMOUNT));
        for (uint256 i; i < to.length; ++i) {
            assertEq(IERC20(USDC).balanceOf(to[i]), AMOUNT);
        }
    }

    /// Distinct amounts must land on the right recipient, not just sum correctly.
    function test_perRecipientAmountsAreNotTransposed() public {
        address[] memory to = _recipients(5, 2);
        bytes memory p;
        for (uint256 i; i < to.length; ++i) {
            p = bytes.concat(p, bytes20(to[i]), bytes11(uint88((i + 1) * 1_000_000)));
        }
        vm.prank(relayer);
        batcher.batchTransferPacked(p);
        for (uint256 i; i < to.length; ++i) {
            assertEq(IERC20(USDC).balanceOf(to[i]), (i + 1) * 1_000_000);
        }
    }

    function test_repeatedRecipientAccumulates() public {
        address payee = _recipients(1, 11)[0];
        address[] memory to = new address[](3);
        to[0] = payee;
        to[1] = payee;
        to[2] = payee;
        uint256 before = IERC20(USDC).balanceOf(payee);
        vm.prank(relayer);
        batcher.batchTransferPacked(_pack(to, AMOUNT));
        assertEq(IERC20(USDC).balanceOf(payee) - before, 3 * AMOUNT);
    }

    function test_arrayAndPackedFormsAgree() public {
        address[] memory a = _recipients(10, 3);
        uint256[] memory amts = new uint256[](10);
        for (uint256 i; i < 10; ++i) amts[i] = AMOUNT;
        vm.prank(relayer);
        batcher.batchTransfer(a, amts);

        address[] memory b = _recipients(10, 4);
        vm.prank(relayer);
        batcher.batchTransferPacked(_pack(b, AMOUNT));

        for (uint256 i; i < 10; ++i) {
            assertEq(IERC20(USDC).balanceOf(a[i]), IERC20(USDC).balanceOf(b[i]));
        }
    }

    function test_maxUint88AmountRoundTrips() public {
        address[] memory to = _recipients(1, 5);
        uint256 max88 = type(uint88).max;
        deal(USDC, address(batcher), max88);
        vm.prank(relayer);
        batcher.batchTransferPacked(_pack(to, max88));
        assertEq(IERC20(USDC).balanceOf(to[0]), max88);
    }

    function test_revertsForNonRelayer() public {
        address[] memory to = _recipients(1, 6);
        vm.expectRevert(PayoutBatcher.NotRelayer.selector);
        batcher.batchTransferPacked(_pack(to, AMOUNT));
    }

    function test_revertsOnMisalignedPayload() public {
        vm.prank(relayer);
        vm.expectRevert(PayoutBatcher.BadPayloadLength.selector);
        batcher.batchTransferPacked(hex"0011223344");
    }

    function test_revertsOnEmptyPayload() public {
        vm.prank(relayer);
        vm.expectRevert(PayoutBatcher.BadPayloadLength.selector);
        batcher.batchTransferPacked("");
    }

    /// A batch must be all-or-nothing so the relayer never reconciles a partial run.
    function test_insufficientFloatRevertsWholeBatch() public {
        address[] memory to = _recipients(3, 7);
        batcher.sweep(USDC, owner, IERC20(USDC).balanceOf(address(batcher)));
        vm.prank(relayer);
        vm.expectRevert();
        batcher.batchTransferPacked(_pack(to, AMOUNT));
        assertEq(IERC20(USDC).balanceOf(to[0]), 0);
    }

    /// USDC reverts on blacklisted recipients; the batch must not silently skip.
    function test_revertingRecipientRevertsWholeBatch() public {
        address[] memory to = _recipients(2, 12);
        uint256 before = IERC20(USDC).balanceOf(to[0]);
        // Force the second transfer to fail by making the token revert for it.
        vm.mockCallRevert(
            USDC,
            abi.encodeWithSelector(0xa9059cbb, to[1], AMOUNT),
            "blacklisted"
        );
        vm.prank(relayer);
        vm.expectRevert();
        batcher.batchTransferPacked(_pack(to, AMOUNT));
        assertEq(IERC20(USDC).balanceOf(to[0]), before, "partial batch applied");
    }

    /// A token that returns `false` instead of reverting must still fail the batch.
    function test_falseReturningTokenRevertsBatch() public {
        address[] memory to = _recipients(1, 8);
        vm.mockCall(
            USDC,
            abi.encodeWithSelector(0xa9059cbb, to[0], AMOUNT),
            abi.encode(false)
        );
        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(PayoutBatcher.TransferFailed.selector, to[0], AMOUNT)
        );
        batcher.batchTransferPacked(_pack(to, AMOUNT));
    }

    function test_onlyOwnerCanSetRelayerOrSweep() public {
        vm.prank(relayer);
        vm.expectRevert(PayoutBatcher.NotOwner.selector);
        batcher.setRelayer(address(0xD00D), true);

        vm.prank(relayer);
        vm.expectRevert(PayoutBatcher.NotOwner.selector);
        batcher.sweep(USDC, relayer, 1);
    }

    function test_revokedRelayerCannotPay() public {
        batcher.setRelayer(relayer, false);
        address[] memory to = _recipients(1, 9);
        vm.prank(relayer);
        vm.expectRevert(PayoutBatcher.NotRelayer.selector);
        batcher.batchTransferPacked(_pack(to, AMOUNT));
    }

    /// The assembly loop writes over scratch memory; make sure it leaves the
    /// free memory pointer intact for any Solidity that runs afterwards.
    function testFuzz_memoryPointerPreserved(uint8 n) public {
        n = uint8(bound(n, 1, 60));
        address[] memory to = _recipients(n, 10);
        vm.prank(relayer);
        batcher.batchTransferPacked(_pack(to, AMOUNT));
        bytes memory fresh = new bytes(128); // would corrupt if FMP were clobbered
        assertEq(fresh.length, 128);
        assertEq(IERC20(USDC).balanceOf(to[n - 1]), AMOUNT);
    }
}
