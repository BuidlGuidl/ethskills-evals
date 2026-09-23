// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchRelayer} from "../src/BatchRelayer.sol";

contract StandardToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        balanceOf[msg.sender] = 1e36;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) {
            allowance[from][msg.sender] = a - amount;
            emit Approval(from, msg.sender, a - amount);
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "insufficient");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract NoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor() {
        balanceOf[msg.sender] = 1e36;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transfer(address to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        allowance[from][msg.sender] = a - amount;
        require(balanceOf[from] >= amount, "insufficient");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract FalseReturnToken {
    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract RevertingToken {
    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("nope");
    }
}

contract BatchRelayerTest is Test {
    BatchRelayer relayer;
    StandardToken token;
    NoReturnToken noReturn;
    FalseReturnToken falseReturn;
    RevertingToken reverting;

    address relayerOwner = makeAddr("relayerOwner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.prank(relayerOwner);
        relayer = new BatchRelayer();
        token = new StandardToken();
        noReturn = new NoReturnToken();
        falseReturn = new FalseReturnToken();
        reverting = new RevertingToken();

        token.transfer(treasury, 1e24);
        vm.prank(treasury);
        token.approve(address(relayer), type(uint256).max);
        noReturn.approve(address(relayer), type(uint256).max);
    }

    function test_OwnerEnforced() public {
        vm.prank(alice);
        vm.expectRevert(BatchRelayer.Unauthorized.selector);
        relayer.batchTransferFrom(
            address(token), treasury, _addrArray(alice), _uintArray(1)
        );
    }

    function test_LengthMismatch() public {
        vm.prank(relayerOwner);
        vm.expectRevert(BatchRelayer.LengthMismatch.selector);
        relayer.batchTransferFrom(
            address(token), treasury, _addrArray(alice), _uintArray(1, 2)
        );

        address[] memory empty = new address[](0);
        uint256[] memory emptyAmts = new uint256[](0);
        vm.prank(relayerOwner);
        vm.expectRevert(BatchRelayer.LengthMismatch.selector);
        relayer.batchTransferFrom(address(token), treasury, empty, emptyAmts);
    }

    function test_BatchTransferFromMovesBalances() public {
        uint256 tBefore = token.balanceOf(treasury);
        vm.prank(relayerOwner);
        relayer.batchTransferFrom(
            address(token), treasury, _addrArray(alice, bob), _uintArray(100, 200)
        );
        assertEq(token.balanceOf(treasury), tBefore - 300);
        assertEq(token.balanceOf(alice), 100);
        assertEq(token.balanceOf(bob), 200);
    }

    function test_BatchTransferFloatModel() public {
        token.transfer(address(relayer), 1000);
        vm.prank(relayerOwner);
        relayer.batchTransfer(address(token), _addrArray(alice, bob), _uintArray(300, 700));
        assertEq(token.balanceOf(alice), 300);
        assertEq(token.balanceOf(bob), 700);
        assertEq(token.balanceOf(address(relayer)), 0);
    }

    function test_FailClosedOnFalseReturn() public {
        vm.prank(relayerOwner);
        vm.expectRevert(abi.encodeWithSelector(BatchRelayer.TransferFailed.selector, 0));
        relayer.batchTransferFrom(
            address(falseReturn), treasury, _addrArray(alice), _uintArray(1)
        );
    }

    function test_FailClosedOnRevert() public {
        vm.prank(relayerOwner);
        vm.expectRevert(abi.encodeWithSelector(BatchRelayer.TransferFailed.selector, 0));
        relayer.batchTransferFrom(
            address(reverting), treasury, _addrArray(alice), _uintArray(1)
        );
    }

    function test_FailClosedOnIndexRevert() public {
        address[] memory recipients = _addrArray(alice, bob);
        uint256[] memory amounts = _uintArray(1, 1);
        vm.startPrank(relayerOwner);
        // token has no approval from treasury; whole batch reverts with index 0
        vm.expectRevert(abi.encodeWithSelector(BatchRelayer.TransferFailed.selector, 0));
        relayer.batchTransferFrom(address(token), address(0xdead), recipients, amounts);
        vm.stopPrank();
    }

    function test_NoReturnTokenSupported() public {
        address holder = makeAddr("noReturnHolder");
        noReturn.transfer(holder, 1e24);
        vm.startPrank(holder);
        noReturn.approve(address(relayer), type(uint256).max);
        vm.stopPrank();

        vm.prank(relayerOwner);
        relayer.batchTransferFrom(
            address(noReturn), holder, _addrArray(alice, bob), _uintArray(10, 20)
        );
        assertEq(noReturn.balanceOf(alice), 10);
        assertEq(noReturn.balanceOf(bob), 20);
    }

    function test_RescueTokens() public {
        token.transfer(address(relayer), 555);
        vm.prank(relayerOwner);
        relayer.rescue(address(token));
        assertEq(token.balanceOf(relayerOwner), 555);
    }

    function test_RescueEth() public {
        vm.deal(address(relayer), 1 ether);
        uint256 before = relayerOwner.balance;
        vm.prank(relayerOwner);
        relayer.rescue(address(0));
        assertEq(relayerOwner.balance, before + 1 ether);
    }

    function _addrArray(address a, address b) internal pure returns (address[] memory r) {
        r = new address[](2);
        r[0] = a;
        r[1] = b;
    }

    function _addrArray(address a) internal pure returns (address[] memory r) {
        r = new address[](1);
        r[0] = a;
    }

    function _uintArray(uint256 a, uint256 b) internal pure returns (uint256[] memory r) {
        r = new uint256[](2);
        r[0] = a;
        r[1] = b;
    }

    function _uintArray(uint256 a) internal pure returns (uint256[] memory r) {
        r = new uint256[](1);
        r[0] = a;
    }
}
