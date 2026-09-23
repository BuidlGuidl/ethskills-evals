// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {BatchSettler} from "../src/BatchSettler.sol";
import {BatchExecutor} from "../src/BatchExecutor.sol";

contract MockERC20 {
    mapping(address => uint256) public balances;

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 from = balances[msg.sender];
        require(from >= amount, "insufficient");
        balances[msg.sender] = from - amount;
        balances[to] += amount;
        return true;
    }
}

contract MockRevertingToken {
    bool public doomsday;

    function setDoomsday(bool v) external {
        doomsday = v;
    }

    function transfer(address, uint256) external returns (bool) {
        if (doomsday) revert("blacklisted");
        return true;
    }
}

contract BatchTest is Test {
    MockERC20 token;
    BatchSettler settler;
    address relayer = makeAddr("relayer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.prank(relayer);
        settler = new BatchSettler();
        token = new MockERC20();
        token.mint(address(settler), 1e24);
    }

    function addrOf(uint8 v) internal pure returns (address a) {
        bytes memory b = new bytes(20);
        for (uint256 i; i < 20; ++i) b[i] = bytes1(v);
        assembly {
            a := shr(96, mload(add(b, 32)))
        }
    }

    function _blob(uint256 n, uint256 amount) internal view returns (bytes memory) {
        bytes memory b = new bytes(n * 28);
        for (uint256 i; i < n; ++i) {
            address recipient = n <= 2 ? (i == 0 ? alice : bob) : addrOf(uint8(i % 250 + 1));
            for (uint256 j; j < 20; ++j) b[i * 28 + j] = bytes1(uint8(uint256(uint160(recipient)) >> (8 * (19 - j))));
            for (uint256 j; j < 8; ++j) b[i * 28 + 20 + j] = bytes1(uint8(amount >> (8 * (7 - j))));
        }
        return b;
    }

    function testPackedDistributes() public {
        uint256 aliceBefore = token.balances(alice);
        uint256 bobBefore = token.balances(bob);
        vm.prank(relayer);
        settler.distributePacked(address(token), _blob(2, 1e6));
        assertEq(token.balances(alice) - aliceBefore, 1e6);
        assertEq(token.balances(bob) - bobBefore, 1e6);
    }

    function testArraysDistributes() public {
        address[] memory to = new address[](2);
        uint256[] memory amts = new uint256[](2);
        to[0] = alice;
        to[1] = bob;
        amts[0] = 100;
        amts[1] = 200;
        vm.prank(relayer);
        settler.distribute(address(token), to, amts);
        assertEq(token.balances(alice), 100);
        assertEq(token.balances(bob), 200);
    }

    function testOnlyRelayerGate() public {
        vm.expectRevert(BatchSettler.NotRelayer.selector);
        settler.distributePacked(address(token), _blob(1, 1));
        vm.expectRevert(BatchSettler.NotRelayer.selector);
        vm.prank(alice);
        settler.distribute(address(token), new address[](1), new uint256[](1));
    }

    function testBadBlobLength() public {
        vm.expectRevert(BatchSettler.BadEntryLength.selector);
        vm.prank(relayer);
        settler.distributePacked(address(token), hex"00");
    }

    function testArraysLengthMismatch() public {
        vm.expectRevert(BatchSettler.LengthMismatch.selector);
        vm.prank(relayer);
        settler.distribute(address(token), new address[](2), new uint256[](1));
    }

    function testAllOrNothing() public {
        MockRevertingToken evil = new MockRevertingToken();
        evil.setDoomsday(true);
        uint256 before = token.balances(address(settler));
        vm.prank(relayer);
        vm.expectRevert();
        settler.distribute(address(evil), new address[](2), new uint256[](2));
        assertEq(token.balances(address(settler)), before);
    }

    function testSweep() public {
        assertGt(token.balances(address(settler)), 0);
        vm.prank(relayer);
        settler.sweep(address(token), relayer, 123);
        assertEq(token.balances(relayer), 123);
        vm.expectRevert(BatchSettler.NotRelayer.selector);
        settler.sweep(address(token), relayer, 1);
    }

    function testSweepWrongToken() public {
        vm.prank(relayer);
        vm.expectRevert();
        settler.sweep(address(0), relayer, 1);
    }

    function testGasStandaloneTransfer() public {
        MockERC20 t = new MockERC20();
        t.mint(address(this), 1e12);
        uint256 g0 = gasleft();
        t.transfer(alice, 1e6);
        console2.log("single token.transfer exec gas:", g0 - gasleft());
    }

    function _coldBlob(uint256 n, uint256 amount) internal pure returns (bytes memory) {
        bytes memory b = new bytes(n * 28);
        for (uint256 i; i < n; ++i) {
            uint160 r = uint160(0x1000 + i);
            for (uint256 j; j < 20; ++j) b[i * 28 + j] = bytes1(uint8(r >> (8 * (19 - j))));
            for (uint256 j; j < 8; ++j) b[i * 28 + 20 + j] = bytes1(uint8(amount >> (8 * (7 - j))));
        }
        return b;
    }

    function _measurePacked(uint256 n) internal returns (uint256) {
        bytes memory b = _coldBlob(n, 1e6);
        vm.prank(relayer);
        uint256 g0 = gasleft();
        settler.distributePacked(address(token), b);
        return g0 - gasleft();
    }

    function _measureArrays(uint256 n) internal returns (uint256) {
        address[] memory to = new address[](n);
        uint256[] memory amts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            to[i] = address(uint160(0x1000 + i));
            amts[i] = 1e6;
        }
        vm.prank(relayer);
        uint256 g0 = gasleft();
        settler.distribute(address(token), to, amts);
        return g0 - gasleft();
    }

    function testGasPackedN1() public {
        console2.log("packed n=1:", _measurePacked(1));
    }

    function testGasPackedN10() public {
        console2.log("packed n=10:", _measurePacked(10));
    }

    function testGasPackedN100() public {
        console2.log("packed n=100:", _measurePacked(100));
    }

    function testGasPackedN200() public {
        console2.log("packed n=200:", _measurePacked(200));
    }

    function testGasArraysN200() public {
        console2.log("arrays n=200:", _measureArrays(200));
    }

    function decodeEntry(bytes calldata blob, uint256 i) external pure returns (address to, uint256 amount) {
        uint256 entry;
        assembly {
            entry := calldataload(add(blob.offset, mul(i, 28)))
        }
        to = address(uint160(entry >> 96));
        amount = uint256(entry >> 32 & 0xffffffffffffffff);
    }

    function testDecode() public {
        address a = 0x1111111111111111111111111111111111111111;
        uint256 amt = 123456;
        bytes memory b = new bytes(28);
        for (uint256 j; j < 20; ++j) b[j] = bytes1(uint8(uint160(a) >> (8 * (19 - j))));
        for (uint256 j; j < 8; ++j) b[20 + j] = bytes1(uint8(amt >> (8 * (7 - j))));
        (address got, uint256 gotAmt) = this.decodeEntry(b, 0);
        console2.log("got:", got);
        console2.log("gotAmt:", gotAmt);
        console2.log("want:", a);
        assertEq(got, a);
        assertEq(gotAmt, amt);
    }

    function testGasNoopPacked() public {
        NoopToken t = new NoopToken();
        bytes memory b = _coldBlob(200, 1e6);
        vm.prank(relayer);
        uint256 g0 = gasleft();
        settler.distributePacked(address(t), b);
        console2.log("noop packed n=200 (blob prebuilt):", g0 - gasleft());
    }

    function testGasNoopArrays() public {
        NoopToken t = new NoopToken();
        address[] memory to = new address[](200);
        uint256[] memory amts = new uint256[](200);
        for (uint256 i; i < 200; ++i) {
            to[i] = address(uint160(0x1000 + i));
            amts[i] = 1e6;
        }
        vm.prank(relayer);
        uint256 g0 = gasleft();
        settler.distribute(address(t), to, amts);
        console2.log("noop arrays n=200:", g0 - gasleft());
    }

    function testGasDecodeOnlyCalldata() public {
        bytes memory b = _coldBlob(200, 1e6);
        Sum s = new Sum();
        uint256 g0 = gasleft();
        uint256 total = s.sumPacked(b);
        console2.log("decode-only n=200:", g0 - gasleft());
        assertGt(total, 0);
    }
}

