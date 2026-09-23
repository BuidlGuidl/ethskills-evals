// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchPay} from "../src/BatchPay.sol";

/// Minimal ERC-20 that returns a bool, plus switches to force failure paths.
contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public failNext;
    address public revertOn;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }

    function setFailNext(bool v) external {
        failNext = v;
    }

    function setRevertOn(address a) external {
        revertOn = a;
    }

    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        if (t == revertOn) revert("blacklisted");
        if (failNext) {
            failNext = false;
            return false; // silent-false ERC-20 behaviour
        }
        require(balanceOf[f] >= a, "balance");
        uint256 al = allowance[f][msg.sender];
        if (al != type(uint256).max) {
            require(al >= a, "allowance");
            allowance[f][msg.sender] = al - a;
        }
        balanceOf[f] -= a;
        balanceOf[t] += a;
        return true;
    }
}

/// ERC-20 that returns no data at all (USDT-style).
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function transferFrom(address f, address t, uint256 a) external {
        require(balanceOf[f] >= a, "balance");
        balanceOf[f] -= a;
        balanceOf[t] += a;
    }
}

contract BatchPayTest is Test {
    MockToken token;
    BatchPay batcher;
    address owner = makeAddr("owner");
    address funder = makeAddr("funder");
    address relayer = makeAddr("relayer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        token = new MockToken();
        batcher = new BatchPay(address(token), funder, owner);
        vm.prank(owner);
        batcher.setRelayer(relayer, true);

        token.mint(funder, 1_000_000e6);
        vm.prank(funder);
        token.approve(address(batcher), type(uint256).max);
    }

    function _pack(address to, uint96 amt) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32((uint256(uint160(to)) << 96) | uint256(amt)));
    }

    function test_PaysEachRecipientTheEncodedAmount() public {
        bytes memory p = bytes.concat(_pack(alice, 10e6), _pack(bob, 25e6));
        vm.prank(relayer);
        uint256 total = batcher.pay(p);

        assertEq(token.balanceOf(alice), 10e6);
        assertEq(token.balanceOf(bob), 25e6);
        assertEq(total, 35e6);
        assertEq(token.balanceOf(funder), 1_000_000e6 - 35e6);
    }

    function test_DecodesAddressAndAmountWithoutBleed() public {
        // Max uint96 amount next to a high-bit address: catches shift/mask errors.
        address hi = address(type(uint160).max);
        token.mint(funder, type(uint96).max);
        bytes memory p = _pack(hi, type(uint96).max);
        vm.prank(relayer);
        batcher.pay(p);
        assertEq(token.balanceOf(hi), type(uint96).max);
    }

    function test_RevertsForNonRelayer() public {
        bytes memory p = _pack(alice, 1e6);
        vm.expectRevert(BatchPay.NotRelayer.selector);
        vm.prank(alice);
        batcher.pay(p);
    }

    function test_RevokedRelayerCannotPay() public {
        vm.prank(owner);
        batcher.setRelayer(relayer, false);
        vm.expectRevert(BatchPay.NotRelayer.selector);
        vm.prank(relayer);
        batcher.pay(_pack(alice, 1e6));
    }

    function test_RevertsOnMisalignedCalldata() public {
        vm.expectRevert(BatchPay.BadCalldata.selector);
        vm.prank(relayer);
        batcher.pay(hex"deadbeef");
    }

    function test_RevertsOnEmptyCalldata() public {
        vm.expectRevert(BatchPay.BadCalldata.selector);
        vm.prank(relayer);
        batcher.pay("");
    }

    /// A token returning false must abort the batch, not be silently ignored.
    function test_RevertsWithIndexWhenTransferReturnsFalse() public {
        token.setFailNext(true);
        bytes memory p = bytes.concat(_pack(alice, 1e6), _pack(bob, 1e6));
        vm.expectRevert(abi.encodeWithSelector(BatchPay.TransferFailed.selector, 0));
        vm.prank(relayer);
        batcher.pay(p);
    }

    /// The revert index is what lets the relayer bisect out a bad recipient.
    function test_ReportsIndexOfRevertingRecipient() public {
        token.setRevertOn(bob);
        bytes memory p = bytes.concat(_pack(alice, 1e6), _pack(bob, 1e6));
        vm.expectRevert(abi.encodeWithSelector(BatchPay.TransferFailed.selector, 1));
        vm.prank(relayer);
        batcher.pay(p);
    }

    /// Atomicity: a failure late in the batch must undo the earlier transfers.
    function test_BatchIsAtomic() public {
        token.setRevertOn(bob);
        bytes memory p = bytes.concat(_pack(alice, 1e6), _pack(bob, 1e6));
        vm.prank(relayer);
        try batcher.pay(p) {
            fail();
        } catch {}
        assertEq(token.balanceOf(alice), 0, "alice paid despite batch revert");
    }

    function test_SupportsTokensThatReturnNoData() public {
        NoReturnToken nrt = new NoReturnToken();
        BatchPay b2 = new BatchPay(address(nrt), funder, owner);
        vm.prank(owner);
        b2.setRelayer(relayer, true);
        nrt.mint(funder, 100e6);

        vm.prank(relayer);
        b2.pay(_pack(alice, 5e6));
        assertEq(nrt.balanceOf(alice), 5e6);
    }

    function test_OnlyOwnerAdministers() public {
        vm.expectRevert(BatchPay.NotOwner.selector);
        vm.prank(alice);
        batcher.setRelayer(alice, true);

        vm.expectRevert(BatchPay.NotOwner.selector);
        vm.prank(alice);
        batcher.setOwner(alice);
    }

    /// The contract must never be able to move funds anywhere the relayer did
    /// not encode, and must never hold a balance of its own.
    function test_ContractHoldsNoFunds() public {
        vm.prank(relayer);
        batcher.pay(bytes.concat(_pack(alice, 10e6), _pack(bob, 10e6)));
        assertEq(token.balanceOf(address(batcher)), 0);
    }

    function testFuzz_TotalEqualsSumOfAmounts(uint64 a, uint64 b) public {
        vm.assume(uint256(a) + uint256(b) > 0);
        token.mint(funder, uint256(a) + uint256(b));
        bytes memory p = bytes.concat(_pack(alice, a), _pack(bob, b));
        vm.prank(relayer);
        uint256 total = batcher.pay(p);
        assertEq(total, uint256(a) + uint256(b));
        assertEq(token.balanceOf(alice), a);
        assertEq(token.balanceOf(bob), b);
    }
}
