// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {BatchRelayer} from "../src/BatchRelayer.sol";
import {TestToken} from "./mocks/TestToken.sol";
import {RevertingToken} from "./mocks/RevertingToken.sol";

contract BatchRelayerTest is Test {
    BatchRelayer internal dispatcher;
    TestToken internal token;
    address internal owner = address(0xA11CE);
    address internal other = address(0xB0B);

    uint256 internal constant AMOUNT = 1_000_000;
    uint256 internal constant POOL_BASE = 1000;
    uint256 internal constant POOL_SIZE = 300;
    uint256 internal constant FRESH_BASE = 900_000;

    function setUp() public {
        vm.prank(owner);
        dispatcher = new BatchRelayer();
        token = new TestToken();
        token.mint(address(dispatcher), 1e30);
        for (uint256 i = 0; i < POOL_SIZE; ++i) {
            token.mint(_poolAddr(i), 1);
        }
    }

    function _poolAddr(uint256 i) internal pure returns (address) {
        return vm.addr(POOL_BASE + i);
    }

    function _freshAddr(uint256 run, uint256 i) internal pure returns (address) {
        return vm.addr(FRESH_BASE + run * 400 + i);
    }

    function _batchData(address[] memory rs, uint256[] memory amts) internal view returns (bytes memory) {
        return abi.encodeCall(BatchRelayer.batchTransfer, (address(token), rs, amts));
    }

    function _simpleArrays(uint256 n, uint256 saltBase, bool fresh)
        internal
        view
        returns (address[] memory rs, uint256[] memory amts)
    {
        rs = new address[](n);
        amts = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            rs[i] = fresh ? _freshAddr(saltBase, i) : _poolAddr(i);
            amts[i] = AMOUNT;
        }
    }

    function _measure(bytes memory data) internal returns (uint256) {
        vm.startPrank(owner);
        vm.pauseGasMetering();
        uint256 pre = gasleft();
        vm.resumeGasMetering();
        (bool ok,) = address(dispatcher).call(data);
        vm.pauseGasMetering();
        uint256 used = pre - gasleft();
        vm.resumeGasMetering();
        vm.stopPrank();
        assertTrue(ok);
        return used;
    }

    function _measureIndividual(address to) internal returns (uint256) {
        bytes memory data = abi.encodeCall(TestToken.transfer, (to, AMOUNT));
        vm.startPrank(address(dispatcher));
        vm.pauseGasMetering();
        uint256 pre = gasleft();
        vm.resumeGasMetering();
        (bool ok,) = address(token).call(data);
        vm.pauseGasMetering();
        uint256 used = pre - gasleft();
        vm.resumeGasMetering();
        vm.stopPrank();
        assertTrue(ok);
        return used;
    }

    function test_batch_pays_all_recipients() public {
        (address[] memory rs, uint256[] memory amts) = _simpleArrays(3, 0, false);
        vm.expectEmit(true, true, true, true, address(dispatcher));
        emit BatchRelayer.BatchExecuted(address(token), 3, 3 * AMOUNT, 0);
        vm.prank(owner);
        dispatcher.batchTransfer(address(token), rs, amts);
        for (uint256 i = 0; i < 3; ++i) {
            assertEq(token.balanceOf(rs[i]), AMOUNT + 1);
        }
    }

    function test_reverts_on_empty_batch() public {
        address[] memory rs = new address[](0);
        uint256[] memory amts = new uint256[](0);
        vm.prank(owner);
        vm.expectRevert(BatchRelayer.EmptyBatch.selector);
        dispatcher.batchTransfer(address(token), rs, amts);
    }

    function test_reverts_on_length_mismatch() public {
        (address[] memory rs,) = _simpleArrays(3, 0, false);
        uint256[] memory amts = new uint256[](2);
        vm.prank(owner);
        vm.expectRevert(BatchRelayer.LengthMismatch.selector);
        dispatcher.batchTransfer(address(token), rs, amts);
    }

    function test_only_owner_can_batch() public {
        (address[] memory rs, uint256[] memory amts) = _simpleArrays(2, 0, false);
        vm.prank(other);
        vm.expectRevert(BatchRelayer.NotOwner.selector);
        dispatcher.batchTransfer(address(token), rs, amts);
    }

    function test_pause_blocks_and_resumes() public {
        (address[] memory rs, uint256[] memory amts) = _simpleArrays(2, 0, false);
        vm.prank(owner);
        dispatcher.setPaused(true);
        vm.prank(owner);
        vm.expectRevert(BatchRelayer.ContractPaused.selector);
        dispatcher.batchTransfer(address(token), rs, amts);
        vm.prank(owner);
        dispatcher.setPaused(false);
        vm.prank(owner);
        dispatcher.batchTransfer(address(token), rs, amts);
        assertEq(token.balanceOf(rs[0]), AMOUNT + 1);
    }

    function test_failed_entry_is_isolated() public {
        (address[] memory rs, uint256[] memory amts) = _simpleArrays(3, 0, false);
        token.blacklist(rs[1]);
        vm.expectEmit(true, true, true, true, address(dispatcher));
        emit BatchRelayer.TransferFailed(1, rs[1], AMOUNT);
        vm.expectEmit(true, true, true, true, address(dispatcher));
        emit BatchRelayer.BatchExecuted(address(token), 3, 3 * AMOUNT, 1);
        vm.prank(owner);
        dispatcher.batchTransfer(address(token), rs, amts);
        assertEq(token.balanceOf(rs[0]), AMOUNT + 1);
        assertEq(token.balanceOf(rs[1]), 1);
        assertEq(token.balanceOf(rs[2]), AMOUNT + 1);
    }

    function test_all_failures_still_report() public {
        RevertingToken bad = new RevertingToken();
        (address[] memory rs, uint256[] memory amts) = _simpleArrays(2, 0, false);
        vm.prank(owner);
        dispatcher.batchTransfer(address(bad), rs, amts);
    }

    function test_withdraw_tokens() public {
        uint256 before = token.balanceOf(owner);
        vm.prank(owner);
        dispatcher.withdraw(address(token), owner, 1e24);
        assertEq(token.balanceOf(owner), before + 1e24);
    }

    function test_withdraw_eth() public {
        vm.deal(address(dispatcher), 1 ether);
        uint256 before = other.balance;
        vm.prank(owner);
        dispatcher.withdrawETH(other, 1 ether);
        assertEq(other.balance, before + 1 ether);
    }

    function test_two_step_ownership() public {
        vm.prank(owner);
        dispatcher.transferOwnership(other);
        vm.prank(owner);
        vm.expectRevert(BatchRelayer.NotPendingOwner.selector);
        dispatcher.acceptOwnership();
        vm.prank(other);
        dispatcher.acceptOwnership();
        assertEq(dispatcher.owner(), other);
    }

    function test_gas_points() public {
        uint256[7] memory sizes = [uint256(1), 5, 10, 25, 50, 100, 200];

        vm.startPrank(owner);
        vm.pauseGasMetering();
        uint256 preEmpty = gasleft();
        vm.resumeGasMetering();
        (bool emptyOk,) = address(dispatcher).call("");
        vm.pauseGasMetering();
        uint256 emptyCall = preEmpty - gasleft();
        vm.resumeGasMetering();
        vm.stopPrank();
        assertTrue(emptyOk);

        vm.cool(address(token));
        vm.cool(address(dispatcher));
        uint256 indExisting = _measureIndividual(_poolAddr(POOL_SIZE - 1));
        vm.cool(address(token));
        vm.cool(address(dispatcher));
        uint256 indFresh = _measureIndividual(_freshAddr(6500, 0));
        console2.log("indExisting", indExisting);
        console2.log("indFresh", indFresh);

        string memory batchExisting = "[";
        string memory batchFresh = "[";
        for (uint256 r = 0; r < sizes.length; ++r) {
            uint256 n = sizes[r];
            (address[] memory rsE, uint256[] memory amtsE) = _simpleArrays(n, 0, false);
            vm.cool(address(token));
            vm.cool(address(dispatcher));
            uint256 gE = _measure(_batchData(rsE, amtsE));
            batchExisting = string.concat(
                batchExisting,
                r == 0 ? "" : ",",
                "[",
                vm.toString(n),
                ",",
                vm.toString(gE),
                "]"
            );

            (address[] memory rsF, uint256[] memory amtsF) = _simpleArrays(n, r, true);
            vm.cool(address(token));
            vm.cool(address(dispatcher));
            uint256 gF = _measure(_batchData(rsF, amtsF));
            batchFresh =
                string.concat(batchFresh, r == 0 ? "" : ",", "[", vm.toString(n), ",", vm.toString(gF), "]");
        }
        batchExisting = string.concat(batchExisting, "]");
        batchFresh = string.concat(batchFresh, "]");

        string memory json = string.concat(
            "{\n  \"emptyCall\": ",
            vm.toString(emptyCall),
            ",\n  \"individualExecExisting\": ",
            vm.toString(indExisting),
            ",\n  \"individualExecFresh\": ",
            vm.toString(indFresh),
            ",\n  \"batchExecExisting\": ",
            batchExisting,
            ",\n  \"batchExecFresh\": ",
            batchFresh,
            "\n}\n"
        );
        vm.writeFile("relayer/gas-points.json", json);

        assertGt(indExisting, 0);
        assertGt(indFresh, indExisting);
    }
}
