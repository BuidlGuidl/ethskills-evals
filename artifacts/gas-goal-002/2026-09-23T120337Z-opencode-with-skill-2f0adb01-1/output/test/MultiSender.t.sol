// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/MultiSender.sol";
import "./mocks/MockTokens.sol";

contract Meter {
    function avgWork(MockUSDC token, address[] calldata recipients, uint256[] calldata amounts)
        external
        returns (uint256 avg)
    {
        uint256 total;
        uint256 n = recipients.length;
        for (uint256 i = 0; i < n; ++i) {
            uint256 g = gasleft();
            token.transfer(recipients[i], amounts[i]);
            total += g - gasleft();
        }
        avg = total / n;
    }
}

contract MultiSenderTest is Test {
    MultiSender ms;
    MockUSDC token;
    Meter meter;
    address relayer = makeAddr("relayer");
    uint256 constant N_COLD = 200;
    uint256 constant STANDALONE_TX_FRAMING = 21_000 + 800;
    uint256 constant STANDALONE_SENDER_SLOT_RESPENDS = 4_400;
    uint256 constant LIVE_USDC_COLD = 62_147;
    uint256 constant LIVE_USDC_WARM = 40_271;

    function setUp() public {
        vm.startPrank(relayer, relayer);
        ms = new MultiSender();
        token = new MockUSDC();
        meter = new Meter();
        token.mint(relayer, 1e30);
        token.approve(address(ms), type(uint256).max);
        vm.stopPrank();
    }

    function _recipients(uint256 n, uint256 salt) internal pure returns (address[] memory out) {
        out = new address[](n);
        for (uint256 i = 0; i < n; ++i) {
            out[i] = address(uint160(uint256(keccak256(abi.encode(salt, i)))));
        }
    }

    function _amounts(uint256 n, uint256 amount) internal pure returns (uint256[] memory out) {
        out = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            out[i] = amount;
        }
    }

    function test_GasSavings_Cold() public {
        address[] memory recipients = _recipients(N_COLD, 1);
        uint256[] memory amounts = _amounts(N_COLD, 1_000_000e6);
        token.mint(address(meter), 1e30);

        uint256 work = meter.avgWork(token, recipients, amounts);
        uint256 standalonePerTransfer =
            STANDALONE_TX_FRAMING + STANDALONE_SENDER_SLOT_RESPENDS + work;

        address[] memory batchRecipients = _recipients(N_COLD, 11);
        vm.startPrank(relayer);
        uint256 b = gasleft();
        ms.payout(address(token), batchRecipients, amounts);
        uint256 batchTotal = b - gasleft();
        vm.stopPrank();
        uint256 batchedPerTransfer = batchTotal / N_COLD;

        emit log_named_uint(
            "standalone per-transfer estimate (framing + work)", standalonePerTransfer
        );
        emit log_named_uint("live USDC cold standalone (real Base receipt)", LIVE_USDC_COLD);
        emit log_named_uint("batched per-transfer (cold recipients)", batchedPerTransfer);
        emit log_named_uint(
            "gas saved per transfer vs live receipt", LIVE_USDC_COLD - batchedPerTransfer
        );

        assertLe(
            batchedPerTransfer, LIVE_USDC_COLD - 15_000, "batching must save >=15k gas per transfer"
        );
        assertLt(
            batchedPerTransfer, standalonePerTransfer, "batching must be cheaper than standalone"
        );
        assertApproxEqAbs(standalonePerTransfer, LIVE_USDC_COLD, 8_000, "mock stays USDC-like");
    }

    function test_GasSavings_Warm() public {
        address[] memory recipients = _recipients(N_COLD, 2);
        uint256[] memory amounts = _amounts(N_COLD, 1e6);
        vm.startPrank(relayer);
        for (uint256 i = 0; i < N_COLD; ++i) {
            token.transfer(recipients[i], 1e6);
        }
        vm.stopPrank();
        token.mint(address(meter), 1e30);

        uint256 work = meter.avgWork(token, recipients, amounts);
        uint256 standalonePerTransfer =
            STANDALONE_TX_FRAMING + STANDALONE_SENDER_SLOT_RESPENDS + work;

        vm.startPrank(relayer);
        uint256 b = gasleft();
        ms.payout(address(token), recipients, amounts);
        uint256 batchTotal = b - gasleft();
        vm.stopPrank();
        uint256 batchedPerTransfer = batchTotal / N_COLD;

        emit log_named_uint("standalone per-transfer warm estimate", standalonePerTransfer);
        emit log_named_uint("live USDC warm standalone (real Base receipt)", LIVE_USDC_WARM);
        emit log_named_uint("batched per-transfer (warm recipients)", batchedPerTransfer);
        emit log_named_uint(
            "gas saved per transfer vs live warm receipt", LIVE_USDC_WARM - batchedPerTransfer
        );

        assertLe(
            batchedPerTransfer, LIVE_USDC_WARM - 15_000, "batching must save >=15k gas per transfer"
        );
        assertLt(batchedPerTransfer, standalonePerTransfer, "batching must beat standalone (warm)");
    }

    function test_PayoutDeliversAll() public {
        vm.startPrank(relayer);
        address[] memory recipients = _recipients(5, 3);
        uint256[] memory amounts = _amounts(5, 1e6);
        ms.payout(address(token), recipients, amounts);
        vm.stopPrank();
        for (uint256 i = 0; i < 5; ++i) {
            assertEq(token.balanceOf(recipients[i]), 1e6, "recipient must be paid");
        }
    }

    function test_AtomicBatchRevertsOnFailure() public {
        vm.startPrank(relayer);
        address[] memory recipients = _recipients(5, 4);
        uint256[] memory amounts = _amounts(5, 1e30);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.InsufficientBalance.selector));
        ms.payout(address(token), recipients, amounts);
        vm.stopPrank();
    }

    function test_PartialMarksFailures() public {
        vm.startPrank(relayer);
        address[] memory recipients = _recipients(10, 5);
        token.freeze(recipients[4]);
        uint256[] memory amounts = _amounts(10, 1e6);
        uint256[] memory failed = ms.payoutPartial(address(token), recipients, amounts);
        vm.stopPrank();
        assertTrue(failed[0] & (1 << 4) != 0, "index 4 must be marked failed");
        assertTrue(failed[0] & (1 << 0) == 0, "index 0 must be marked ok");
        assertEq(token.balanceOf(recipients[3]), 1e6);
        assertEq(token.balanceOf(recipients[4]), 0);
    }

    function test_PartialMarksReturningFalseToken() public {
        vm.startPrank(relayer);
        ReturningFalseToken ft = new ReturningFalseToken();
        ft.mint(relayer, 1e30);
        ft.approve(address(ms), type(uint256).max);
        address[] memory recipients = _recipients(3, 6);
        uint256[] memory amounts = _amounts(3, 1e6);
        uint256[] memory failed = ms.payoutPartial(address(ft), recipients, amounts);
        vm.stopPrank();
        assertEq(failed[0], 7, "all three must be marked failed");
    }

    function test_PartialMarksRevertingToken() public {
        vm.startPrank(relayer);
        RevertingToken rt = new RevertingToken();
        rt.mint(relayer, 1e30);
        rt.approve(address(ms), type(uint256).max);
        address[] memory recipients = _recipients(3, 7);
        uint256[] memory amounts = _amounts(3, 1e6);
        uint256[] memory failed = ms.payoutPartial(address(rt), recipients, amounts);
        vm.stopPrank();
        assertEq(failed[0], 7, "all three must be marked failed");
    }

    function test_Mixed() public {
        vm.startPrank(relayer);
        MockUSDC token2 = new MockUSDC();
        token2.mint(relayer, 1e12);
        token2.approve(address(ms), type(uint256).max);
        MultiSender.Payment[] memory payments = new MultiSender.Payment[](4);
        payments[0] = MultiSender.Payment(address(token), makeAddr("a"), 1e6);
        payments[1] = MultiSender.Payment(address(token2), makeAddr("b"), 2e6);
        payments[2] = MultiSender.Payment(address(token), makeAddr("c"), 3e6);
        payments[3] = MultiSender.Payment(address(token2), makeAddr("d"), 4e6);
        uint256[] memory failed = ms.payoutMixed(payments);
        vm.stopPrank();
        assertEq(failed.length, 1);
        assertEq(failed[0], 0);
        assertEq(token.balanceOf(makeAddr("a")), 1e6);
        assertEq(token2.balanceOf(makeAddr("b")), 2e6);
        assertEq(token.balanceOf(makeAddr("c")), 3e6);
        assertEq(token2.balanceOf(makeAddr("d")), 4e6);
    }

    function test_MixedEmpty() public {
        MultiSender.Payment[] memory payments = new MultiSender.Payment[](0);
        vm.prank(relayer);
        uint256[] memory failed = ms.payoutMixed(payments);
        assertEq(failed.length, 0);
    }

    function test_OnlyOwner() public {
        address[] memory recipients = _recipients(2, 8);
        uint256[] memory amounts = _amounts(2, 1e6);
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(MultiSender.NotOwner.selector);
        ms.payout(address(token), recipients, amounts);
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(MultiSender.NotOwner.selector);
        ms.payoutPartial(address(token), recipients, amounts);
        vm.prank(makeAddr("attacker"));
        MultiSender.Payment[] memory payments = new MultiSender.Payment[](1);
        payments[0] = MultiSender.Payment(address(token), makeAddr("a"), 1);
        vm.expectRevert(MultiSender.NotOwner.selector);
        ms.payoutMixed(payments);
    }

    function test_LengthMismatch() public {
        address[] memory recipients = _recipients(2, 9);
        uint256[] memory amounts = _amounts(3, 1e6);
        vm.prank(relayer);
        vm.expectRevert(MultiSender.LengthMismatch.selector);
        ms.payout(address(token), recipients, amounts);
        vm.prank(relayer);
        vm.expectRevert(MultiSender.LengthMismatch.selector);
        ms.payoutPartial(address(token), recipients, amounts);
    }

    function test_BatchTooLarge() public {
        address[] memory recipients = _recipients(501, 10);
        uint256[] memory amounts = _amounts(501, 1e6);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(MultiSender.BatchTooLarge.selector, 501));
        ms.payout(address(token), recipients, amounts);
    }
}
