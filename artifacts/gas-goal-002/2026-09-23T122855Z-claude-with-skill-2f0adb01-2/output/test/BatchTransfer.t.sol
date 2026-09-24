// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BatchTransfer, IERC20} from "../src/BatchTransfer.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public returnsNothing;
    bool public failNext;

    function setReturnsNothing(bool v) external { returnsNothing = v; }
    function setFailNext(bool v) external { failNext = v; }
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }

    function transferFrom(address from, address to, uint256 a) external returns (bool) {
        if (failNext) { failNext = false; return false; }
        require(balanceOf[from] >= a, "balance");
        uint256 al = allowance[from][msg.sender];
        require(al >= a, "allowance");
        if (al != type(uint256).max) allowance[from][msg.sender] = al - a;
        balanceOf[from] -= a;
        balanceOf[to] += a;
        if (returnsNothing) assembly { return(0, 0) }
        return true;
    }
}

/// A token that returns nothing at all from transferFrom, USDT-style.
contract SilentERC20 {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function transferFrom(address from, address to, uint256 a) external {
        balanceOf[from] -= a;
        balanceOf[to] += a;
    }
}

contract BatchTransferTest is Test {
    BatchTransfer batcher;
    MockERC20 token;
    address owner = makeAddr("owner");
    address outsider = makeAddr("outsider");

    function setUp() public {
        token = new MockERC20();
        batcher = new BatchTransfer(owner);
        token.mint(owner, 1_000_000e6);
        vm.prank(owner);
        token.approve(address(batcher), type(uint256).max);
    }

    function _rs(uint256 n) internal pure returns (address[] memory r) {
        r = new address[](n);
        for (uint256 i; i < n; ++i) r[i] = address(uint160(uint256(keccak256(abi.encode(i))) | 1));
    }

    function _as(uint256 n, uint256 v) internal pure returns (uint256[] memory a) {
        a = new uint256[](n);
        for (uint256 i; i < n; ++i) a[i] = v;
    }

    function test_disperse_movesEveryAmount() public {
        address[] memory r = _rs(5);
        uint256[] memory a = _as(5, 7e6);
        vm.prank(owner);
        batcher.disperse(IERC20(address(token)), r, a);
        for (uint256 i; i < 5; ++i) assertEq(token.balanceOf(r[i]), 7e6);
        assertEq(token.balanceOf(owner), 1_000_000e6 - 35e6);
    }

    function test_dispersePacked_matchesDisperse() public {
        address[] memory r = _rs(5);
        uint256[] memory e = new uint256[](5);
        for (uint256 i; i < 5; ++i) e[i] = batcher.packEntry(r[i], 7e6);
        vm.prank(owner);
        batcher.dispersePacked(IERC20(address(token)), e);
        for (uint256 i; i < 5; ++i) assertEq(token.balanceOf(r[i]), 7e6);
    }

    function testFuzz_packRoundTrips(address to, uint96 amount) public view {
        uint256 packed = batcher.packEntry(to, amount);
        assertEq(address(uint160(packed >> 96)), to);
        assertEq(packed & type(uint96).max, amount);
    }

    function test_packEntry_rejectsOversizedAmount() public {
        vm.expectRevert("amount > 96 bits");
        batcher.packEntry(address(1), uint256(type(uint96).max) + 1);
    }

    /// The approval granted to this contract must not be spendable by anyone else.
    function test_onlyOwnerCanDisperse() public {
        address[] memory r = _rs(1);
        uint256[] memory a = _as(1, 1e6);
        vm.prank(outsider);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        batcher.disperse(IERC20(address(token)), r, a);

        uint256[] memory e = new uint256[](1);
        e[0] = batcher.packEntry(r[0], 1e6);
        vm.prank(outsider);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        batcher.dispersePacked(IERC20(address(token)), e);
    }

    function test_lengthMismatchReverts() public {
        vm.prank(owner);
        vm.expectRevert(BatchTransfer.LengthMismatch.selector);
        batcher.disperse(IERC20(address(token)), _rs(3), _as(2, 1e6));
    }

    function test_emptyBatchReverts() public {
        vm.prank(owner);
        vm.expectRevert(BatchTransfer.EmptyBatch.selector);
        batcher.disperse(IERC20(address(token)), _rs(0), _as(0, 0));
        vm.prank(owner);
        vm.expectRevert(BatchTransfer.EmptyBatch.selector);
        batcher.dispersePacked(IERC20(address(token)), new uint256[](0));
    }

    /// The whole batch must revert if any single transfer fails, so a partially
    /// paid batch can never be recorded as settled.
    function test_oneFailureRevertsWholeBatch() public {
        address[] memory r = _rs(3);
        uint256[] memory a = _as(3, 1e6);
        token.setFailNext(true);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 0));
        batcher.disperse(IERC20(address(token)), r, a);
        assertEq(token.balanceOf(r[1]), 0);
    }

    function test_insufficientBalanceRevertsWholeBatch() public {
        address[] memory r = _rs(2);
        uint256[] memory a = _as(2, 10_000_000e6);
        vm.prank(owner);
        vm.expectRevert();
        batcher.disperse(IERC20(address(token)), r, a);
    }

    /// Tokens that return no data at all (USDT-style) must still work.
    function test_silentTokenAccepted() public {
        SilentERC20 silent = new SilentERC20();
        silent.mint(owner, 100e6);
        address[] memory r = _rs(2);
        vm.prank(owner);
        batcher.disperse(IERC20(address(silent)), r, _as(2, 5e6));
        assertEq(silent.balanceOf(r[0]), 5e6);
        assertEq(silent.balanceOf(r[1]), 5e6);
    }

    function test_ownershipTransfer() public {
        address next = makeAddr("next");
        vm.prank(outsider);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        batcher.setOwner(next);

        vm.prank(owner);
        batcher.setOwner(next);
        assertEq(batcher.owner(), next);

        vm.prank(owner);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        batcher.setOwner(owner);
    }

    function test_rejectsZeroAddressOwner() public {
        vm.expectRevert(BatchTransfer.ZeroAddress.selector);
        new BatchTransfer(address(0));
        vm.prank(owner);
        vm.expectRevert(BatchTransfer.ZeroAddress.selector);
        batcher.setOwner(address(0));
    }
}
