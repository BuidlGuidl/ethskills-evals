// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchSender} from "../contracts/BatchSender.sol";

contract Token {
    mapping(address => uint256) public balanceOf;

    constructor() {
        balanceOf[msg.sender] = type(uint256).max;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract RevertingToken {
    function transfer(address, uint256) external pure returns (bool) {
        revert("nope");
    }
}

contract FalseToken {
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

contract NoReturnToken {
    function transfer(address, uint256) external pure {}
}

contract Noop {
    function noop() external pure {}
}

contract BatchSenderTest is Test {
    BatchSender sender;
    Token token;
    RevertingToken revertingToken;
    FalseToken falseToken;
    NoReturnToken noReturnToken;
    address owner = address(0xa11ce);
    address stranger = address(0xb0b);

    event Failures(uint256 bitmap);

    function setUp() public {
        revertingToken = new RevertingToken();
        falseToken = new FalseToken();
        noReturnToken = new NoReturnToken();
        vm.startPrank(owner);
        sender = new BatchSender();
        vm.stopPrank();
        token = new Token();
        token.transfer(address(sender), type(uint128).max);
    }

    function pack(address to, uint256 amount) internal pure returns (bytes32) {
        return bytes32((uint256(uint160(to)) << 96) | amount);
    }

    function items(address to, uint256 amount, uint256 count) internal pure returns (bytes32[] memory list) {
        list = new bytes32[](count);
        for (uint256 i = 0; i < count; ++i) {
            list[i] = pack(to, amount);
        }
    }

    function testSendMovesBalances() public {
        address recipient = address(0x1001);
        uint256 before = token.balanceOf(recipient);
        vm.prank(owner);
        sender.send(address(token), items(recipient, 5e6, 3));
        assertEq(token.balanceOf(recipient) - before, 15e6);
    }

    function testSendRevertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(BatchSender.NotOwner.selector);
        sender.send(address(token), items(address(1), 1, 1));
    }

    function testSendRevertsOnEmptyBatch() public {
        vm.prank(owner);
        vm.expectRevert(BatchSender.EmptyBatch.selector);
        sender.send(address(token), new bytes32[](0));
    }

    function testSendRevertsOnOversizedBatch() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.TooManyItems.selector, 257));
        sender.send(address(token), items(address(1), 1, 257));
    }

    function testSendRevertsOnZeroToken() public {
        vm.prank(owner);
        vm.expectRevert(BatchSender.ZeroToken.selector);
        sender.send(address(0), items(address(1), 1, 1));
    }

    function testSendRevertsOnZeroRecipient() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.ZeroRecipient.selector, 0));
        sender.send(address(token), items(address(0), 1, 1));
    }

    function testSendRevertsOnZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.ZeroAmount.selector, 0));
        sender.send(address(token), items(address(1), 0, 1));
    }

    function testSendRevertsAtomicallyOnRevertingToken() public {
        uint256 snapshot = token.balanceOf(address(sender));
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.TransferFailed.selector, 0));
        sender.send(address(revertingToken), items(address(1), 1, 2));
        assertEq(token.balanceOf(address(sender)), snapshot);
    }

    function testSendRevertsAtomicallyOnFalseToken() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.TransferFailed.selector, 0));
        sender.send(address(falseToken), items(address(1), 1, 1));
    }

    function testSendAcceptsNoReturnToken() public {
        vm.prank(owner);
        sender.send(address(noReturnToken), items(address(1), 1, 2));
    }

    function testSendSafeMarksFailuresAndContinues() public {
        bytes32[] memory list = new bytes32[](3);
        list[0] = pack(address(0x2001), 7e6);
        list[1] = pack(address(0x2002), 7e6);
        list[2] = pack(address(0x2003), 7e6);
        vm.prank(owner);
        uint256 failures = sender.sendSafe(address(revertingToken), list);
        assertEq(failures, 7);

        uint256 before = token.balanceOf(address(0x2001));
        vm.prank(owner);
        failures = sender.sendSafe(address(token), list);
        assertEq(failures, 0);
        assertEq(token.balanceOf(address(0x2001)) - before, 7e6);

        list[1] = pack(address(0), 7e6);
        vm.expectEmit(true, true, true, true);
        emit Failures(2);
        vm.prank(owner);
        failures = sender.sendSafe(address(token), list);
        assertEq(failures, 2);
    }

    function testSendSafeMarksFalseToken() public {
        vm.prank(owner);
        uint256 failures = sender.sendSafe(address(falseToken), items(address(1), 1, 2));
        assertEq(failures, 3);
    }

    function testSendSafeMarksNoReturnToken() public {
        vm.prank(owner);
        uint256 failures = sender.sendSafe(address(noReturnToken), items(address(1), 1, 2));
        assertEq(failures, 0);
    }

    function testSendSafeRevertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(BatchSender.NotOwner.selector);
        sender.sendSafe(address(token), items(address(1), 1, 1));
    }

    function testPackingRoundTrip() public view {
        bytes32 item = pack(address(0xdeadbeef), 123456789);
        assertEq(address(uint160(uint256(item) >> 96)), address(0xdeadbeef));
        assertEq(uint256(uint96(uint256(item))), 123456789);
        assertEq(
            uint256(item), (uint256(uint160(address(0xdeadbeef))) << 96) | uint256(123456789)
        );
    }

    function testGasStandaloneTransfer() public {
        Noop noop = new Noop();
        uint256 n0 = gasleft();
        noop.noop();
        emit log_named_uint("noop external call overhead", n0 - gasleft());
        address recipient = address(0x5001);
        uint256 g0 = gasleft();
        token.transfer(recipient, 100e6);
        uint256 used = g0 - gasleft();
        emit log_named_uint("standalone token.transfer body gas, cold (add 21000 for full tx)", used);
        uint256 g1 = gasleft();
        token.transfer(recipient, 100e6);
        uint256 usedWarm = g1 - gasleft();
        emit log_named_uint("standalone token.transfer body gas, warm recipient", usedWarm);
        emit log_named_uint("standalone full tx estimate (cold)", used + 21000);
    }

    function measureBatch(uint256 count, bool safe) internal {
        bytes32[] memory list = new bytes32[](count);
        for (uint256 i = 0; i < count; ++i) {
            list[i] = pack(address(uint160(0x6000 + i)), 100e6);
        }
        vm.startPrank(owner);
        uint256 g0 = gasleft();
        if (safe) {
            sender.sendSafe(address(token), list);
        } else {
            sender.send(address(token), list);
        }
        uint256 used = g0 - gasleft();
        vm.stopPrank();
        emit log_named_uint("batch send gas total", used);
        emit log_named_uint("batch send gas per item", used / count);
    }

    function testGasBatch1() public {
        measureBatch(1, false);
    }

    function testGasBatch100() public {
        measureBatch(100, false);
    }

    function testGasBatch256() public {
        measureBatch(256, false);
    }

    function testGasBatch1Safe() public {
        measureBatch(1, true);
    }

    function testGasBatch100Safe() public {
        measureBatch(100, true);
    }

    function testGasBatch256Safe() public {
        measureBatch(256, true);
    }
}
