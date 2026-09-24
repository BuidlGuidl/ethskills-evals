// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BatchPay, IERC20} from "../src/BatchPay.sol";
import {MockERC20, FalseReturningERC20} from "./mocks/MockERC20.sol";

contract BatchPayTest is Test {
    BatchPay pay;
    MockERC20 token;
    address owner = makeAddr("owner");
    address relayer = makeAddr("relayer");
    address stranger = makeAddr("stranger");

    event PaymentSkipped(address indexed token, address indexed to, uint256 amount, uint256 index);
    event BatchPaid(address indexed token, uint256 count, uint256 total);

    function setUp() public {
        pay = new BatchPay(owner, relayer);
        token = new MockERC20();
        token.mint(address(pay), 1_000_000e6);
        token.mint(relayer, 1_000_000e6);
        vm.prank(relayer);
        token.approve(address(pay), type(uint256).max);
    }

    function _pack(address[] memory to, uint256[] memory amt) internal pure returns (bytes memory p) {
        for (uint256 i; i < to.length; ++i) p = abi.encodePacked(p, bytes20(to[i]), bytes12(uint96(amt[i])));
    }

    function _two(address a, address b, uint256 x, uint256 y)
        internal pure returns (address[] memory to, uint256[] memory amt)
    {
        to = new address[](2); amt = new uint256[](2);
        to[0] = a; to[1] = b; amt[0] = x; amt[1] = y;
    }

    /* --------------------------------------------------------------- payouts */

    function test_PayFromBalance_Arrays() public {
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 10e6, 25e6);
        vm.prank(relayer);
        pay.payFromBalance(IERC20(address(token)), to, amt);
        assertEq(token.balanceOf(address(1)), 10e6);
        assertEq(token.balanceOf(address(2)), 25e6);
    }

    function test_PayFromBalance_Packed() public {
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 10e6, 25e6);
        vm.prank(relayer);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to, amt));
        assertEq(token.balanceOf(address(1)), 10e6);
        assertEq(token.balanceOf(address(2)), 25e6);
        assertEq(token.balanceOf(address(pay)), 1_000_000e6 - 35e6);
    }

    function test_PayFromRelayer_Packed_LeavesFloatUntouched() public {
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 10e6, 25e6);
        vm.prank(relayer);
        pay.payFromRelayerPacked(IERC20(address(token)), _pack(to, amt));
        assertEq(token.balanceOf(address(1)), 10e6);
        assertEq(token.balanceOf(relayer), 1_000_000e6 - 35e6);
        assertEq(token.balanceOf(address(pay)), 1_000_000e6);
    }

    function test_PackedAndArrays_ProduceIdenticalResult() public {
        (address[] memory to, uint256[] memory amt) = _two(address(11), address(12), 7e6, 9e6);
        vm.prank(relayer);
        pay.payFromBalance(IERC20(address(token)), to, amt);
        uint256 a1 = token.balanceOf(address(11));

        (address[] memory to2, uint256[] memory amt2) = _two(address(21), address(22), 7e6, 9e6);
        vm.prank(relayer);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to2, amt2));
        assertEq(token.balanceOf(address(21)), a1);
    }

    /* ---------------------------------------------------------- authorisation */

    function test_RevertWhen_NotRelayer() public {
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 1e6, 1e6);
        vm.prank(stranger);
        vm.expectRevert(BatchPay.Unauthorized.selector);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to, amt));
    }

    function test_RevertWhen_OwnerIsNotRelayer() public {
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 1e6, 1e6);
        vm.prank(owner);
        vm.expectRevert(BatchPay.Unauthorized.selector);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to, amt));
    }

    function test_RevertWhen_StrangerSetsRelayer() public {
        vm.prank(stranger);
        vm.expectRevert(BatchPay.Unauthorized.selector);
        pay.setRelayer(stranger, true);
    }

    function test_OwnerCanRotateRelayer() public {
        address fresh = makeAddr("fresh");
        vm.startPrank(owner);
        pay.setRelayer(relayer, false);
        pay.setRelayer(fresh, true);
        vm.stopPrank();

        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 1e6, 1e6);
        vm.prank(relayer);
        vm.expectRevert(BatchPay.Unauthorized.selector);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to, amt));

        vm.prank(fresh);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to, amt));
        assertEq(token.balanceOf(address(1)), 1e6);
    }

    /* ------------------------------------------------------- payload validation */

    function test_RevertWhen_LengthMismatch() public {
        address[] memory to = new address[](2);
        uint256[] memory amt = new uint256[](1);
        vm.prank(relayer);
        vm.expectRevert(BatchPay.LengthMismatch.selector);
        pay.payFromBalance(IERC20(address(token)), to, amt);
    }

    function test_RevertWhen_PayloadEmpty() public {
        vm.prank(relayer);
        vm.expectRevert(BatchPay.BadPayload.selector);
        pay.payFromBalancePacked(IERC20(address(token)), "");
    }

    function test_RevertWhen_PayloadMisaligned() public {
        vm.prank(relayer);
        vm.expectRevert(BatchPay.BadPayload.selector);
        pay.payFromBalancePacked(IERC20(address(token)), new bytes(33));
    }

    /* ------------------------------------------------------- failure handling */

    function test_StrictBatch_RevertsOnBlacklistedPayee() public {
        token.setBlacklisted(address(2), true);
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 10e6, 25e6);
        vm.prank(relayer);
        vm.expectRevert();
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to, amt));
        assertEq(token.balanceOf(address(1)), 0, "strict batch must be all-or-nothing");
    }

    function test_LenientBatch_SkipsBlacklistedPayeeAndPaysTheRest() public {
        token.setBlacklisted(address(2), true);
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 10e6, 25e6);

        vm.expectEmit(true, true, true, true);
        emit PaymentSkipped(address(token), address(2), 25e6, 1);

        vm.prank(relayer);
        uint256 failures = pay.payFromBalancePackedLenient(IERC20(address(token)), _pack(to, amt));

        assertEq(failures, 1);
        assertEq(token.balanceOf(address(1)), 10e6, "good payee must still be paid");
        assertEq(token.balanceOf(address(2)), 0);
    }

    function test_RevertWhen_TokenReturnsFalse() public {
        FalseReturningERC20 bad = new FalseReturningERC20();
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 1e6, 1e6);
        vm.prank(relayer);
        vm.expectRevert();
        pay.payFromBalancePacked(IERC20(address(bad)), _pack(to, amt));
    }

    function test_TokenReturningNoData_IsAccepted() public {
        token.setReturnsNothing(true);
        (address[] memory to, uint256[] memory amt) = _two(address(1), address(2), 10e6, 25e6);
        vm.prank(relayer);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(to, amt));
        assertEq(token.balanceOf(address(1)), 10e6);
    }

    /* ------------------------------------------------------------- management */

    function test_SweepRecoversEntireFloat() public {
        vm.prank(owner);
        pay.sweep(IERC20(address(token)), owner, 0);
        assertEq(token.balanceOf(address(pay)), 0);
        assertEq(token.balanceOf(owner), 1_000_000e6);
    }

    function test_RevertWhen_StrangerSweeps() public {
        vm.prank(stranger);
        vm.expectRevert(BatchPay.Unauthorized.selector);
        pay.sweep(IERC20(address(token)), stranger, 0);
    }

    /* ------------------------------------------------------------------ fuzz */

    /// @dev The packed encoding must round-trip any recipient and any amount that
    ///      fits in 12 bytes, which is the invariant the client-side builder relies on.
    function testFuzz_PackedRoundTrip(address to, uint96 amount) public {
        vm.assume(to != address(0) && to != address(pay));
        amount = uint96(bound(amount, 1, 1_000e6));
        address[] memory t = new address[](1);
        uint256[] memory a = new uint256[](1);
        t[0] = to; a[0] = amount;
        uint256 before = token.balanceOf(to);
        vm.prank(relayer);
        pay.payFromBalancePacked(IERC20(address(token)), _pack(t, a));
        assertEq(token.balanceOf(to) - before, amount);
    }
}
