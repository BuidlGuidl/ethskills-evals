// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Toolshed } from "../contracts/Toolshed.sol";
import { MockUSDC } from "./MockUSDC.sol";

contract ToolshedTest is Test {
    Toolshed internal shed;
    MockUSDC internal usdc;

    address internal steward = makeAddr("steward");
    address internal alice = makeAddr("alice"); // tool owner
    address internal bob = makeAddr("bob"); // borrower
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    uint96 internal constant DEPOSIT = 60e6; // 60 USDC
    uint96 internal constant FEE_PER_DAY = 2e6; // 2 USDC/day
    uint32 internal constant MAX_DAYS = 14;
    string internal constant URI = "ipfs://bafyToolMetadata";

    function setUp() public {
        usdc = new MockUSDC();
        shed = new Toolshed(IERC20(address(usdc)), steward);

        address[] memory roster = new address[](3);
        roster[0] = alice;
        roster[1] = bob;
        roster[2] = carol;
        vm.prank(steward);
        shed.admitMembers(roster);

        usdc.mint(bob, 1000e6);
        usdc.mint(carol, 1000e6);
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    function _listTool() internal returns (uint256 toolId) {
        vm.prank(alice);
        toolId = shed.listTool(URI, DEPOSIT, FEE_PER_DAY, MAX_DAYS);
    }

    function _request(address borrower, uint256 toolId, uint16 durationDays) internal returns (uint256 loanId) {
        vm.startPrank(borrower);
        usdc.approve(address(shed), DEPOSIT);
        loanId = shed.requestLoan(toolId, durationDays);
        vm.stopPrank();
    }

    function _activeLoan(uint16 durationDays) internal returns (uint256 toolId, uint256 loanId) {
        toolId = _listTool();
        loanId = _request(bob, toolId, durationDays);
        vm.prank(alice);
        shed.approveRequest(loanId);
    }

    // ------------------------------------------------------------------
    // roster
    // ------------------------------------------------------------------

    function test_OnlyStewardAdmits() public {
        bytes32 role = shed.STEWARD_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, role)
        );
        shed.admitMember(stranger);
    }

    function test_NonMemberCannotListOrBorrow() public {
        uint256 toolId = _listTool();

        vm.prank(stranger);
        vm.expectRevert(Toolshed.NotAMember.selector);
        shed.listTool(URI, DEPOSIT, FEE_PER_DAY, MAX_DAYS);

        vm.startPrank(stranger);
        usdc.mint(stranger, DEPOSIT);
        usdc.approve(address(shed), DEPOSIT);
        vm.expectRevert(Toolshed.NotAMember.selector);
        shed.requestLoan(toolId, 3);
        vm.stopPrank();
    }

    function test_ReadmittingKeepsTrackRecordAndRosterSlot() public {
        vm.prank(steward);
        shed.removeMember(bob);
        vm.prank(steward);
        shed.admitMember(bob);

        assertEq(shed.memberCount(), 3, "no duplicate roster entry");
        assertTrue(shed.getMember(bob).active);
    }

    function test_RemovedMemberCanStillSettleRunningLoan() public {
        (, uint256 loanId) = _activeLoan(3);

        vm.prank(steward);
        shed.removeMember(bob);

        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(bob), 1000e6, "deposit refunded in full");
    }

    // ------------------------------------------------------------------
    // listing
    // ------------------------------------------------------------------

    function test_ListToolRejectsBadTerms() public {
        uint32 tooManyDays = uint32(shed.MAX_LOAN_DAYS()) + 1;
        vm.startPrank(alice);
        vm.expectRevert(Toolshed.BadTerms.selector);
        shed.listTool(URI, 0, FEE_PER_DAY, MAX_DAYS);

        vm.expectRevert(Toolshed.BadTerms.selector); // fee must be non-zero
        shed.listTool(URI, DEPOSIT, 0, MAX_DAYS);

        vm.expectRevert(Toolshed.BadTerms.selector); // fee must not exceed the deposit
        shed.listTool(URI, DEPOSIT, DEPOSIT + 1, MAX_DAYS);

        vm.expectRevert(Toolshed.BadTerms.selector);
        shed.listTool("", DEPOSIT, FEE_PER_DAY, MAX_DAYS);

        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.listTool(URI, DEPOSIT, FEE_PER_DAY, 0);

        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.listTool(URI, DEPOSIT, FEE_PER_DAY, tooManyDays);
        vm.stopPrank();
    }

    function test_OnlyOwnerEditsListing() public {
        uint256 toolId = _listTool();
        vm.prank(bob);
        vm.expectRevert(Toolshed.NotToolOwner.selector);
        shed.updateTool(toolId, URI, DEPOSIT, FEE_PER_DAY, MAX_DAYS);

        vm.prank(bob);
        vm.expectRevert(Toolshed.NotToolOwner.selector);
        shed.setToolAvailability(toolId, false);
    }

    function test_CannotBorrowUnavailableOrRetiredTool() public {
        uint256 toolId = _listTool();

        vm.prank(alice);
        shed.setToolAvailability(toolId, false);
        vm.startPrank(bob);
        usdc.approve(address(shed), DEPOSIT);
        vm.expectRevert(Toolshed.ToolUnavailable.selector);
        shed.requestLoan(toolId, 3);
        vm.stopPrank();

        vm.startPrank(alice);
        shed.setToolAvailability(toolId, true);
        shed.retireTool(toolId);
        vm.stopPrank();
        vm.startPrank(bob);
        vm.expectRevert(Toolshed.ToolUnavailable.selector);
        shed.requestLoan(toolId, 3);
        vm.stopPrank();
    }

    function test_CannotRetireToolThatIsOut() public {
        (uint256 toolId,) = _activeLoan(2);
        vm.prank(alice);
        vm.expectRevert(Toolshed.ToolUnavailable.selector);
        shed.retireTool(toolId);
    }

    function test_EditingListingDoesNotChangeAgreedTerms() public {
        (uint256 toolId, uint256 loanId) = _activeLoan(2);

        vm.prank(alice);
        shed.updateTool(toolId, URI, 500e6, 100e6, MAX_DAYS);

        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertEq(l.deposit, DEPOSIT);
        assertEq(l.feePerDay, FEE_PER_DAY);
    }

    // ------------------------------------------------------------------
    // request lifecycle
    // ------------------------------------------------------------------

    function test_RequestEscrowsDepositAndReservesTool() public {
        uint256 toolId = _listTool();
        uint256 loanId = _request(bob, toolId, 3);

        assertEq(usdc.balanceOf(address(shed)), DEPOSIT, "deposit escrowed");
        assertEq(usdc.balanceOf(bob), 1000e6 - DEPOSIT);
        assertEq(shed.getTool(toolId).activeLoanId, loanId, "tool reserved");
        assertEq(shed.getMember(bob).openBorrows, 1);

        vm.startPrank(carol);
        usdc.approve(address(shed), DEPOSIT);
        vm.expectRevert(Toolshed.ToolUnavailable.selector);
        shed.requestLoan(toolId, 3);
        vm.stopPrank();
    }

    function test_CannotBorrowOwnTool() public {
        uint256 toolId = _listTool();
        usdc.mint(alice, DEPOSIT);
        vm.startPrank(alice);
        usdc.approve(address(shed), DEPOSIT);
        vm.expectRevert(Toolshed.CannotBorrowOwnTool.selector);
        shed.requestLoan(toolId, 3);
        vm.stopPrank();
    }

    function test_RequestRejectsZeroAndOverlongDurations() public {
        uint256 toolId = _listTool();
        vm.startPrank(bob);
        usdc.approve(address(shed), DEPOSIT);
        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.requestLoan(toolId, 0);
        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.requestLoan(toolId, uint16(MAX_DAYS) + 1);
        vm.stopPrank();
    }

    function test_DeclineRefundsBorrower() public {
        uint256 toolId = _listTool();
        uint256 loanId = _request(bob, toolId, 3);

        vm.prank(bob);
        vm.expectRevert(Toolshed.NotToolOwner.selector);
        shed.declineRequest(loanId);

        vm.prank(alice);
        shed.declineRequest(loanId);

        assertEq(usdc.balanceOf(bob), 1000e6);
        assertEq(shed.getTool(toolId).activeLoanId, 0, "tool freed");
        assertEq(shed.getMember(bob).openBorrows, 0);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Declined));
    }

    function test_CancelRefundsBorrower() public {
        uint256 toolId = _listTool();
        uint256 loanId = _request(bob, toolId, 3);

        vm.prank(carol);
        vm.expectRevert(Toolshed.NotBorrower.selector);
        shed.cancelRequest(loanId);

        vm.prank(bob);
        shed.cancelRequest(loanId);
        assertEq(usdc.balanceOf(bob), 1000e6);
    }

    function test_AnyoneCanExpireAnUnansweredRequest() public {
        uint256 toolId = _listTool();
        uint256 loanId = _request(bob, toolId, 3);

        vm.prank(stranger);
        vm.expectRevert(Toolshed.TooSoon.selector);
        shed.expireRequest(loanId);

        vm.warp(block.timestamp + shed.REQUEST_EXPIRY());
        vm.prank(stranger); // permissionless: an absent owner can't sit on the money
        shed.expireRequest(loanId);

        assertEq(usdc.balanceOf(bob), 1000e6);
        assertEq(shed.getTool(toolId).activeLoanId, 0);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Expired));
    }

    function test_CannotApproveTwiceOrByStranger() public {
        uint256 toolId = _listTool();
        uint256 loanId = _request(bob, toolId, 3);

        vm.prank(stranger);
        vm.expectRevert(Toolshed.NotToolOwner.selector);
        shed.approveRequest(loanId);

        vm.startPrank(alice);
        shed.approveRequest(loanId);
        vm.expectRevert(Toolshed.WrongStatus.selector);
        shed.approveRequest(loanId);
        vm.stopPrank();
    }

    function test_OpenBorrowLimit() public {
        uint256 max = shed.MAX_OPEN_BORROWS();
        vm.startPrank(bob);
        usdc.approve(address(shed), DEPOSIT * (max + 1));
        vm.stopPrank();

        for (uint256 i = 0; i < max; i++) {
            vm.prank(alice);
            uint256 toolId = shed.listTool(URI, DEPOSIT, FEE_PER_DAY, MAX_DAYS);
            vm.prank(bob);
            shed.requestLoan(toolId, 2);
        }

        vm.prank(alice);
        uint256 lastTool = shed.listTool(URI, DEPOSIT, FEE_PER_DAY, MAX_DAYS);
        vm.prank(bob);
        vm.expectRevert(Toolshed.TooManyOpenBorrows.selector);
        shed.requestLoan(lastTool, 2);
    }

    // ------------------------------------------------------------------
    // returns and fees
    // ------------------------------------------------------------------

    function test_OnTimeReturnRefundsEverything() public {
        (, uint256 loanId) = _activeLoan(3);

        vm.warp(block.timestamp + 2 days);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(bob), 1000e6, "full refund");
        assertEq(usdc.balanceOf(alice), 0, "no late fee");
        assertEq(usdc.balanceOf(address(shed)), 0, "escrow emptied");

        Toolshed.Member memory b = shed.getMember(bob);
        assertEq(b.loansBorrowed, 1);
        assertEq(b.lateReturns, 0);
        assertEq(b.openBorrows, 0);
        assertEq(shed.getMember(alice).loansLent, 1);
    }

    function test_LateReturnPaysOwnerPerStartedDay() public {
        (, uint256 loanId) = _activeLoan(3);

        // Due at +3d, returned at +6d1h: 3 days and 1 hour late, and a started day counts, so 4.
        vm.warp(block.timestamp + 6 days + 1 hours);
        vm.prank(bob);
        shed.declareReturn(loanId);

        (uint32 lateDays, uint256 fee, uint256 refund) = shed.quoteSettlement(loanId);
        assertEq(lateDays, 4);
        assertEq(fee, 4 * uint256(FEE_PER_DAY));
        assertEq(refund, DEPOSIT - fee);

        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), fee);
        assertEq(usdc.balanceOf(bob), 1000e6 - fee);

        Toolshed.Member memory b = shed.getMember(bob);
        assertEq(b.loansBorrowed, 1);
        assertEq(b.lateReturns, 1);
        assertEq(b.totalLateDays, 4);
    }

    function test_LateFeeIsCappedAtDeposit() public {
        (, uint256 loanId) = _activeLoan(1);

        // 200 days late at 2 USDC/day = 400 USDC of fee, but the deposit is only 60.
        vm.warp(block.timestamp + 201 days);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), DEPOSIT, "owner gets at most the deposit");
        assertEq(usdc.balanceOf(bob), 1000e6 - DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    function test_DeclaringReturnFreezesTheClock() public {
        (, uint256 loanId) = _activeLoan(2);

        vm.warp(block.timestamp + 4 days); // 2 days late
        vm.prank(bob);
        shed.declareReturn(loanId);

        vm.warp(block.timestamp + 10 days); // owner dawdles
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), 2 * uint256(FEE_PER_DAY), "charged as of the declared return");
    }

    function test_OwnerConfirmingWithoutDeclarationChargesUpToNow() public {
        (, uint256 loanId) = _activeLoan(2);

        vm.warp(block.timestamp + 5 days); // 3 days late, borrower never declared
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), 3 * uint256(FEE_PER_DAY));
    }

    function test_AnyoneFinalizesAfterTheConfirmWindow() public {
        (, uint256 loanId) = _activeLoan(2);

        vm.warp(block.timestamp + 3 days); // 1 day late
        vm.prank(bob);
        shed.declareReturn(loanId);

        vm.prank(stranger);
        vm.expectRevert(Toolshed.TooSoon.selector);
        shed.finalizeReturn(loanId);

        vm.warp(block.timestamp + shed.RETURN_CONFIRM_WINDOW());
        vm.prank(stranger);
        shed.finalizeReturn(loanId);

        assertEq(usdc.balanceOf(alice), uint256(FEE_PER_DAY), "fee as of the declared return, not now");
        assertEq(usdc.balanceOf(bob), 1000e6 - uint256(FEE_PER_DAY));
    }

    function test_OnlyBorrowerDeclaresReturn() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.prank(carol);
        vm.expectRevert(Toolshed.NotBorrower.selector);
        shed.declareReturn(loanId);
    }

    function test_OnlyOwnerConfirms() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.prank(stranger);
        vm.expectRevert(Toolshed.NotToolOwner.selector);
        shed.confirmReturn(loanId);
    }

    function test_SettledLoanCannotBeSettledAgain() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        vm.prank(alice);
        vm.expectRevert(Toolshed.WrongStatus.selector);
        shed.confirmReturn(loanId);

        vm.prank(stranger);
        vm.expectRevert(Toolshed.WrongStatus.selector);
        shed.finalizeReturn(loanId);
    }

    // ------------------------------------------------------------------
    // disputes
    // ------------------------------------------------------------------

    function test_DisputeResumesTheClockAndBlocksAutoFinalize() public {
        (, uint256 loanId) = _activeLoan(2);

        vm.warp(block.timestamp + 3 days);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertTrue(l.disputed);
        assertEq(l.returnedAt, 0);
        assertEq(uint8(l.status), uint8(Toolshed.LoanStatus.Active));

        vm.warp(block.timestamp + shed.RETURN_CONFIRM_WINDOW() + 1);
        vm.prank(stranger);
        vm.expectRevert(Toolshed.WrongStatus.selector);
        shed.finalizeReturn(loanId);
    }

    function test_StewardResolvesDisputeWithAgreedLateDays() public {
        (, uint256 loanId) = _activeLoan(2);

        vm.warp(block.timestamp + 5 days);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        vm.prank(steward);
        shed.resolveDispute(loanId, 2); // neighbours agreed on 2 days

        assertEq(usdc.balanceOf(alice), 2 * uint256(FEE_PER_DAY));
        assertEq(usdc.balanceOf(bob), 1000e6 - 2 * uint256(FEE_PER_DAY));
        assertEq(shed.getMember(bob).lateReturns, 1);
    }

    function test_StewardResolutionIsCappedAtDeposit() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        vm.prank(steward);
        shed.resolveDispute(loanId, type(uint32).max); // a steward cannot overcharge

        assertEq(usdc.balanceOf(alice), DEPOSIT);
        assertEq(usdc.balanceOf(bob), 1000e6 - DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    function test_DisputeCanOnlyHappenOnce() public {
        (, uint256 loanId) = _activeLoan(2);

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(bob);
            shed.declareReturn(loanId);
            if (i == 0) {
                vm.prank(alice);
                shed.disputeReturn(loanId);
            } else {
                // Re-disputing would restart the late-fee clock over and over and eventually
                // let the owner take the whole deposit off an honest borrower.
                vm.prank(alice);
                vm.expectRevert(Toolshed.AlreadyDisputed.selector);
                shed.disputeReturn(loanId);
            }
        }
    }

    function test_DisputedLoanCannotBeWrittenOffByTheOwner() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        vm.warp(block.timestamp + 90 days);
        vm.prank(alice);
        vm.expectRevert(Toolshed.LoanDisputed.selector);
        shed.claimDefault(loanId);

        // The steward is the only way out of a disputed loan, and is still capped at the deposit.
        vm.prank(steward);
        shed.resolveDispute(loanId, 1);
        assertEq(usdc.balanceOf(alice), uint256(FEE_PER_DAY));
    }

    function test_BorrowerStillHasAWayOutAfterADispute() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        // Declaring again and waiting out the window settles it even if the owner stays silent.
        vm.warp(block.timestamp + 1 days);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.warp(block.timestamp + shed.RETURN_CONFIRM_WINDOW());
        vm.prank(stranger);
        shed.finalizeReturn(loanId);

        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Completed));
    }

    // ------------------------------------------------------------------
    // defaults
    // ------------------------------------------------------------------

    function test_DefaultOnceFeesReachTheCap() public {
        (uint256 toolId, uint256 loanId) = _activeLoan(2);

        vm.prank(alice);
        vm.expectRevert(Toolshed.TooSoon.selector);
        shed.claimDefault(loanId);

        // 60 USDC deposit / 2 USDC per day = 30 late days to reach the cap.
        vm.warp(block.timestamp + 2 days + 30 days);
        vm.prank(alice);
        shed.claimDefault(loanId);

        assertEq(usdc.balanceOf(alice), DEPOSIT, "owner keeps the whole deposit");
        assertEq(usdc.balanceOf(address(shed)), 0);

        Toolshed.Member memory b = shed.getMember(bob);
        assertEq(b.defaults, 1);
        assertEq(b.loansBorrowed, 0, "a default is not a completed loan");
        assertEq(b.openBorrows, 0);

        Toolshed.Tool memory t = shed.getTool(toolId);
        assertTrue(t.retired, "a tool that never came back leaves the shelf");
        assertEq(t.activeLoanId, 0);
    }

    function test_DefaultAfterGraceEvenWithTinyFees() public {
        vm.prank(alice);
        uint256 toolId = shed.listTool(URI, 100e6, 1e6, MAX_DAYS); // 100 days to reach the cap
        vm.startPrank(bob);
        usdc.approve(address(shed), 100e6);
        uint256 loanId = shed.requestLoan(toolId, 2);
        vm.stopPrank();
        vm.prank(alice);
        shed.approveRequest(loanId);

        vm.warp(block.timestamp + 2 days + shed.DEFAULT_GRACE());
        vm.prank(alice);
        shed.claimDefault(loanId);

        assertEq(usdc.balanceOf(alice), 100e6);
    }

    function test_OnlyOwnerClaimsDefault() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.warp(block.timestamp + 90 days);
        vm.prank(stranger);
        vm.expectRevert(Toolshed.NotToolOwner.selector);
        shed.claimDefault(loanId);
    }

    function test_BorrowerCanStillDeclareBeforeDefaultIsClaimed() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.warp(block.timestamp + 90 days);

        vm.prank(bob);
        shed.declareReturn(loanId);

        vm.prank(alice);
        vm.expectRevert(Toolshed.WrongStatus.selector);
        shed.claimDefault(loanId);
    }

    function test_CannotSelfSettleBeforeTheLoanIsEvenDue() public {
        (, uint256 loanId) = _activeLoan(14);

        // Declaring a return in the same block as the handover must not buy a free tool.
        vm.prank(bob);
        shed.declareReturn(loanId);

        vm.warp(block.timestamp + shed.RETURN_CONFIRM_WINDOW() + 1);
        vm.prank(bob);
        vm.expectRevert(Toolshed.TooSoon.selector);
        shed.finalizeReturn(loanId);

        // The owner can still confirm an early return at any time, at no cost to the borrower.
        vm.prank(alice);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(bob), 1000e6);
        assertEq(usdc.balanceOf(alice), 0);
    }

    function test_EarlyReturnSelfSettlesOnceTheDueDatePasses() public {
        (, uint256 loanId) = _activeLoan(10);

        vm.prank(bob);
        shed.declareReturn(loanId); // returned on day 0 of a 10-day loan

        vm.warp(block.timestamp + 10 days);
        vm.prank(stranger);
        shed.finalizeReturn(loanId);

        assertEq(usdc.balanceOf(bob), 1000e6, "fee is measured at the declared return, so nothing owed");
    }

    // ------------------------------------------------------------------
    // views
    // ------------------------------------------------------------------

    function test_PaginationClampsToLength() public {
        _listTool();
        _listTool();

        assertEq(shed.getTools(0, 10).length, 2);
        assertEq(shed.getTools(1, 10).length, 1);
        assertEq(shed.getTools(5, 10).length, 0);

        (address[] memory addrs,) = shed.getMembers(0, 100);
        assertEq(addrs.length, 3);
    }

    function test_QuoteIsZeroForClosedLoans() public {
        (, uint256 loanId) = _activeLoan(2);
        vm.prank(alice);
        shed.confirmReturn(loanId);
        (uint32 lateDays, uint256 fee, uint256 refund) = shed.quoteSettlement(loanId);
        assertEq(lateDays, 0);
        assertEq(fee, 0);
        assertEq(refund, 0);
    }

    // ------------------------------------------------------------------
    // invariants under fuzzing
    // ------------------------------------------------------------------

    /// @dev Whatever the terms and however late the return, the two payouts must add up to
    ///      exactly the deposit and the escrow must end empty.
    function testFuzz_SettlementAlwaysConservesTheDeposit(
        uint96 deposit,
        uint96 feePerDay,
        uint16 durationDays,
        uint32 lateSeconds
    ) public {
        deposit = uint96(bound(deposit, 1, 1_000_000e6));
        feePerDay = uint96(bound(feePerDay, 1, deposit));
        durationDays = uint16(bound(durationDays, 1, MAX_DAYS));

        usdc.mint(bob, deposit);
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 toolId = shed.listTool(URI, deposit, feePerDay, MAX_DAYS);

        vm.startPrank(bob);
        usdc.approve(address(shed), deposit);
        uint256 loanId = shed.requestLoan(toolId, durationDays);
        vm.stopPrank();

        vm.prank(alice);
        shed.approveRequest(loanId);

        vm.warp(block.timestamp + uint256(durationDays) * 1 days + lateSeconds);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        uint256 toOwner = usdc.balanceOf(alice) - aliceBefore;
        uint256 toBorrower = usdc.balanceOf(bob) - (bobBefore - deposit);

        assertEq(toOwner + toBorrower, deposit, "deposit conserved");
        assertLe(toOwner, deposit, "fee never exceeds the deposit");
        assertEq(usdc.balanceOf(address(shed)), 0, "escrow emptied");
    }

    /// @dev A borrower who returns on time never loses money, at any terms.
    function testFuzz_OnTimeReturnIsAlwaysFree(uint96 deposit, uint16 durationDays, uint32 earlySeconds) public {
        deposit = uint96(bound(deposit, 1, 1_000_000e6));
        durationDays = uint16(bound(durationDays, 1, MAX_DAYS));
        uint256 loanSeconds = uint256(durationDays) * 1 days;
        earlySeconds = uint32(bound(earlySeconds, 0, loanSeconds));

        usdc.mint(bob, deposit);
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(alice);
        uint256 toolId = shed.listTool(URI, deposit, deposit, MAX_DAYS);
        vm.startPrank(bob);
        usdc.approve(address(shed), deposit);
        uint256 loanId = shed.requestLoan(toolId, durationDays);
        vm.stopPrank();
        vm.prank(alice);
        shed.approveRequest(loanId);

        vm.warp(block.timestamp + earlySeconds);
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(bob), bobBefore, "no fee for an on-time return");
    }
}
