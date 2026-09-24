// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Toolshed } from "../contracts/Toolshed.sol";
import { MockUSDC } from "../contracts/mocks/MockUSDC.sol";

contract ToolshedTest is Test {
    Toolshed internal shed;
    MockUSDC internal usdc;

    address internal steward = makeAddr("steward");
    address internal alice = makeAddr("alice"); // owns the drill
    address internal bob = makeAddr("bob"); // borrows it
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger"); // never a member

    uint96 internal constant DEPOSIT = 60_000000; // $60
    uint96 internal constant DAILY_FEE = 2_000000; // $2/day
    uint32 internal constant MAX_DAYS = 14;
    string internal constant URI = "ipfs://bafydrill";

    function setUp() public {
        usdc = new MockUSDC();
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = carol;
        shed = new Toolshed(IERC20(address(usdc)), steward, members);

        usdc.faucet(bob, 1_000_000000);
        usdc.faucet(carol, 1_000_000000);
        vm.prank(bob);
        usdc.approve(address(shed), type(uint256).max);
        vm.prank(carol);
        usdc.approve(address(shed), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function _listDrill() internal returns (uint64 toolId) {
        vm.prank(alice);
        toolId = shed.listTool(URI, DEPOSIT, DAILY_FEE, MAX_DAYS);
    }

    /// @dev Tool listed, request made and approved: a live 3-day loan to bob.
    function _activeLoan() internal returns (uint64 toolId, uint64 loanId) {
        toolId = _listDrill();
        vm.prank(bob);
        loanId = shed.requestLoan(toolId, 3);
        vm.prank(alice);
        shed.approveLoan(loanId);
    }

    /*//////////////////////////////////////////////////////////////
                           MEMBERSHIP & LISTING
    //////////////////////////////////////////////////////////////*/

    function test_constructor_seedsRolesAndMembers() public view {
        assertTrue(shed.hasRole(shed.STEWARD_ROLE(), steward));
        assertTrue(shed.hasRole(shed.DEFAULT_ADMIN_ROLE(), steward));
        assertTrue(shed.hasRole(shed.MEMBER_ROLE(), alice));
        assertEq(shed.memberCount(), 3);
        assertEq(address(shed.depositToken()), address(usdc));
    }

    function test_steward_addsAndRemovesMembers() public {
        address[] memory batch = new address[](2);
        batch[0] = stranger;
        batch[1] = alice; // already a member: no duplicate roll entry
        vm.prank(steward);
        shed.addMembers(batch);
        assertEq(shed.memberCount(), 4);
        assertTrue(shed.hasRole(shed.MEMBER_ROLE(), stranger));

        vm.prank(steward);
        shed.removeMember(stranger);
        assertFalse(shed.hasRole(shed.MEMBER_ROLE(), stranger));
        assertEq(shed.memberCount(), 4, "roll keeps history");

        (address[] memory roll, bool[] memory active) = shed.getMembers();
        assertEq(roll[3], stranger);
        assertFalse(active[3]);
    }

    function test_nonSteward_cannotAddMembers() public {
        address[] memory batch = new address[](1);
        batch[0] = stranger;
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, shed.STEWARD_ROLE())
        );
        vm.prank(alice);
        shed.addMembers(batch);
    }

    function test_nonMember_cannotList() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotAMember.selector, stranger));
        shed.listTool(URI, DEPOSIT, DAILY_FEE, MAX_DAYS);
    }

    function test_listTool_storesTermsAndIndexes() public {
        uint64 toolId = _listDrill();
        Toolshed.Tool memory tool = shed.getTool(toolId);
        assertEq(tool.owner, alice);
        assertEq(tool.deposit, DEPOSIT);
        assertEq(tool.dailyLateFee, DAILY_FEE);
        assertEq(tool.metadataURI, URI);
        assertTrue(tool.listed);
        (uint64[] memory ownerTools,) = shed.getToolIdsByOwner(alice, 0, 0);
        assertEq(ownerTools[0], toolId);
        assertEq(shed.toolCount(), 1);
    }

    function test_listTool_rejectsBadTerms() public {
        // Read the bounds up front: a view call between expectRevert and the call under test
        // would be the one that "must revert".
        uint96 maxDeposit = shed.MAX_DEPOSIT();
        uint96 minDeposit = shed.MIN_DEPOSIT();
        uint32 maxDays = shed.MAX_DURATION_DAYS();

        vm.startPrank(alice);
        vm.expectRevert(Toolshed.EmptyMetadata.selector);
        shed.listTool("", DEPOSIT, DAILY_FEE, MAX_DAYS);

        vm.expectRevert(Toolshed.BadDeposit.selector);
        shed.listTool(URI, 0, DAILY_FEE, MAX_DAYS);

        vm.expectRevert(Toolshed.BadDeposit.selector); // below MIN_DEPOSIT: dust deposits are not deposits
        shed.listTool(URI, minDeposit - 1, 1, MAX_DAYS);

        vm.expectRevert(Toolshed.BadDeposit.selector);
        shed.listTool(URI, maxDeposit + 1, DAILY_FEE, MAX_DAYS);

        vm.expectRevert(Toolshed.BadLateFee.selector);
        shed.listTool(URI, DEPOSIT, 0, MAX_DAYS);

        // A fee steeper than a seventh of the deposit would put total forfeiture less than a week out.
        vm.expectRevert(Toolshed.BadLateFee.selector);
        shed.listTool(URI, DEPOSIT, DEPOSIT / 7 + 1, MAX_DAYS);

        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.listTool(URI, DEPOSIT, DAILY_FEE, 0);

        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.listTool(URI, DEPOSIT, DAILY_FEE, maxDays + 1);
        vm.stopPrank();
    }

    function test_updateAndDelist_onlyOwner() public {
        uint64 toolId = _listDrill();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotToolOwner.selector, toolId, bob));
        shed.setToolListed(toolId, false);

        vm.startPrank(alice);
        shed.updateTool(toolId, "ipfs://v2", 70_000000, 3_000000, 7);
        shed.setToolListed(toolId, false);
        vm.stopPrank();

        Toolshed.Tool memory tool = shed.getTool(toolId);
        assertEq(tool.deposit, 70_000000);
        assertEq(tool.metadataURI, "ipfs://v2");
        assertFalse(tool.listed);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolNotListed.selector, toolId));
        shed.requestLoan(toolId, 1);
    }

    /*//////////////////////////////////////////////////////////////
                             REQUEST FLOW
    //////////////////////////////////////////////////////////////*/

    function test_requestLoan_escrowsDeposit() public {
        uint64 toolId = _listDrill();
        uint256 before = usdc.balanceOf(bob);

        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);

        assertEq(usdc.balanceOf(bob), before - DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), DEPOSIT);
        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint8(loan.state), uint8(Toolshed.LoanState.Requested));
        assertEq(loan.deposit, DEPOSIT);
        assertEq(loan.dailyLateFee, DAILY_FEE);
        (uint64[] memory toolLoans,) = shed.getLoanIdsByTool(toolId, 0, 0);
        (uint64[] memory borrowerLoans,) = shed.getLoanIdsByBorrower(bob, 0, 0);
        (uint64[] memory ownerLoans, uint256 ownerTotal) = shed.getLoanIdsByOwner(alice, 0, 0);
        assertEq(toolLoans[0], loanId);
        assertEq(borrowerLoans[0], loanId);
        assertEq(ownerLoans[0], loanId, "the owner's queue is indexed too");
        assertEq(ownerTotal, 1);
    }

    function test_requestLoan_rejectsOwnToolAndBadDuration() public {
        uint64 toolId = _listDrill();

        vm.prank(alice);
        vm.expectRevert(Toolshed.CannotBorrowOwnTool.selector);
        shed.requestLoan(toolId, 1);

        vm.prank(bob);
        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.requestLoan(toolId, MAX_DAYS + 1);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NoSuchTool.selector, uint64(99)));
        shed.requestLoan(99, 1);
    }

    function test_cancelRequest_refundsInFull() public {
        uint64 toolId = _listDrill();
        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotBorrower.selector, loanId, carol));
        shed.cancelRequest(loanId);

        vm.prank(bob);
        shed.cancelRequest(loanId);

        assertEq(usdc.balanceOf(bob), before);
        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint8(loan.outcome), uint8(Toolshed.Outcome.Cancelled));
        // A cancelled request does not touch anyone's track record.
        assertEq(shed.getRecord(bob).loansBorrowed, 0);
    }

    function test_declineLoan_refundsInFull() public {
        uint64 toolId = _listDrill();
        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);

        vm.prank(alice);
        shed.declineLoan(loanId);

        assertEq(usdc.balanceOf(bob), before);
        assertEq(uint8(shed.getLoan(loanId).outcome), uint8(Toolshed.Outcome.Declined));
    }

    function test_approveLoan_expiresAfterTtl_butBorrowerCanStillCancel() public {
        uint64 toolId = _listDrill();
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);

        vm.warp(block.timestamp + shed.REQUEST_TTL() + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.RequestExpired.selector, loanId));
        shed.approveLoan(loanId);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        shed.cancelRequest(loanId);
        assertEq(usdc.balanceOf(bob), before + DEPOSIT, "stale request is always refundable");
    }

    function test_approveLoan_onlyOneActiveLoanPerTool() public {
        (uint64 toolId,) = _activeLoan();
        vm.prank(carol);
        uint64 second = shed.requestLoan(toolId, 2);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolOnLoan.selector, toolId));
        shed.approveLoan(second);
    }

    function test_approveLoan_setsDueDate() public {
        (, uint64 loanId) = _activeLoan();
        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint8(loan.state), uint8(Toolshed.LoanState.Active));
        assertEq(loan.dueAt, loan.startedAt + 3 days);
    }

    /*//////////////////////////////////////////////////////////////
                           RETURNS & LATE FEES
    //////////////////////////////////////////////////////////////*/

    function test_onTimeReturn_refundsEverything() public {
        (uint64 toolId, uint64 loanId) = _activeLoan();
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(bob), bobBefore + DEPOSIT);
        assertEq(usdc.balanceOf(alice), aliceBefore);
        assertEq(usdc.balanceOf(address(shed)), 0);

        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint8(loan.outcome), uint8(Toolshed.Outcome.OnTime));
        assertEq(shed.getRecord(bob).loansBorrowed, 1);
        assertEq(shed.getRecord(bob).lateReturns, 0);
        assertEq(shed.getRecord(alice).loansLent, 1);
        assertEq(shed.getTool(toolId).activeLoanId, 0, "tool is back on the shelf");
    }

    function test_lateReturn_feeToOwnerRestRefunded() public {
        (, uint64 loanId) = _activeLoan();
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 aliceBefore = usdc.balanceOf(alice);

        // Due in 3 days; returned after 5 days and 1 hour -> 3 late days (partial day counts).
        vm.warp(block.timestamp + 5 days + 1 hours);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        uint96 expectedFee = 3 * DAILY_FEE;
        assertEq(usdc.balanceOf(alice), aliceBefore + expectedFee);
        assertEq(usdc.balanceOf(bob), bobBefore + DEPOSIT - expectedFee);

        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint8(loan.outcome), uint8(Toolshed.Outcome.Late));
        assertEq(loan.feeToOwner, expectedFee);
        assertEq(shed.getRecord(bob).lateReturns, 1);
        assertEq(shed.getRecord(bob).defaults, 0);
        assertEq(shed.getRecord(bob).lateFeesPaid, expectedFee);
        assertEq(shed.getRecord(alice).lateFeesEarned, expectedFee);
    }

    function test_exactlyOnDueDate_isNotLate() public {
        (, uint64 loanId) = _activeLoan();
        Toolshed.Loan memory loan = shed.getLoan(loanId);
        vm.warp(loan.dueAt);
        vm.prank(alice);
        shed.confirmReturn(loanId);
        assertEq(uint8(shed.getLoan(loanId).outcome), uint8(Toolshed.Outcome.OnTime));
    }

    function test_oneSecondLate_costsAFullDay() public {
        (, uint64 loanId) = _activeLoan();
        vm.warp(shed.getLoan(loanId).dueAt + 1);
        vm.prank(alice);
        shed.confirmReturn(loanId);
        assertEq(shed.getLoan(loanId).feeToOwner, DAILY_FEE);
    }

    function test_lateFeeNeverExceedsDeposit() public {
        (, uint64 loanId) = _activeLoan();
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.warp(shed.getLoan(loanId).dueAt + 1);
        vm.prank(alice);
        shed.flagMissing(loanId);

        vm.warp(block.timestamp + 400 days); // way past the 30 days it takes to burn $60 at $2/day
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), aliceBefore + DEPOSIT);
        assertEq(usdc.balanceOf(bob), bobBefore, "nothing left to refund, nothing extra owed");
        assertEq(uint8(shed.getLoan(loanId).outcome), uint8(Toolshed.Outcome.Defaulted));
        assertEq(shed.getRecord(bob).defaults, 1);
        assertEq(shed.getRecord(bob).lateReturns, 1);
    }

    function test_reportReturn_freezesTheClock() public {
        (, uint64 loanId) = _activeLoan();
        vm.warp(block.timestamp + 4 days); // 1 day late
        vm.prank(bob);
        shed.reportReturn(loanId);

        // Alice takes her time confirming, but the fee is pinned to the reported moment.
        vm.warp(block.timestamp + 2 days);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(alice), aliceBefore + DAILY_FEE);
    }

    function test_reportReturn_onlyBorrowerOnActiveLoan() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotBorrower.selector, loanId, carol));
        shed.reportReturn(loanId);

        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.BadState.selector, loanId, Toolshed.LoanState.ReturnClaimed));
        shed.reportReturn(loanId);
    }

    function test_settleUnconfirmed_afterWindow_anyoneCanCall() public {
        (, uint64 loanId) = _activeLoan();
        vm.warp(block.timestamp + 2 days);
        vm.prank(bob);
        shed.reportReturn(loanId);

        vm.expectRevert(
            abi.encodeWithSelector(
                Toolshed.ConfirmWindowOpen.selector, loanId, uint64(block.timestamp) + shed.CONFIRM_WINDOW()
            )
        );
        shed.settleUnconfirmed(loanId);

        vm.warp(block.timestamp + shed.CONFIRM_WINDOW());
        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(stranger); // a neighbor with no stake can poke it; usually the borrower does
        shed.settleUnconfirmed(loanId);
        assertEq(usdc.balanceOf(bob), bobBefore + DEPOSIT, "returned on time, full refund");
    }

    function test_confirmReturn_onlyOwner() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotToolOwner.selector, uint64(1), bob));
        shed.confirmReturn(loanId);
    }

    function test_settledLoanCannotBeSettledTwice() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(alice);
        shed.confirmReturn(loanId);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.BadState.selector, loanId, Toolshed.LoanState.Closed));
        shed.confirmReturn(loanId);
    }

    function test_toolCanBeLentAgainAfterSettlement() public {
        (uint64 toolId, uint64 loanId) = _activeLoan();
        vm.prank(alice);
        shed.confirmReturn(loanId);

        vm.prank(carol);
        uint64 second = shed.requestLoan(toolId, 2);
        vm.prank(alice);
        shed.approveLoan(second);
        assertEq(shed.getTool(toolId).activeLoanId, second);
    }

    /*//////////////////////////////////////////////////////////////
                                DEFAULTS
    //////////////////////////////////////////////////////////////*/

    function test_claimDefault_needsBothTheFeeCapAndAnAccusation() public {
        (uint64 toolId, uint64 loanId) = _activeLoan();
        uint64 feeCapAt = shed.defaultTime(loanId);
        assertEq(feeCapAt, shed.getLoan(loanId).dueAt + 30 days); // $60 / $2 per day

        // Fees alone are not enough: silence must not be a way to take someone's deposit.
        vm.warp(feeCapAt);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotFlaggedMissing.selector, loanId));
        shed.claimDefault(loanId);
        assertEq(shed.getLoan(loanId).deposit, DEPOSIT);
        (, uint96 unflaggedFee,) = shed.quoteSettlement(loanId, uint64(block.timestamp));
        assertEq(unflaggedFee, 7 * DAILY_FEE, "unflagged fees stop a week past the due date");

        vm.prank(alice);
        shed.flagMissing(loanId);

        // And the accusation alone is not enough either — the borrower gets a window to answer.
        vm.expectRevert(
            abi.encodeWithSelector(
                Toolshed.NotDefaultedYet.selector, loanId, uint64(block.timestamp) + shed.CONFIRM_WINDOW()
            )
        );
        shed.claimDefault(loanId);

        vm.warp(block.timestamp + shed.CONFIRM_WINDOW());
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(stranger);
        shed.claimDefault(loanId);

        assertEq(usdc.balanceOf(alice), aliceBefore + DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), 0);
        assertEq(shed.getRecord(bob).defaults, 1);
        assertEq(shed.getTool(toolId).activeLoanId, 0);
        assertEq(uint8(shed.getLoan(loanId).outcome), uint8(Toolshed.Outcome.Defaulted));
    }

    function test_flagMissing_onlyOwnerOnlyOverdueOnlyOnce() public {
        (, uint64 loanId) = _activeLoan();
        uint64 dueAt = shed.getLoan(loanId).dueAt;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotOverdue.selector, loanId, dueAt));
        shed.flagMissing(loanId);

        vm.warp(dueAt + 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotToolOwner.selector, uint64(1), bob));
        shed.flagMissing(loanId);

        vm.prank(alice);
        shed.flagMissing(loanId);
        assertEq(shed.getLoan(loanId).missingFlaggedAt, uint64(block.timestamp));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.AlreadyFlagged.selector, loanId));
        shed.flagMissing(loanId);
    }

    /// @notice The attack the accusation step exists to stop: an owner who has the tool back, says
    ///         nothing, and waits for the late fees to eat the whole deposit.
    function test_ownerCannotTakeTheDepositBySilence() public {
        (, uint64 loanId) = _activeLoan();
        uint256 bobBefore = usdc.balanceOf(bob);

        // A year of silence gets the owner nowhere on its own.
        vm.warp(block.timestamp + 365 days);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotFlaggedMissing.selector, loanId));
        shed.claimDefault(loanId);

        // Bob can answer at any point while the loan is live, which forces Alice to act.
        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.warp(block.timestamp + shed.CONFIRM_WINDOW());
        vm.prank(bob);
        shed.settleUnconfirmed(loanId);

        // A year of silence earns Alice one week of fees, not the whole deposit.
        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(loan.feeToOwner, 7 * DAILY_FEE, "unflagged fees stop after the grace week");
        assertEq(loan.refundToBorrower, DEPOSIT - 7 * DAILY_FEE);
        assertEq(usdc.balanceOf(bob), bobBefore + loan.refundToBorrower);
        assertEq(uint8(loan.state), uint8(Toolshed.LoanState.Closed));
        assertEq(shed.getRecord(bob).defaults, 0, "and no default on his record");
    }

    /*//////////////////////////////////////////////////////////////
                                DISPUTES
    //////////////////////////////////////////////////////////////*/

    function test_dispute_resolvedBySteward_splitsEscrow() public {
        (, uint64 loanId) = _activeLoan();
        vm.warp(block.timestamp + 2 days);
        vm.prank(bob);
        shed.reportReturn(loanId); // "I put it back on the porch"

        vm.prank(alice);
        shed.disputeReturn(loanId); // "no you didn't"

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);
        uint96 award = 25_000000;

        vm.prank(steward);
        shed.resolveDispute(loanId, award);

        assertEq(usdc.balanceOf(alice), aliceBefore + award);
        assertEq(usdc.balanceOf(bob), bobBefore + DEPOSIT - award);
        assertEq(shed.getRecord(bob).lateReturns, 1);
        assertEq(shed.getRecord(bob).defaults, 0);
    }

    function test_dispute_stewardCannotAwardMoreThanTheEscrow() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.AwardExceedsDeposit.selector, DEPOSIT + 1, DEPOSIT));
        shed.resolveDispute(loanId, DEPOSIT + 1);
    }

    function test_dispute_onlyInsideConfirmWindow() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(bob);
        shed.reportReturn(loanId);

        vm.warp(block.timestamp + shed.CONFIRM_WINDOW() + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ConfirmWindowClosed.selector, loanId));
        shed.disputeReturn(loanId);
    }

    function test_dispute_nonStewardCannotResolve() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, shed.STEWARD_ROLE())
        );
        vm.prank(alice);
        shed.resolveDispute(loanId, DEPOSIT);
    }

    function test_absentSteward_splitsTheEscrowDownTheMiddle() public {
        (, uint64 loanId) = _activeLoan();
        vm.warp(block.timestamp + 2 days);
        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        uint64 opensAt = shed.getLoan(loanId).returnedAt + shed.CONFIRM_WINDOW() + shed.DISPUTE_WINDOW();
        vm.expectRevert(abi.encodeWithSelector(Toolshed.DisputeWindowOpen.selector, loanId, opensAt));
        shed.settleStaleDispute(loanId);

        vm.warp(opensAt);
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(bob);
        shed.settleStaleDispute(loanId);

        // Neither side profits from waiting the steward out, so neither side wants to.
        assertEq(usdc.balanceOf(bob), bobBefore + DEPOSIT / 2);
        assertEq(usdc.balanceOf(alice), aliceBefore + DEPOSIT / 2);
        assertEq(uint8(shed.getLoan(loanId).outcome), uint8(Toolshed.Outcome.Unresolved));
        assertEq(shed.getRecord(bob).lateReturns, 0, "nothing was established, so nothing is marked");
        assertEq(shed.getRecord(bob).loansBorrowed, 1, "but it still counts as a loan");
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function test_quoteSettlement_tracksTheRunningFee() public {
        (, uint64 loanId) = _activeLoan();
        Toolshed.Loan memory loan = shed.getLoan(loanId);

        (uint32 lateDays, uint96 fee, uint96 refund) = shed.quoteSettlement(loanId, loan.dueAt);
        assertEq(lateDays, 0);
        assertEq(fee, 0);
        assertEq(refund, DEPOSIT);

        (lateDays, fee, refund) = shed.quoteSettlement(loanId, loan.dueAt + 2 days);
        assertEq(lateDays, 2);
        assertEq(fee, 2 * DAILY_FEE);
        assertEq(refund, DEPOSIT - 2 * DAILY_FEE);

        // After settlement the quote reports what actually happened.
        vm.warp(loan.dueAt + 2 days);
        vm.prank(alice);
        shed.confirmReturn(loanId);
        (, fee, refund) = shed.quoteSettlement(loanId, uint64(block.timestamp));
        assertEq(fee, 2 * DAILY_FEE);
        assertEq(refund, DEPOSIT - 2 * DAILY_FEE);
    }

    function test_getTools_paginates() public {
        _listDrill();
        _listDrill();
        _listDrill();

        (Toolshed.Tool[] memory page, uint64[] memory ids) = shed.getTools(1, 2);
        assertEq(page.length, 2);
        assertEq(ids[0], 2);
        assertEq(ids[1], 3);

        (page, ids) = shed.getTools(10, 5); // past the end
        assertEq(page.length, 0);
    }

    function test_getRecords_batchesTheBrowseRanking() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(alice);
        shed.confirmReturn(loanId);

        address[] memory who = new address[](2);
        who[0] = bob;
        who[1] = carol;
        Toolshed.Record[] memory records = shed.getRecords(who);
        assertEq(records[0].loansBorrowed, 1);
        assertEq(records[1].loansBorrowed, 0);
    }

    /*//////////////////////////////////////////////////////////////
                                 FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice Whatever the terms and whenever it comes back, escrow in == payouts out, and the
    ///         owner can never receive more than the deposit.
    function testFuzz_settlementConservesEscrow(
        uint96 deposit,
        uint96 dailyFee,
        uint32 durationDays,
        uint64 lateSeconds
    ) public {
        deposit = uint96(bound(deposit, shed.MIN_DEPOSIT(), shed.MAX_DEPOSIT()));
        dailyFee = uint96(bound(dailyFee, 1, deposit / shed.MIN_DAYS_TO_FORFEIT()));
        durationDays = uint32(bound(durationDays, 1, shed.MAX_DURATION_DAYS()));
        lateSeconds = uint64(bound(lateSeconds, 0, 3650 days));

        vm.prank(alice);
        uint64 toolId = shed.listTool(URI, deposit, dailyFee, durationDays);

        usdc.faucet(bob, deposit);
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, durationDays);
        vm.prank(alice);
        shed.approveLoan(loanId);

        // Flag it the moment it is overdue, so fees accrue for the whole period under test.
        if (lateSeconds > 0) {
            vm.warp(uint256(shed.getLoan(loanId).dueAt) + 1);
            vm.prank(alice);
            shed.flagMissing(loanId);
        }

        vm.warp(uint256(shed.getLoan(loanId).dueAt) + lateSeconds);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint256(loan.feeToOwner) + loan.refundToBorrower, deposit, "escrow fully distributed");
        assertLe(loan.feeToOwner, deposit, "owner never gets more than the deposit");
        assertEq(usdc.balanceOf(address(shed)), 0, "contract holds nothing after settlement");
        assertEq(usdc.balanceOf(alice), aliceBefore + loan.feeToOwner);
        assertEq(usdc.balanceOf(bob), bobBefore - deposit + loan.refundToBorrower);

        uint256 expectedDays = (uint256(lateSeconds) + 1 days - 1) / 1 days;
        uint256 expectedFee = expectedDays * dailyFee;
        if (expectedFee > deposit) expectedFee = deposit;
        assertEq(loan.feeToOwner, expectedFee, "ceil(days late) * daily fee, capped at the deposit");
    }

    /// @notice A default is always reachable: no matter the terms, the cap is hit in finite time
    ///         and anyone can close the loan out.
    function testFuzz_defaultIsAlwaysReachable(uint96 deposit, uint96 dailyFee) public {
        deposit = uint96(bound(deposit, shed.MIN_DEPOSIT(), shed.MAX_DEPOSIT()));
        dailyFee = uint96(bound(dailyFee, 1, deposit / shed.MIN_DAYS_TO_FORFEIT()));

        vm.prank(alice);
        uint64 toolId = shed.listTool(URI, deposit, dailyFee, 1);
        usdc.faucet(bob, deposit);

        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 1);
        vm.prank(alice);
        shed.approveLoan(loanId);

        uint64 defaultsAt = shed.defaultTime(loanId);
        assertGt(defaultsAt, shed.getLoan(loanId).dueAt);

        vm.warp(uint256(shed.getLoan(loanId).dueAt) + 1);
        vm.prank(alice);
        shed.flagMissing(loanId);

        uint64 claimableAt = shed.getLoan(loanId).missingFlaggedAt + shed.CONFIRM_WINDOW();
        vm.warp(defaultsAt > claimableAt ? defaultsAt : claimableAt);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(stranger);
        shed.claimDefault(loanId);
        assertEq(usdc.balanceOf(alice), aliceBefore + deposit);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                        TOKEN TROUBLE & HOUSEKEEPING
    //////////////////////////////////////////////////////////////*/

    /// @notice USDC can block an address. A settlement must still complete when it does.
    function test_blockedCounterpartyGetsACreditInsteadOfBreakingSettlement() public {
        BlocklistUSDC token = new BlocklistUSDC();
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        Toolshed blockShed = new Toolshed(IERC20(address(token)), steward, members);

        token.faucet(bob, 1_000_000000);
        vm.prank(bob);
        token.approve(address(blockShed), type(uint256).max);

        vm.prank(alice);
        uint64 toolId = blockShed.listTool(URI, DEPOSIT, DAILY_FEE, MAX_DAYS);
        vm.prank(bob);
        uint64 loanId = blockShed.requestLoan(toolId, 3);
        vm.prank(alice);
        blockShed.approveLoan(loanId);

        // Bob lands on the token's blocklist while the drill is out, two days late.
        token.block_(bob);
        vm.warp(block.timestamp + 5 days);
        vm.prank(alice);
        blockShed.confirmReturn(loanId);

        // The loan closed, Alice was paid, the tool is free, and Bob's refund is waiting for him.
        assertEq(uint8(blockShed.getLoan(loanId).state), uint8(Toolshed.LoanState.Closed));
        assertEq(blockShed.getTool(toolId).activeLoanId, 0, "tool is not bricked");
        assertEq(token.balanceOf(alice), 2 * DAILY_FEE);
        uint256 refund = DEPOSIT - 2 * DAILY_FEE;
        assertEq(blockShed.owed(bob), refund);

        vm.prank(bob);
        vm.expectRevert(); // still blocked: withdrawing cannot work yet, but the credit is kept
        blockShed.withdraw();

        token.unblock(bob);
        uint256 before = token.balanceOf(bob);
        vm.prank(bob);
        blockShed.withdraw();
        assertEq(token.balanceOf(bob), before + refund);
        assertEq(blockShed.owed(bob), 0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NothingOwed.selector, bob));
        blockShed.withdraw();
    }

    function test_oneOpenRequestPerToolPerBorrower() public {
        uint64 toolId = _listDrill();
        vm.prank(bob);
        uint64 first = shed.requestLoan(toolId, 3);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.RequestAlreadyOpen.selector, toolId, bob));
        shed.requestLoan(toolId, 2);

        // Carol is unaffected — the limit is per borrower, not per tool.
        vm.prank(carol);
        shed.requestLoan(toolId, 2);

        // And Bob can ask again once his own request is out of the way.
        vm.prank(bob);
        shed.cancelRequest(first);
        vm.prank(bob);
        shed.requestLoan(toolId, 2);
    }

    function test_delistedToolCannotBeApproved() public {
        uint64 toolId = _listDrill();
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);

        vm.prank(alice);
        shed.setToolListed(toolId, false); // it broke while the request was pending

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolNotListed.selector, toolId));
        shed.approveLoan(loanId);
    }

    function test_disputeRuling_recordAlwaysMatchesTheMoney() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        // A steward cannot record "returned on time" while taking the whole deposit: the mark is
        // derived from the award.
        vm.prank(steward);
        shed.resolveDispute(loanId, DEPOSIT);
        assertEq(uint8(shed.getLoan(loanId).outcome), uint8(Toolshed.Outcome.Defaulted));
        assertEq(shed.getRecord(bob).defaults, 1);
        assertEq(shed.getRecord(bob).lateFeesPaid, DEPOSIT);
    }

    function test_disputeRuling_forTheBorrowerLeavesACleanRecord() public {
        (, uint64 loanId) = _activeLoan();
        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.prank(alice);
        shed.disputeReturn(loanId);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(steward);
        shed.resolveDispute(loanId, 0);

        assertEq(usdc.balanceOf(bob), bobBefore + DEPOSIT);
        assertEq(uint8(shed.getLoan(loanId).outcome), uint8(Toolshed.Outcome.OnTime));
        assertEq(shed.getRecord(bob).lateReturns, 0);
    }

    function test_getters_paginate() public {
        uint64 toolId = _listDrill();
        vm.prank(bob);
        shed.requestLoan(toolId, 1);
        vm.prank(carol);
        shed.requestLoan(toolId, 1);

        (uint64[] memory page, uint256 total) = shed.getLoanIdsByOwner(alice, 0, 1);
        assertEq(page.length, 1);
        assertEq(total, 2);

        (page,) = shed.getLoanIdsByOwner(alice, 1, 10);
        assertEq(page.length, 1, "clamps past the end");

        (page,) = shed.getLoanIdsByOwner(alice, 5, 10);
        assertEq(page.length, 0, "offset past the end is empty, not a revert");

        (page, total) = shed.getLoanIdsByTool(toolId, 0, 0);
        assertEq(page.length, 2, "limit 0 means everything");
    }

    function test_getTools_hugeLimitClampsInsteadOfOverflowing() public {
        _listDrill();
        (Toolshed.Tool[] memory page,) = shed.getTools(0, type(uint64).max);
        assertEq(page.length, 1);
    }

    function test_feeOnTransferTokenIsRejectedAtRequestTime() public {
        SkimmingUSDC token = new SkimmingUSDC();
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        Toolshed skimShed = new Toolshed(IERC20(address(token)), steward, members);

        token.faucet(bob, 1_000_000000);
        vm.prank(bob);
        token.approve(address(skimShed), type(uint256).max);
        vm.prank(alice);
        uint64 toolId = skimShed.listTool(URI, DEPOSIT, DAILY_FEE, MAX_DAYS);

        // The escrow would be short by the token's cut, and some other loan would end up paying for
        // it at settlement. Refuse the deposit instead.
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(Toolshed.UnexpectedDepositAmount.selector, DEPOSIT, DEPOSIT - DEPOSIT / 100)
        );
        skimShed.requestLoan(toolId, 3);
    }
}

/// @dev USDC-style token that can freeze an address, like the real one's blocklist.
contract BlocklistUSDC is MockUSDC {
    mapping(address => bool) public blocked;

    function block_(address account) external {
        blocked[account] = true;
    }

    function unblock(address account) external {
        blocked[account] = false;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!blocked[from] && !blocked[to], "blocked");
        super._update(from, to, value);
    }
}

/// @dev Token that keeps 1% of every transfer, to prove the deposit check catches it.
contract SkimmingUSDC is MockUSDC {
    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 cut = value / 100;
        super._update(from, to, value - cut);
        super._update(from, address(0xdead), cut);
    }
}
