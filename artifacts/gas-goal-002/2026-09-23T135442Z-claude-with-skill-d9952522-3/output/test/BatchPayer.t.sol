// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchPayer, IERC20} from "../src/BatchPayer.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public returnsNothing;
    address public revertOn;

    function setReturnsNothing(bool v) external { returnsNothing = v; }
    function setRevertOn(address a) external { revertOn = a; }
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }

    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        require(t != revertOn, "blocked");
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[t] += a;
        if (returnsNothing) assembly { return(0, 0) }
        return true;
    }
}

contract BatchPayerTest is Test {
    BatchPayer payer;
    MockToken token;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        token = new MockToken();
        payer = new BatchPayer(owner);
        token.mint(owner, 1_000e6);
        vm.prank(owner);
        token.approve(address(payer), type(uint256).max);
    }

    function _two(address a, address b) internal pure returns (address[] memory r) {
        r = new address[](2);
        r[0] = a; r[1] = b;
    }

    function _amts(uint256 x, uint256 y) internal pure returns (uint256[] memory a) {
        a = new uint256[](2);
        a[0] = x; a[1] = y;
    }

    function test_paysEachRecipient() public {
        vm.prank(owner);
        payer.pay(IERC20(address(token)), _two(alice, bob), _amts(10, 25));
        assertEq(token.balanceOf(alice), 10);
        assertEq(token.balanceOf(bob), 25);
        assertEq(token.balanceOf(owner), 1_000e6 - 35);
    }

    function test_payUniformPaysSameAmount() public {
        vm.prank(owner);
        payer.payUniform(IERC20(address(token)), _two(alice, bob), 7);
        assertEq(token.balanceOf(alice), 7);
        assertEq(token.balanceOf(bob), 7);
    }

    function test_onlyOwnerCanPay() public {
        vm.prank(alice);
        vm.expectRevert(BatchPayer.NotOwner.selector);
        payer.pay(IERC20(address(token)), _two(alice, bob), _amts(1, 1));

        vm.prank(alice);
        vm.expectRevert(BatchPayer.NotOwner.selector);
        payer.payUniform(IERC20(address(token)), _two(alice, bob), 1);
    }

    /// Funds are pulled from `owner`, never from whoever calls, so a stolen
    /// relayer key cannot be used to drain a third party's approval.
    function test_fundsAlwaysComeFromOwner() public {
        token.mint(alice, 500);
        vm.prank(alice);
        token.approve(address(payer), type(uint256).max);
        vm.prank(owner);
        payer.pay(IERC20(address(token)), _two(bob, bob), _amts(1, 1));
        assertEq(token.balanceOf(alice), 500, "alice must be untouched");
    }

    function test_revertsOnLengthMismatch() public {
        address[] memory r = new address[](3);
        vm.prank(owner);
        vm.expectRevert(BatchPayer.LengthMismatch.selector);
        payer.pay(IERC20(address(token)), r, _amts(1, 1));
    }

    /// A failed leg must roll the whole batch back, so operations never has to
    /// reconcile a half-applied payout run.
    function test_batchIsAllOrNothing() public {
        token.setRevertOn(bob);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchPayer.TransferFailed.selector, 1));
        payer.pay(IERC20(address(token)), _two(alice, bob), _amts(10, 10));
        assertEq(token.balanceOf(alice), 0, "alice leg must be rolled back");
        assertEq(token.balanceOf(owner), 1_000e6);
    }

    /// USDT-style tokens return no data on success; that must count as success.
    function test_acceptsTokensThatReturnNoData() public {
        token.setReturnsNothing(true);
        vm.prank(owner);
        payer.pay(IERC20(address(token)), _two(alice, bob), _amts(3, 4));
        assertEq(token.balanceOf(alice), 3);
        assertEq(token.balanceOf(bob), 4);
    }

    function test_emptyBatchIsNoop() public {
        vm.prank(owner);
        payer.pay(IERC20(address(token)), new address[](0), new uint256[](0));
        assertEq(token.balanceOf(owner), 1_000e6);
    }
}
