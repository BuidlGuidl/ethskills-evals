// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {BatchSender} from "../src/BatchSender.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor() {
        balanceOf[msg.sender] = type(uint256).max / 2;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _move(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "insufficient allowance");
        allowance[from][msg.sender] = a - amount;
        return _move(from, to, amount);
    }

    function _move(address from, address to, uint256 amount) internal returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract RevertingToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("nope");
    }
}

contract FalseReturningToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract SilentNoReturnToken {
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address, address, uint256) external returns (bool) {
        return true;
    }
}

contract BatchSenderTest is Test {
    MockERC20 token;
    BatchSender batcher;
    address relayer = makeAddr("relayer");

    function setUp() public {
        token = new MockERC20();
        batcher = new BatchSender(relayer);
        token.transfer(relayer, 1e30);
        vm.prank(relayer);
        token.approve(address(batcher), type(uint256).max);
    }

    function _payment(address t, address to, uint256 amount) internal view returns (BatchSender.Payment[] memory p) {
        p = new BatchSender.Payment[](1);
        p[0] = BatchSender.Payment(t, to, amount);
    }

    function test_sendsFromRelayerToRecipients() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        BatchSender.Payment[] memory p = new BatchSender.Payment[](2);
        p[0] = BatchSender.Payment(address(token), alice, 1e18);
        p[1] = BatchSender.Payment(address(token), bob, 2e18);

        vm.prank(relayer);
        batcher.send(p);

        assertEq(token.balanceOf(alice), 1e18, "alice balance");
        assertEq(token.balanceOf(bob), 2e18, "bob balance");
    }

    function test_transferEventsShowRelayerAsFrom() public {
        address alice = makeAddr("alice");
        BatchSender.Payment[] memory p = _payment(address(token), alice, 1e18);
        vm.prank(relayer);
        vm.expectEmit(true, true, true, true, address(token));
        emit MockERC20.Transfer(relayer, alice, 1e18);
        batcher.send(p);
    }

    function test_onlyOwner() public {
        BatchSender.Payment[] memory p = _payment(address(token), makeAddr("x"), 1);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.NotOwner.selector, address(this), relayer));
        batcher.send(p);
    }

    function test_emptyBatchReverts() public {
        BatchSender.Payment[] memory p = new BatchSender.Payment[](0);
        vm.prank(relayer);
        vm.expectRevert(BatchSender.EmptyBatch.selector);
        batcher.send(p);
    }

    function test_revertingTokenRevertsWholeBatchAtomically() public {
        RevertingToken bad = new RevertingToken();
        MockERC20 good = new MockERC20();
        good.transfer(relayer, 1e30);
        vm.prank(relayer);
        good.approve(address(batcher), type(uint256).max);
        address keep = makeAddr("keep");

        BatchSender.Payment[] memory p = new BatchSender.Payment[](2);
        p[0] = BatchSender.Payment(address(good), keep, 1e18);
        p[1] = BatchSender.Payment(address(bad), keep, 1e18);

        uint256 before = good.balanceOf(keep);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.TransferFailed.selector, 1));
        batcher.send(p);
        assertEq(good.balanceOf(keep), before, "atomic: no partial state");
    }

    function test_falseReturnReverts() public {
        FalseReturningToken bad = new FalseReturningToken();
        BatchSender.Payment[] memory p = _payment(address(bad), makeAddr("x"), 1);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.TransferFailed.selector, 0));
        batcher.send(p);
    }

    function test_tokenWithNoReturnValueAccepted() public {
        SilentNoReturnToken quiet = new SilentNoReturnToken();
        vm.prank(relayer);
        quiet.approve(address(batcher), type(uint256).max);
        address to = makeAddr("quiet-to");
        BatchSender.Payment[] memory p = _payment(address(quiet), to, 5);
        vm.prank(relayer);
        batcher.send(p);
    }

    function test_eoaTokenAddressRejected() public {
        address notAContract = makeAddr("ghost");
        BatchSender.Payment[] memory p = _payment(notAContract, makeAddr("x"), 1);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchSender.NotAContract.selector, 0, notAContract));
        batcher.send(p);
    }

    function test_zeroOwnerRejected() public {
        vm.expectRevert(BatchSender.ZeroOwner.selector);
        new BatchSender(address(0));
    }

    function test_batchSentEvent() public {
        BatchSender.Payment[] memory p = _payment(address(token), makeAddr("x"), 1);
        vm.prank(relayer);
        vm.expectEmit(true, false, false, true, address(batcher));
        emit BatchSender.BatchSent(1);
        batcher.send(p);
    }
}
