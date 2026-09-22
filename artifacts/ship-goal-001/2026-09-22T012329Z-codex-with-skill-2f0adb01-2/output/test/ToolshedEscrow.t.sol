// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";

contract ToolshedEscrowTest is Test {
    MockUSDC internal usdc;
    ToolshedEscrow internal escrow;

    address internal owner = address(0xA11CE);
    address internal borrower = address(0xB0B);
    address internal stranger = address(0xE0E);

    uint256 internal constant DEPOSIT = 75e6;
    uint256 internal constant LATE_FEE = 10e6;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new ToolshedEscrow(usdc, owner);

        vm.prank(owner);
        escrow.setMember(borrower, true);

        usdc.mint(borrower, 500e6);
        vm.prank(borrower);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_RequestApproveAndOnTimeReturnRefundsDeposit() public {
        uint256 toolId = _listDrill();

        vm.prank(borrower);
        uint256 loanId = escrow.requestLoan(toolId, 3);

        vm.prank(owner);
        escrow.approveLoan(loanId);

        vm.warp(block.timestamp + 3 days);
        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(borrower), 500e6);
        assertEq(usdc.balanceOf(owner), 0);

        (uint64 completedLoans, uint64 lateReturns) = escrow.memberStats(borrower);
        assertEq(completedLoans, 1);
        assertEq(lateReturns, 0);
        assertEq(escrow.reliabilityBps(borrower), 10_000);
    }

    function test_LateReturnPaysOwnerAndMarksBorrowerLate() public {
        uint256 loanId = _activeLoan(2);

        vm.warp(block.timestamp + 2 days + 1 seconds);
        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(owner), LATE_FEE);
        assertEq(usdc.balanceOf(borrower), 500e6 - LATE_FEE);

        (uint64 completedLoans, uint64 lateReturns) = escrow.memberStats(borrower);
        assertEq(completedLoans, 1);
        assertEq(lateReturns, 1);
        assertEq(escrow.reliabilityBps(borrower), 0);
    }

    function test_LateFeeIsCappedAtDeposit() public {
        uint256 loanId = _activeLoan(1);

        vm.warp(block.timestamp + 30 days);
        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(owner), DEPOSIT);
        assertEq(usdc.balanceOf(borrower), 500e6 - DEPOSIT);
    }

    function test_OwnerCanCancelPendingLoanAndRefundBorrower() public {
        uint256 toolId = _listDrill();

        vm.prank(borrower);
        uint256 loanId = escrow.requestLoan(toolId, 4);

        vm.prank(owner);
        escrow.cancelPendingLoan(loanId);

        assertEq(usdc.balanceOf(borrower), 500e6);
        (, , , , , , , , , ToolshedEscrow.LoanState state) = escrow.loans(loanId);
        assertEq(uint256(state), uint256(ToolshedEscrow.LoanState.Cancelled));
    }

    function test_RevertWhen_NonOwnerApprovesOrConfirms() public {
        uint256 loanId = _pendingLoan(2);

        vm.prank(stranger);
        vm.expectRevert(ToolshedEscrow.NotToolOwner.selector);
        escrow.approveLoan(loanId);

        vm.prank(owner);
        escrow.approveLoan(loanId);

        vm.prank(stranger);
        vm.expectRevert(ToolshedEscrow.NotToolOwner.selector);
        escrow.confirmReturn(loanId);
    }

    function test_RevertWhen_RequestExceedsMaxDays() public {
        uint256 toolId = _listDrill();

        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.InvalidLoanDays.selector);
        escrow.requestLoan(toolId, 15);
    }

    function test_RevertWhen_NonMemberListsOrBorrows() public {
        vm.prank(stranger);
        vm.expectRevert(ToolshedEscrow.NotMember.selector);
        escrow.listTool("ipfs://saw-metadata", DEPOSIT, LATE_FEE, 7);

        uint256 toolId = _listDrill();
        vm.prank(stranger);
        vm.expectRevert(ToolshedEscrow.NotMember.selector);
        escrow.requestLoan(toolId, 2);
    }

    function testFuzz_LateFeeNeverExceedsDeposit(uint16 lateDays) public {
        lateDays = uint16(bound(lateDays, 0, 365));
        uint256 loanId = _activeLoan(1);

        vm.warp(block.timestamp + 1 days + uint256(lateDays) * 1 days + 1 seconds);
        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertLe(usdc.balanceOf(owner), DEPOSIT);
        assertEq(usdc.balanceOf(owner) + usdc.balanceOf(borrower), 500e6);
    }

    function _listDrill() internal returns (uint256 toolId) {
        vm.prank(owner);
        toolId = escrow.listTool("ipfs://drill-metadata", DEPOSIT, LATE_FEE, 14);
    }

    function _pendingLoan(uint16 daysRequested) internal returns (uint256 loanId) {
        uint256 toolId = _listDrill();
        vm.prank(borrower);
        loanId = escrow.requestLoan(toolId, daysRequested);
    }

    function _activeLoan(uint16 daysRequested) internal returns (uint256 loanId) {
        loanId = _pendingLoan(daysRequested);
        vm.prank(owner);
        escrow.approveLoan(loanId);
    }
}
