// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BatchTransfer, IERC20} from "../src/BatchTransfer.sol";

/// Standard, well-behaved token returning true.
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blocked;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function block_(address a) external { blocked[a] = true; }

    function transferFrom(address f, address t, uint256 a) external virtual returns (bool) {
        require(!blocked[f] && !blocked[t], "blocked");
        require(balanceOf[f] >= a, "balance");
        uint256 allowed = allowance[f][msg.sender];
        require(allowed >= a, "allowance");
        if (allowed != type(uint256).max) allowance[f][msg.sender] = allowed - a;
        balanceOf[f] -= a;
        balanceOf[t] += a;
        return true;
    }
}

/// Returns no data at all, like USDT on mainnet.
contract NoReturnERC20 is MockERC20 {
    function transferFrom(address f, address t, uint256 a) external override returns (bool) {
        require(balanceOf[f] >= a, "balance");
        balanceOf[f] -= a;
        balanceOf[t] += a;
        assembly { return(0, 0) }
    }
}

/// Returns false instead of reverting.
contract FalseReturnERC20 is MockERC20 {
    function transferFrom(address, address, uint256) external pure override returns (bool) {
        return false;
    }
}

contract BatchTransferTest is Test {
    BatchTransfer batcher;
    MockERC20 token;
    address relayer = makeAddr("relayer");
    address attacker = makeAddr("attacker");

    function setUp() public {
        batcher = new BatchTransfer();
        token = new MockERC20();
        token.mint(relayer, 1_000_000e6);
        vm.prank(relayer);
        token.approve(address(batcher), type(uint256).max);
    }

    function _pack(address[] memory r, uint96[] memory a) internal pure returns (bytes memory p) {
        p = new bytes(r.length * 32);
        for (uint256 i; i < r.length; ++i) {
            uint256 word = (uint256(uint160(r[i])) << 96) | uint256(a[i]);
            assembly { mstore(add(add(p, 32), mul(i, 32)), word) }
        }
    }

    function _addrs(uint256 n) internal pure returns (address[] memory r) {
        r = new address[](n);
        for (uint256 i; i < n; ++i) r[i] = address(uint160(i + 0x1000));
    }

    // ------------------------------------------------------------------ happy path

    function test_UnpackedPaysEveryone() public {
        address[] memory r = _addrs(5);
        uint256[] memory a = new uint256[](5);
        for (uint256 i; i < 5; ++i) a[i] = (i + 1) * 1e6;

        vm.prank(relayer);
        batcher.batchTransfer(IERC20(address(token)), r, a);

        for (uint256 i; i < 5; ++i) assertEq(token.balanceOf(r[i]), (i + 1) * 1e6, "recipient");
        assertEq(token.balanceOf(relayer), 1_000_000e6 - 15e6, "relayer debited exactly once");
    }

    function test_PackedMatchesUnpacked() public {
        address[] memory r = _addrs(5);
        uint96[] memory a = new uint96[](5);
        for (uint256 i; i < 5; ++i) a[i] = uint96((i + 1) * 1e6);

        vm.prank(relayer);
        batcher.batchTransferPacked(IERC20(address(token)), _pack(r, a));

        for (uint256 i; i < 5; ++i) assertEq(token.balanceOf(r[i]), (i + 1) * 1e6);
    }

    /// The packed layout must not smear an amount into the neighbouring address.
    function testFuzz_PackedRoundTrip(address to, uint96 amount) public {
        vm.assume(to != address(0) && to != relayer);
        amount = uint96(bound(amount, 1, 1e12));

        address[] memory r = new address[](1);
        uint96[] memory a = new uint96[](1);
        r[0] = to; a[0] = amount;

        vm.prank(relayer);
        batcher.batchTransferPacked(IERC20(address(token)), _pack(r, a));
        assertEq(token.balanceOf(to), amount);
    }

    // -------------------------------------------------------------------- security

    /**
     * The contract holds a max allowance from the relayer. An attacker calling it must
     * only ever be able to move their OWN tokens, because `from` is always msg.sender.
     */
    function test_AttackerCannotSpendRelayerAllowance() public {
        address[] memory r = new address[](1);
        uint256[] memory a = new uint256[](1);
        r[0] = attacker; a[0] = 500e6;

        uint256 relayerBefore = token.balanceOf(relayer);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 0));
        batcher.batchTransfer(IERC20(address(token)), r, a);

        assertEq(token.balanceOf(relayer), relayerBefore, "relayer must be untouched");
        assertEq(token.balanceOf(attacker), 0);
    }

    function test_ContractNeverHoldsCustody() public {
        address[] memory r = _addrs(3);
        uint256[] memory a = new uint256[](3);
        for (uint256 i; i < 3; ++i) a[i] = 1e6;

        vm.prank(relayer);
        batcher.batchTransfer(IERC20(address(token)), r, a);
        assertEq(token.balanceOf(address(batcher)), 0, "no funds may rest in the contract");
    }

    // ---------------------------------------------------------------------- reverts

    function test_RevertsOnLengthMismatch() public {
        vm.prank(relayer);
        vm.expectRevert(BatchTransfer.LengthMismatch.selector);
        batcher.batchTransfer(IERC20(address(token)), _addrs(3), new uint256[](2));
    }

    function test_RevertsOnEmptyBatch() public {
        vm.startPrank(relayer);
        vm.expectRevert(BatchTransfer.EmptyBatch.selector);
        batcher.batchTransfer(IERC20(address(token)), new address[](0), new uint256[](0));
        vm.expectRevert(BatchTransfer.EmptyBatch.selector);
        batcher.batchTransferPacked(IERC20(address(token)), "");
        vm.stopPrank();
    }

    function test_RevertsOnMalformedPayload() public {
        vm.prank(relayer);
        vm.expectRevert(BatchTransfer.MalformedPayload.selector);
        batcher.batchTransferPacked(IERC20(address(token)), new bytes(33));
    }

    /// The failing index is what lets the relayer quarantine one payout and retry the rest.
    function test_ReportsFailingIndex() public {
        address[] memory r = _addrs(4);
        uint256[] memory a = new uint256[](4);
        for (uint256 i; i < 4; ++i) a[i] = 1e6;
        token.block_(r[2]);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 2));
        batcher.batchTransfer(IERC20(address(token)), r, a);
    }

    function test_AcceptsTokensThatReturnNothing() public {
        NoReturnERC20 t = new NoReturnERC20();
        t.mint(relayer, 100e6);
        address[] memory r = _addrs(2);
        uint256[] memory a = new uint256[](2);
        a[0] = 1e6; a[1] = 2e6;

        vm.prank(relayer);
        batcher.batchTransfer(IERC20(address(t)), r, a);
        assertEq(t.balanceOf(r[1]), 2e6);
    }

    function test_RejectsTokensThatReturnFalse() public {
        FalseReturnERC20 t = new FalseReturnERC20();
        address[] memory r = _addrs(1);
        uint256[] memory a = new uint256[](1);
        a[0] = 1e6;

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 0));
        batcher.batchTransfer(IERC20(address(t)), r, a);
    }
}
