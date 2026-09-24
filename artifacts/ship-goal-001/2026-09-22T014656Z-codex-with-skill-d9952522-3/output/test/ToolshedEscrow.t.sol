// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "./Test.sol";
import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

contract ToolshedEscrowTest is Test {
    MockUSDC private usdc;
    ToolshedEscrow private escrow;

    address private association = address(0xA11CE);
    address private owner = address(0xB0B);
    address private borrower = address(0xCAFE);
    address private outsider = address(0xBAD);

    bytes32 private toolId = keccak256("cordless-drill-42");
    uint256 private deposit = 75e6;
    uint256 private dailyLateFee = 8e6;
    uint64 private startAt;
    uint64 private dueAt;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new ToolshedEscrow(usdc, association);
        startAt = uint64(block.timestamp + 1 hours);
        dueAt = uint64(startAt + 3 days);

        vm.startPrank(association);
        escrow.setMember(owner, true);
        escrow.setMember(borrower, true);
        vm.stopPrank();

        usdc.mint(borrower, 1_000e6);
        vm.prank(borrower);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function testMemberCanRequestAndOwnerCanAccept() public {
        uint256 loanId = _createRequest();

        assertEq(usdc.balanceOf(address(escrow)), deposit);

        vm.prank(owner);
        escrow.acceptRequest(loanId);

        (, , , , , , , , , ToolshedEscrow.LoanStatus status) = escrow.loans(loanId);
        assertEq(uint256(status), uint256(ToolshedEscrow.LoanStatus.Active));
    }

    function testOnTimeReturnRefundsDepositAndRecordsStats() public {
        uint256 loanId = _activeLoan();

        vm.warp(dueAt - 10 minutes);
        vm.prank(borrower);
        escrow.markReturned(loanId);

        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(borrower), 1_000e6);
        assertEq(usdc.balanceOf(owner), 0);

        (uint64 loansBorrowed, , uint64 lateReturns, , ) = escrow.memberStats(borrower);
        (, uint64 loansLent, , , ) = escrow.memberStats(owner);
        assertEq(loansBorrowed, 1);
        assertEq(loansLent, 1);
        assertEq(lateReturns, 0);
    }

    function testLateReturnPaysDailyFeeToOwner() public {
        uint256 loanId = _activeLoan();

        vm.warp(dueAt + 1 days);
        vm.prank(borrower);
        escrow.markReturned(loanId);

        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(owner), dailyLateFee);
        assertEq(usdc.balanceOf(borrower), 1_000e6 - dailyLateFee);

        (uint64 loansBorrowed, , uint64 lateReturns, uint256 lateFeesPaid, ) = escrow.memberStats(borrower);
        (, uint64 loansLent, , , uint256 lateFeesEarned) = escrow.memberStats(owner);
        assertEq(loansBorrowed, 1);
        assertEq(loansLent, 1);
        assertEq(lateReturns, 1);
        assertEq(lateFeesPaid, dailyLateFee);
        assertEq(lateFeesEarned, dailyLateFee);
    }

    function testBorrowerCanClaimRefundAfterOwnerReviewWindow() public {
        uint256 loanId = _activeLoan();

        vm.warp(dueAt);
        vm.prank(borrower);
        escrow.markReturned(loanId);

        vm.warp(block.timestamp + escrow.REVIEW_PERIOD());
        vm.prank(borrower);
        escrow.claimRefundAfterReview(loanId);

        assertEq(usdc.balanceOf(borrower), 1_000e6);
    }

    function testOwnerCanClaimDepositWhenLateFeesReachDeposit() public {
        uint256 loanId = _activeLoan();

        uint256 daysToConsumeDeposit = (deposit + dailyLateFee - 1) / dailyLateFee;
        vm.warp(dueAt + (daysToConsumeDeposit * 1 days));

        vm.prank(owner);
        escrow.claimOverdueDeposit(loanId);

        assertEq(usdc.balanceOf(owner), deposit);
        assertEq(usdc.balanceOf(borrower), 1_000e6 - deposit);
    }

    function testOutsiderCannotCreateRequest() public {
        usdc.mint(outsider, deposit);
        vm.prank(outsider);
        usdc.approve(address(escrow), deposit);

        vm.expectRevert(ToolshedEscrow.NotMember.selector);
        vm.prank(outsider);
        escrow.createRequest(toolId, owner, startAt, dueAt, deposit, dailyLateFee, "ipfs://listing");
    }

    function testOwnerCannotAcceptAfterStartTime() public {
        uint256 loanId = _createRequest();

        vm.warp(startAt + 1);
        vm.expectRevert(ToolshedEscrow.InvalidLoan.selector);
        vm.prank(owner);
        escrow.acceptRequest(loanId);
    }

    function _activeLoan() private returns (uint256 loanId) {
        loanId = _createRequest();
        vm.prank(owner);
        escrow.acceptRequest(loanId);
    }

    function _createRequest() private returns (uint256 loanId) {
        vm.prank(borrower);
        loanId = escrow.createRequest(toolId, owner, startAt, dueAt, deposit, dailyLateFee, "ipfs://listing");
    }
}