contract NoopToken {
    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }
}

contract Sum {
    function sumPacked(bytes calldata blob) external pure returns (uint256 total) {
        for (uint256 i; i < blob.length / 28; ++i) {
            uint256 entry;
            assembly {
                entry := calldataload(add(blob.offset, mul(i, 28)))
            }
            total += uint256(entry >> 32 & 0xffffffffffffffff) + uint256(uint160(entry >> 96));
        }
    }
}

contract BatchExecutor7702Test is Test {
    MockERC20 token;
    BatchExecutor impl;
    address relayer = makeAddr("relayer");

    function setUp() public {
        impl = new BatchExecutor();
        token = new MockERC20();
        token.mint(relayer, 1e24);
        vm.etch(relayer, abi.encodePacked(hex"ef0100", address(impl)));
    }

    function addrOf(uint8 v) internal pure returns (address a) {
        bytes memory b = new bytes(20);
        for (uint256 i; i < 20; ++i) b[i] = bytes1(v);
        assembly {
            a := shr(96, mload(add(b, 32)))
        }
    }

    function _blob(uint256 n, uint256 amount) internal pure returns (bytes memory) {
        bytes memory b = new bytes(n * 28);
        for (uint256 i; i < n; ++i) {
            address recipient = addrOf(uint8(i % 250 + 1));
            for (uint256 j; j < 20; ++j) b[i * 28 + j] = bytes1(uint8(uint256(uint160(recipient)) >> (8 * (19 - j))));
            for (uint256 j; j < 8; ++j) b[i * 28 + 20 + j] = bytes1(uint8(amount >> (8 * (7 - j))));
        }
        return b;
    }

    function testDelegatedExecution() public {
        uint256 n = 4;
        uint256 amount = 5e5;
        vm.prank(relayer);
        (bool ok,) = relayer.call(abi.encodeCall(BatchExecutor.distributePacked, (address(token), _blob(n, amount))));
        assertTrue(ok);
        assertEq(token.balances(addrOf(1)), amount);
        assertEq(token.balances(addrOf(4)), amount);
        assertEq(token.balances(relayer), 1e24 - n * amount);
    }

    function testOnlySelfGate() public {
        vm.expectRevert(BatchExecutor.NotSelf.selector);
        impl.distributePacked(address(token), _blob(1, 1));
        (bool ok, bytes memory ret) =
            relayer.call(abi.encodeCall(BatchExecutor.distribute, (address(token), new address[](1), new uint256[](1))));
        assertFalse(ok);
        assertEq(ret, abi.encodeWithSelector(BatchExecutor.NotSelf.selector));
        vm.prank(relayer);
        (ok, ret) = relayer.call(abi.encodeCall(BatchExecutor.distribute, (address(token), new address[](2), new uint256[](1))));
        assertFalse(ok);
        assertEq(ret, abi.encodeWithSelector(BatchExecutor.LengthMismatch.selector));
    }

    function testReceiveEth() public {
        (bool ok,) = relayer.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(relayer.balance, 1 ether);
    }

    function testGasDelegated() public {
        uint256 n = 200;
        bytes memory b = _blob(n, 1e6);
        vm.prank(relayer);
        uint256 g0 = gasleft();
        (bool ok,) = relayer.call(abi.encodeCall(BatchExecutor.distributePacked, (address(token), b)));
        console2.log("7702 delegated distributePacked gas, n=200:", g0 - gasleft());
        assertTrue(ok);
    }
}
