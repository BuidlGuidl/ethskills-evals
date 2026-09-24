// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ToolshedTest is Test {
    Toolshed shed;
    MockUSDC usdc;

    address steward = makeAddr("steward");
    address ana = makeAddr("ana"); // tool owner
    address ben = makeAddr("ben"); // borrower
    address cyd = makeAddr("cyd"); // second borrower
    address outsider = makeAddr("outsider");

    uint96 constant DEPOSIT = 40e6; // 40 USDC
    uint96 constant LATE_FEE = 3e6; // 3 USDC / day
    uint16 constant MAX_DAYS = 14;
    uint96 constant MAX_DEPOSIT = 2_000e6;

    string constant URI = "ipfs://bafyToolMetadata";

    function setUp() public {
        usdc = new MockUSDC();
        shed = new Toolshed(IERC20(address(usdc)), steward, MAX_DEPOSIT);

        address[] memory roster = new address[](3);
        roster[0] = ana;
        roster[1] = ben;
        roster[2] = cyd;
        vm.prank(steward);
        shed.admitMembers(roster);

        for (uint256 i; i < roster.length; ++i) {
            usdc.mint(roster[i], 1_000e6);
            vm.prank(roster[i]);
            usdc.approve(address(shed), type(uint256).max);
        }
        vm.warp(1_760_000_000);
    }

    // ------------------------------------------------------------------ helpers

    function _listTool() internal returns (uint64 toolId) {
        vm.prank(ana);
        return shed.listTool(URI, DEPOSIT, LATE_FEE, MAX_DAYS);
    }

    function _activeLoan(uint16 loanDays) internal returns (uint64 toolId, uint64 loanId) {
        toolId = _listTool();
        vm.prank(ben);
        loanId = shed.requestLoan(toolId, loanDays);
        vm.prank(ana);
        shed.approveRequest(loanId);
    }

    // ----------------------------------------------------------- membership

    function test_onlyStewardAdmits() public {
        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ana));
        shed.admitMember(outsider);

        assertEq(shed.memberCount(), 3);
        vm.prank(steward);
        shed.admitMember(outsider);
        assertTrue(shed.isMember(outsider));
        assertEq(shed.memberCount(), 4);
    }

    function test_nonMemberCannotListOrBorrow() public {
        uint64 toolId = _listTool();

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotAMember.selector, outsider));
        shed.listTool(URI, DEPOSIT, LATE_FEE, MAX_DAYS);

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotAMember.selector, outsider));
        shed.requestLoan(toolId, 3);
    }

    function test_suspendedMemberCannotBorrowButLoansStillSettle() public {
        (, uint64 loanId) = _activeLoan(3);

        vm.prank(steward);
        shed.suspendMember(ben);

        uint64 other = _listTool();
        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotAMember.selector, ben));
        shed.requestLoan(other, 1);

        // The running loan is unaffected: it still settles and still refunds.
        uint256 before = usdc.balanceOf(ben);
        vm.prank(ana);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(ben), before + DEPOSIT);
    }

    function test_memberCountTracksActiveMembers() public {
        assertEq(shed.memberCount(), 3);
        vm.prank(steward);
        shed.suspendMember(cyd);
        assertEq(shed.memberCount(), 2, "suspended members are not on the roster");
        vm.prank(steward);
        shed.admitMember(cyd);
        assertEq(shed.memberCount(), 3);
    }

    function test_reinstatingMemberDoesNotDoubleCount() public {
        vm.startPrank(steward);
        shed.suspendMember(ben);
        shed.admitMember(ben);
        vm.stopPrank();
        assertEq(shed.memberCount(), 3);
        assertTrue(shed.isMember(ben));
    }

    // ----------------------------------------------------------------- listing

    function test_listToolStoresTermsAndIndexes() public {
        uint64 toolId = _listTool();
        Toolshed.Tool memory t = shed.getTool(toolId);

        assertEq(toolId, 1, "ids are 1-based");
        assertEq(t.owner, ana);
        assertEq(t.deposit, DEPOSIT);
        assertEq(t.dailyLateFee, LATE_FEE);
        assertEq(t.maxLoanDays, MAX_DAYS);
        assertTrue(t.listed);
        assertEq(t.metadataURI, URI);
        assertEq(shed.toolsOfOwner(ana).length, 1);
        assertEq(shed.toolCount(), 1);
    }

    function test_listToolRejectsBadTerms() public {
        vm.startPrank(ana);
        vm.expectRevert(Toolshed.EmptyMetadata.selector);
        shed.listTool("", DEPOSIT, LATE_FEE, MAX_DAYS);

        vm.expectRevert(Toolshed.ZeroDeposit.selector);
        shed.listTool(URI, 0, LATE_FEE, MAX_DAYS);

        vm.expectRevert(abi.encodeWithSelector(Toolshed.DepositTooLarge.selector, MAX_DEPOSIT + 1, MAX_DEPOSIT));
        shed.listTool(URI, MAX_DEPOSIT + 1, LATE_FEE, MAX_DAYS);

        vm.expectRevert(abi.encodeWithSelector(Toolshed.FeeExceedsDeposit.selector, DEPOSIT + 1, DEPOSIT));
        shed.listTool(URI, DEPOSIT, DEPOSIT + 1, MAX_DAYS);

        vm.expectRevert(abi.encodeWithSelector(Toolshed.InvalidLoanDays.selector, 0, 0));
        shed.listTool(URI, DEPOSIT, LATE_FEE, 0);
        vm.stopPrank();
    }

    function test_onlyOwnerEditsToolAndNotWhileOnLoan() public {
        (uint64 toolId, uint64 loanId) = _activeLoan(2);

        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotToolOwner.selector, toolId));
        shed.updateTool(toolId, URI, DEPOSIT, LATE_FEE, MAX_DAYS);

        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolUnavailable.selector, toolId));
        shed.updateTool(toolId, URI, DEPOSIT, LATE_FEE, MAX_DAYS);

        vm.prank(ana);
        shed.confirmReturn(loanId);
        vm.prank(ana);
        shed.updateTool(toolId, "ipfs://new", 10e6, 1e6, 5);
        assertEq(shed.getTool(toolId).deposit, 10e6);
    }

    function test_hiddenToolCannotBeRequested() public {
        uint64 toolId = _listTool();
        vm.prank(ana);
        shed.setToolListed(toolId, false);

        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolNotListed.selector, toolId));
        shed.requestLoan(toolId, 1);
    }

    // --------------------------------------------------------------- requesting

    function test_requestEscrowsDepositAndSnapshotsTerms() public {
        uint64 toolId = _listTool();
        uint256 benBefore = usdc.balanceOf(ben);

        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 4);

        assertEq(usdc.balanceOf(ben), benBefore - DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), DEPOSIT);

        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertEq(uint8(l.status), uint8(Toolshed.LoanStatus.Requested));
        assertEq(l.deposit, DEPOSIT);
        assertEq(l.dailyLateFee, LATE_FEE);
        assertEq(l.loanDays, 4);
        assertEq(l.borrower, ben);
        assertEq(shed.loansOfBorrower(ben)[0], loanId);
        assertEq(shed.loansOfTool(toolId)[0], loanId);
    }

    function test_editingToolDoesNotChangeAnOpenRequestsTerms() public {
        uint64 toolId = _listTool();
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 2);

        vm.prank(ana);
        shed.updateTool(toolId, URI, 500e6, 100e6, MAX_DAYS);

        vm.prank(ana);
        shed.approveRequest(loanId);
        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertEq(l.deposit, DEPOSIT, "terms are the ones the borrower agreed to");
        assertEq(l.dailyLateFee, LATE_FEE);
    }

    function test_cannotBorrowOwnToolOrBadDuration() public {
        uint64 toolId = _listTool();

        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.CannotBorrowOwnTool.selector, toolId));
        shed.requestLoan(toolId, 1);

        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.InvalidLoanDays.selector, 0, MAX_DAYS));
        shed.requestLoan(toolId, 0);

        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.InvalidLoanDays.selector, MAX_DAYS + 1, MAX_DAYS));
        shed.requestLoan(toolId, MAX_DAYS + 1);
    }

    function test_withdrawRequestRefundsInFull() public {
        uint64 toolId = _listTool();
        uint256 before = usdc.balanceOf(ben);
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 3);

        vm.prank(cyd);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotBorrower.selector, loanId));
        shed.withdrawRequest(loanId);

        vm.prank(ben);
        shed.withdrawRequest(loanId);
        assertEq(usdc.balanceOf(ben), before);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Withdrawn));
    }

    function test_declineRequestRefundsInFull() public {
        uint64 toolId = _listTool();
        uint256 before = usdc.balanceOf(ben);
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 3);

        vm.prank(cyd);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotToolOwner.selector, toolId));
        shed.declineRequest(loanId);

        vm.prank(ana);
        shed.declineRequest(loanId);
        assertEq(usdc.balanceOf(ben), before);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Declined));
    }

    function test_stewardCanDeclineOnOwnersBehalf() public {
        uint64 toolId = _listTool();
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 3);
        vm.prank(steward);
        shed.declineRequest(loanId);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Declined));
    }

    function test_severalNeighboursCanQueueAndOnlyOneIsApproved() public {
        uint64 toolId = _listTool();
        vm.prank(ben);
        uint64 benLoan = shed.requestLoan(toolId, 2);
        vm.prank(cyd);
        uint64 cydLoan = shed.requestLoan(toolId, 5);

        assertEq(usdc.balanceOf(address(shed)), 2 * uint256(DEPOSIT));

        vm.prank(ana);
        shed.approveRequest(benLoan);

        // The tool is out, so the other request cannot also be approved.
        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolUnavailable.selector, toolId));
        shed.approveRequest(cydLoan);

        // …and Cyd is never stuck: she takes her deposit back whenever she likes.
        uint256 before = usdc.balanceOf(cyd);
        vm.prank(cyd);
        shed.withdrawRequest(cydLoan);
        assertEq(usdc.balanceOf(cyd), before + DEPOSIT);
    }

    function test_requestBlockedWhileToolIsOut() public {
        (uint64 toolId,) = _activeLoan(2);
        vm.prank(cyd);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolUnavailable.selector, toolId));
        shed.requestLoan(toolId, 1);
    }

    function test_approveSetsDueDateFromApprovalTime() public {
        uint64 toolId = _listTool();
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 5);

        vm.warp(block.timestamp + 2 days); // owner takes two days to answer
        vm.prank(ana);
        shed.approveRequest(loanId);

        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertEq(l.startedAt, uint64(block.timestamp));
        assertEq(l.dueAt, uint64(block.timestamp) + 5 days, "the 5 days start when the tool changes hands");
        assertEq(shed.getTool(toolId).activeLoanId, loanId);
    }

    // ------------------------------------------------------------ on-time return

    function test_onTimeReturnRefundsEverything() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);
        uint256 anaBefore = usdc.balanceOf(ana);

        vm.warp(block.timestamp + 2 days);
        vm.prank(ben);
        shed.reportReturn(loanId);
        vm.prank(ana);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT, "full deposit back");
        assertEq(usdc.balanceOf(ana), anaBefore, "owner earns nothing on time");
        assertEq(usdc.balanceOf(address(shed)), 0, "escrow emptied");

        Toolshed.Member memory b = shed.getMember(ben);
        assertEq(b.loansTaken, 1);
        assertEq(b.lateReturns, 0);
        assertEq(shed.getMember(ana).loansGiven, 1);
    }

    function test_returnExactlyAtDueDateIsNotLate() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);

        vm.warp(shed.getLoan(loanId).dueAt);
        vm.prank(ana);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT);
        assertEq(shed.getMember(ben).lateReturns, 0);
    }

    function test_ownerCanConfirmWithoutBorrowerReporting() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);
        vm.warp(block.timestamp + 1 days);
        vm.prank(ana);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT);
    }

    // ----------------------------------------------------------- late returns

    function test_lateReturnSplitsDepositAndRecordsIt() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);
        uint256 anaBefore = usdc.balanceOf(ana);

        vm.warp(shed.getLoan(loanId).dueAt + 2 days); // exactly two days late
        (uint32 lateDays, uint96 fee) = shed.accruedLateFee(loanId);
        assertEq(lateDays, 2);
        assertEq(fee, 2 * uint256(LATE_FEE));

        vm.prank(ana);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(ana), anaBefore + 2 * uint256(LATE_FEE), "fee goes to the owner");
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT - 2 * uint256(LATE_FEE));
        assertEq(usdc.balanceOf(address(shed)), 0);

        Toolshed.Member memory b = shed.getMember(ben);
        assertEq(b.loansTaken, 1);
        assertEq(b.lateReturns, 1);
        assertEq(b.unreturned, 0);
    }

    function test_partOfADayCountsAsAWholeLateDay() public {
        (, uint64 loanId) = _activeLoan(3);
        vm.warp(shed.getLoan(loanId).dueAt + 1 hours);
        (uint32 lateDays, uint96 fee) = shed.accruedLateFee(loanId);
        assertEq(lateDays, 1);
        assertEq(fee, LATE_FEE);

        vm.warp(shed.getLoan(loanId).dueAt + 1 days + 1);
        (lateDays, fee) = shed.accruedLateFee(loanId);
        assertEq(lateDays, 2);
    }

    function test_lateFeeIsCappedAtTheDeposit() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);
        uint256 anaBefore = usdc.balanceOf(ana);

        vm.warp(shed.getLoan(loanId).dueAt + 365 days);
        (, uint96 fee) = shed.accruedLateFee(loanId);
        assertEq(fee, DEPOSIT, "never more than the deposit");

        vm.prank(ana);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(ana), anaBefore + DEPOSIT);
        assertEq(usdc.balanceOf(ben), benBefore, "borrower's worst case is losing the deposit");
    }

    function test_reportingReturnFreezesTheClock() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);

        vm.warp(shed.getLoan(loanId).dueAt + 1 days);
        vm.prank(ben);
        shed.reportReturn(loanId);

        // The owner dawdles for a week; the borrower still only owes the one day.
        vm.warp(block.timestamp + 7 days);
        (, uint96 fee) = shed.accruedLateFee(loanId);
        assertEq(fee, LATE_FEE);

        vm.prank(ana);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT - LATE_FEE);
    }

    // ------------------------------------------------- borrower self-settlement

    function test_borrowerCanSettleAfterConfirmWindow() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);
        uint256 anaBefore = usdc.balanceOf(ana);

        vm.warp(shed.getLoan(loanId).dueAt + 1 days);
        vm.prank(ben);
        shed.reportReturn(loanId);
        uint64 reportedAt = uint64(block.timestamp);
        uint64 window = shed.CONFIRM_WINDOW();

        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ConfirmWindowOpen.selector, reportedAt + window));
        shed.settleUnconfirmed(loanId);

        vm.warp(reportedAt + window);
        vm.prank(ben);
        shed.settleUnconfirmed(loanId);

        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT - LATE_FEE, "fees stop at the reported return");
        assertEq(usdc.balanceOf(ana), anaBefore + LATE_FEE);
        assertEq(shed.getMember(ben).lateReturns, 1);
        assertEq(shed.getTool(shed.getLoan(loanId).toolId).activeLoanId, 0, "tool is available again");
    }

    function test_borrowerCannotSelfSettleWithoutReporting() public {
        (, uint64 loanId) = _activeLoan(3);
        vm.warp(block.timestamp + 30 days);
        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.WrongLoanStatus.selector, loanId, Toolshed.LoanStatus.Active));
        shed.settleUnconfirmed(loanId);
    }

    // --------------------------------------------------------------- unreturned

    function test_claimUnreturnedOnlyOnceDepositIsExhausted() public {
        (uint64 toolId, uint64 loanId) = _activeLoan(3);
        uint256 anaBefore = usdc.balanceOf(ana);

        uint64 dueAt = shed.getLoan(loanId).dueAt;
        uint64 claimableAt = dueAt + shed.MAX_OVERDUE();
        vm.warp(dueAt + 5 days); // 5 * 3 = 15 USDC of 40, and only 5 of 30 days overdue
        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotWriteOffableYet.selector, 15e6, DEPOSIT, claimableAt));
        shed.claimUnreturned(loanId);

        vm.warp(shed.getLoan(loanId).dueAt + 14 days); // 42 > 40, capped
        vm.prank(ana);
        shed.claimUnreturned(loanId);

        assertEq(usdc.balanceOf(ana), anaBefore + DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), 0);

        Toolshed.Member memory b = shed.getMember(ben);
        assertEq(b.loansTaken, 1);
        assertEq(b.lateReturns, 1);
        assertEq(b.unreturned, 1);

        Toolshed.Tool memory t = shed.getTool(toolId);
        assertFalse(t.listed, "a lost tool is taken off the browse screen");
        assertEq(t.activeLoanId, 0);
    }

    // ---------------------------------------------------------------- disputes

    function test_stewardResolvesDisputeWithASplit() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);
        uint256 anaBefore = usdc.balanceOf(ana);

        vm.warp(shed.getLoan(loanId).dueAt + 4 days);
        vm.prank(ben);
        shed.reportReturn(loanId);

        vm.prank(steward);
        shed.resolveLoan(loanId, 6e6, true, false);

        assertEq(usdc.balanceOf(ana), anaBefore + 6e6);
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT - 6e6);
        assertEq(shed.getMember(ben).lateReturns, 1);
    }

    function test_stewardCanForgiveALateReturn() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);

        vm.warp(shed.getLoan(loanId).dueAt + 4 days);
        vm.prank(steward);
        shed.resolveLoan(loanId, 0, false, false);

        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT);
        assertEq(shed.getMember(ben).lateReturns, 0);
        assertEq(shed.getMember(ben).loansTaken, 1);
    }

    function test_stewardCannotTakeMoreThanTheDeposit() public {
        (, uint64 loanId) = _activeLoan(3);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.FeeExceedsDeposit.selector, DEPOSIT + 1, DEPOSIT));
        shed.resolveLoan(loanId, DEPOSIT + 1, true, false);
    }

    function test_stewardCannotPayThemselves() public {
        // The only addresses _settle can pay are this loan's borrower and the tool's owner.
        (, uint64 loanId) = _activeLoan(3);
        uint256 stewardBefore = usdc.balanceOf(steward);
        vm.warp(shed.getLoan(loanId).dueAt + 2 days);
        vm.prank(steward);
        shed.resolveLoan(loanId, DEPOSIT, true, false);
        assertEq(usdc.balanceOf(steward), stewardBefore);
    }

    function test_onlyStewardResolves() public {
        (, uint64 loanId) = _activeLoan(3);
        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ana));
        shed.resolveLoan(loanId, 1e6, true, false);
    }

    // ------------------------------------------------------------ status guards

    function test_aSettledLoanCannotBeSettledTwice() public {
        (, uint64 loanId) = _activeLoan(3);
        vm.prank(ana);
        shed.confirmReturn(loanId);

        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.WrongLoanStatus.selector, loanId, Toolshed.LoanStatus.Settled));
        shed.confirmReturn(loanId);

        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.WrongLoanStatus.selector, loanId, Toolshed.LoanStatus.Settled));
        shed.reportReturn(loanId);
    }

    function test_unknownIdsRevert() public {
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NoSuchTool.selector, uint64(0)));
        shed.getTool(0);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NoSuchTool.selector, uint64(7)));
        shed.getTool(7);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NoSuchLoan.selector, uint64(1)));
        shed.getLoan(1);
    }

    function test_onlyRealOwnerCanConfirm() public {
        (uint64 toolId, uint64 loanId) = _activeLoan(3);
        vm.prank(cyd);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotToolOwner.selector, toolId));
        shed.confirmReturn(loanId);
    }

    // ------------------------------------------------------------------- pause

    function test_pauseStopsNewActivityButNotSettlement() public {
        (, uint64 loanId) = _activeLoan(3);
        uint64 spare = _listTool();
        vm.prank(cyd);
        uint64 pending = shed.requestLoan(spare, 2);

        vm.prank(steward);
        shed.setPaused(true);

        vm.prank(ana);
        vm.expectRevert(Toolshed.ContractPaused.selector);
        shed.listTool(URI, DEPOSIT, LATE_FEE, MAX_DAYS);

        vm.prank(ben);
        vm.expectRevert(Toolshed.ContractPaused.selector);
        shed.requestLoan(spare, 1);

        vm.prank(ana);
        vm.expectRevert(Toolshed.ContractPaused.selector);
        shed.approveRequest(pending);

        // Money already in escrow can always come out.
        vm.prank(ana);
        shed.confirmReturn(loanId);
        vm.prank(cyd);
        shed.withdrawRequest(pending);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    // -------------------------------------------------------------- track record

    function test_trackRecordAccumulatesAcrossLoans() public {
        uint64 toolId = _listTool();

        // Two on-time loans, then one late one.
        for (uint256 i; i < 2; ++i) {
            vm.prank(ben);
            uint64 id = shed.requestLoan(toolId, 3);
            vm.prank(ana);
            shed.approveRequest(id);
            vm.warp(block.timestamp + 1 days);
            vm.prank(ana);
            shed.confirmReturn(id);
        }
        vm.prank(ben);
        uint64 lateId = shed.requestLoan(toolId, 3);
        vm.prank(ana);
        shed.approveRequest(lateId);
        vm.warp(shed.getLoan(lateId).dueAt + 1 days);
        vm.prank(ana);
        shed.confirmReturn(lateId);

        Toolshed.Member memory b = shed.getMember(ben);
        assertEq(b.loansTaken, 3);
        assertEq(b.lateReturns, 1);
        assertEq(shed.getMember(ana).loansGiven, 3);

        // Withdrawn and declined requests never touch the record.
        vm.prank(cyd);
        uint64 withdrawn = shed.requestLoan(toolId, 1);
        vm.prank(cyd);
        shed.withdrawRequest(withdrawn);
        assertEq(shed.getMember(cyd).loansTaken, 0);
    }

    function test_batchReadsForTheBrowseScreen() public {
        vm.prank(ana);
        shed.listTool("ipfs://a", 10e6, 1e6, 3);
        vm.prank(ben);
        shed.listTool("ipfs://b", 20e6, 2e6, 3);
        vm.prank(cyd);
        shed.listTool("ipfs://c", 30e6, 3e6, 3);

        (Toolshed.Tool[] memory page, uint64[] memory ids) = shed.getTools(1, 2);
        assertEq(page.length, 2);
        assertEq(ids[0], 1);
        assertEq(page[1].metadataURI, "ipfs://b");

        (page, ids) = shed.getTools(3, 50); // asking past the end is clamped
        assertEq(page.length, 1);
        assertEq(ids[0], 3);

        (page,) = shed.getTools(9, 5);
        assertEq(page.length, 0);

        address[] memory who = new address[](2);
        who[0] = ana;
        who[1] = outsider;
        Toolshed.Member[] memory ms = shed.getMembers(who);
        assertTrue(ms[0].active);
        assertFalse(ms[1].active);
    }

    // --------------------------------- adversarial paths (from the security audit)

    /// A borrower who claims to have returned a tool they still have does not get to keep both:
    /// the owner disputes, the fee clock resumes, and the borrower cannot self-settle.
    function test_falseReturnReportIsDisputable() public {
        (uint64 toolId, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);
        uint256 anaBefore = usdc.balanceOf(ana);

        vm.prank(ben);
        shed.reportReturn(loanId); // lie, on day zero: fee frozen at 0
        (, uint96 frozenFee) = shed.accruedLateFee(loanId);
        assertEq(frozenFee, 0);

        vm.prank(ana);
        shed.disputeReturn(loanId);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Disputed));

        // The clock is running again from the original due date.
        vm.warp(shed.getLoan(loanId).dueAt + 4 days);
        (uint32 lateDays, uint96 fee) = shed.accruedLateFee(loanId);
        assertEq(lateDays, 4);
        assertEq(fee, 4 * uint256(LATE_FEE));

        // The borrower can no longer close it on their own word, whatever they try.
        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.WrongLoanStatus.selector, loanId, Toolshed.LoanStatus.Disputed));
        shed.settleUnconfirmed(loanId);
        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.WrongLoanStatus.selector, loanId, Toolshed.LoanStatus.Disputed));
        shed.reportReturn(loanId);

        // And the owner can still write the tool off once the deposit is consumed.
        vm.warp(shed.getLoan(loanId).dueAt + 14 days);
        vm.prank(ana);
        shed.claimUnreturned(loanId);

        assertEq(usdc.balanceOf(ana), anaBefore + DEPOSIT);
        assertEq(usdc.balanceOf(ben), benBefore);
        assertEq(shed.getMember(ben).unreturned, 1);
        assertFalse(shed.getTool(toolId).listed);
    }

    /// A disputed loan still ends normally if the tool turns up.
    function test_disputedLoanClosesIfToolTurnsUp() public {
        (, uint64 loanId) = _activeLoan(3);
        uint256 benBefore = usdc.balanceOf(ben);

        vm.prank(ben);
        shed.reportReturn(loanId);
        vm.prank(ana);
        shed.disputeReturn(loanId);

        vm.warp(shed.getLoan(loanId).dueAt + 1 days);
        vm.prank(ana);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT - LATE_FEE, "one day late, charged as such");
        assertEq(shed.getMember(ben).lateReturns, 1);
        assertEq(shed.getMember(ben).unreturned, 0);
    }

    function test_onlyOwnerDisputesAndOnlyFromAReportedReturn() public {
        (uint64 toolId, uint64 loanId) = _activeLoan(3);

        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.WrongLoanStatus.selector, loanId, Toolshed.LoanStatus.Active));
        shed.disputeReturn(loanId);

        vm.prank(ben);
        shed.reportReturn(loanId);
        vm.prank(cyd);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotToolOwner.selector, toolId));
        shed.disputeReturn(loanId);
    }

    /// A request nobody answered cannot be sprung on the borrower weeks later, and anyone can
    /// hand the deposit back.
    function test_staleRequestExpiresAndRefunds() public {
        uint64 toolId = _listTool();
        uint256 before = usdc.balanceOf(ben);
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 3);
        uint64 expiresAt = uint64(block.timestamp) + shed.REQUEST_TTL();

        vm.prank(cyd);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.RequestStillFresh.selector, expiresAt));
        shed.expireRequest(loanId);

        vm.warp(expiresAt + 1);
        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.RequestExpired.selector, expiresAt));
        shed.approveRequest(loanId);

        // Any neighbour can clear it out; the deposit goes back to the borrower, untouched.
        vm.prank(cyd);
        shed.expireRequest(loanId);
        assertEq(usdc.balanceOf(ben), before);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Expired));
        assertEq(shed.getMember(ben).loansTaken, 0, "an expired request is not a loan");
        assertEq(shed.totalEscrowed(), 0);
    }

    function test_zeroDailyLateFeeIsRejected() public {
        vm.prank(ana);
        vm.expectRevert(Toolshed.ZeroLateFee.selector);
        shed.listTool(URI, DEPOSIT, 0, MAX_DAYS);
    }

    /// A tiny late fee against a big deposit would otherwise take years to write off a lost tool.
    function test_writeOffPossibleAfterMaxOverdueEvenWithATinyFee() public {
        vm.prank(ana);
        uint64 toolId = shed.listTool(URI, 500e6, 1e6, 3); // 500 days of fees to consume it
        usdc.mint(ben, 500e6);
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 3);
        vm.prank(ana);
        shed.approveRequest(loanId);

        uint64 dueAt = shed.getLoan(loanId).dueAt;
        uint256 anaBefore = usdc.balanceOf(ana);

        vm.warp(dueAt + shed.MAX_OVERDUE() + 1);
        vm.prank(ana);
        shed.claimUnreturned(loanId);

        assertEq(usdc.balanceOf(ana), anaBefore + 500e6, "owner is made whole, capped at the deposit");
        assertEq(shed.getMember(ben).unreturned, 1);
        assertEq(shed.totalEscrowed(), 0);
    }

    function test_suspendedOwnerCannotStartNewLoans() public {
        uint64 toolId = _listTool();
        vm.prank(cyd);
        uint64 pending = shed.requestLoan(toolId, 2);

        vm.prank(steward);
        shed.suspendMember(ana);

        // Ana cannot approve the request she already has…
        vm.prank(ana);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotAMember.selector, ana));
        shed.approveRequest(pending);

        // …and her tools are out of circulation even though they are still listed.
        vm.prank(ben);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotAMember.selector, ana));
        shed.requestLoan(toolId, 1);

        // Cyd's escrowed deposit is not held hostage by the suspension.
        uint256 before = usdc.balanceOf(cyd);
        vm.prank(cyd);
        shed.withdrawRequest(pending);
        assertEq(usdc.balanceOf(cyd), before + DEPOSIT);
    }

    function test_stewardCannotAdjudicateTheirOwnLoan() public {
        // The steward lists a tool and lends it out, then tries to award themselves the deposit.
        vm.prank(steward);
        shed.admitMember(steward);
        usdc.mint(steward, 100e6);
        vm.startPrank(steward);
        usdc.approve(address(shed), type(uint256).max);
        uint64 toolId = shed.listTool(URI, DEPOSIT, LATE_FEE, MAX_DAYS);
        vm.stopPrank();

        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 2);
        vm.prank(steward);
        shed.approveRequest(loanId);

        uint256 stewardBefore = usdc.balanceOf(steward);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.StewardIsAParty.selector, loanId));
        shed.resolveLoan(loanId, DEPOSIT, true, false);
        assertEq(usdc.balanceOf(steward), stewardBefore);

        // As the tool's owner they still have the ordinary path, on the ordinary terms.
        vm.warp(shed.getLoan(loanId).dueAt + 1 days);
        vm.prank(steward);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(steward), stewardBefore + LATE_FEE, "only the late fee they actually earned");
    }

    function test_stewardCanRecordAnUnreturnedToolWhenResolving() public {
        (, uint64 loanId) = _activeLoan(3);
        vm.warp(shed.getLoan(loanId).dueAt + 2 days);
        vm.prank(steward);
        shed.resolveLoan(loanId, DEPOSIT, true, true);

        Toolshed.Member memory b = shed.getMember(ben);
        assertEq(b.unreturned, 1);
        assertEq(b.lateReturns, 1);
    }

    function test_renouncingOwnershipIsDisabled() public {
        vm.prank(steward);
        vm.expectRevert(Toolshed.OwnershipCannotBeRenounced.selector);
        shed.renounceOwnership();
        assertEq(shed.owner(), steward);
    }

    function test_getToolsClampsInsteadOfReverting() public {
        _listTool();
        (Toolshed.Tool[] memory all,) = shed.getTools(1, type(uint64).max);
        assertEq(all.length, 1, "asking for everything is a valid request");
        (Toolshed.Tool[] memory none,) = shed.getTools(0, 0);
        assertEq(none.length, 0);
    }

    function test_strayTokensAreRecoverableButEscrowIsNot() public {
        (, uint64 loanId) = _activeLoan(3);
        usdc.mint(address(shed), 7e6); // someone pays the contract directly by mistake

        assertEq(shed.totalEscrowed(), DEPOSIT);
        uint256 stewardBefore = usdc.balanceOf(steward);
        vm.prank(steward);
        shed.sweepStrayTokens(steward);
        assertEq(usdc.balanceOf(steward), stewardBefore + 7e6, "only the surplus");
        assertEq(usdc.balanceOf(address(shed)), DEPOSIT, "the open deposit is untouched");

        vm.prank(steward);
        vm.expectRevert(Toolshed.NothingToSweep.selector);
        shed.sweepStrayTokens(steward);

        // And the loan still settles normally afterwards.
        uint256 benBefore = usdc.balanceOf(ben);
        vm.prank(ana);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT);
        assertEq(shed.totalEscrowed(), 0);
    }

    // -------------------------------------------------------------------- fuzz

    /// @dev Whatever the terms and whatever the delay, escrow conserves value exactly and the
    ///      borrower never loses more than the deposit.
    function testFuzz_settlementConservesTheDeposit(
        uint96 deposit,
        uint96 dailyFee,
        uint16 loanDays,
        uint32 delaySeconds
    ) public {
        deposit = uint96(bound(deposit, 1, MAX_DEPOSIT));
        dailyFee = uint96(bound(dailyFee, 1, deposit));
        loanDays = uint16(bound(loanDays, 1, 365));
        uint256 delay = bound(delaySeconds, 0, 400 days);

        vm.prank(ana);
        uint64 toolId = shed.listTool(URI, deposit, dailyFee, loanDays);

        usdc.mint(ben, deposit);
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, loanDays);
        vm.prank(ana);
        shed.approveRequest(loanId);

        uint256 benBefore = usdc.balanceOf(ben);
        uint256 anaBefore = usdc.balanceOf(ana);
        uint64 dueAt = shed.getLoan(loanId).dueAt;

        vm.warp(uint256(shed.getLoan(loanId).startedAt) + delay);
        vm.prank(ana);
        shed.confirmReturn(loanId);

        uint256 anaGain = usdc.balanceOf(ana) - anaBefore;
        uint256 benGain = usdc.balanceOf(ben) - benBefore;
        assertEq(anaGain + benGain, deposit, "every cent of escrow is paid out");
        assertEq(usdc.balanceOf(address(shed)), 0, "nothing is left behind");
        assertEq(shed.totalEscrowed(), 0, "and the contract knows it owes nothing");
        assertLe(anaGain, deposit, "owner can never get more than the deposit");

        uint256 expectedDays = block.timestamp <= dueAt ? 0 : (block.timestamp - dueAt + 1 days - 1) / 1 days;
        uint256 expectedFee = expectedDays * uint256(dailyFee);
        if (expectedFee > deposit) expectedFee = deposit;
        assertEq(anaGain, expectedFee, "fee is ceil(days late) * daily fee, capped");
    }

    /// @dev The contract's balance always equals the sum of the deposits it is still holding.
    function testFuzz_escrowMatchesOpenDeposits(uint8 actions, uint256 seed) public {
        uint64 toolA = _listTool();
        vm.prank(ben);
        uint64 spareTool = shed.listTool(URI, DEPOSIT, LATE_FEE, MAX_DAYS);

        uint64[] memory open = new uint64[](uint256(actions) + 2);
        uint256 openCount;
        uint256 held;

        for (uint256 i; i < uint256(actions) % 12; ++i) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            uint256 action = seed % 3;
            if (action == 0) {
                uint64 toolId = seed % 2 == 0 ? toolA : spareTool;
                address who = toolId == toolA ? cyd : cyd;
                if (shed.getTool(toolId).activeLoanId != 0) continue;
                usdc.mint(who, DEPOSIT);
                vm.prank(who);
                uint64 id = shed.requestLoan(toolId, 2);
                open[openCount++] = id;
                held += DEPOSIT;
            } else if (openCount > 0) {
                uint64 id = open[--openCount];
                Toolshed.Loan memory l = shed.getLoan(id);
                if (l.status != Toolshed.LoanStatus.Requested) continue;
                if (action == 1) {
                    vm.prank(l.borrower);
                    shed.withdrawRequest(id);
                } else {
                    vm.prank(shed.getTool(l.toolId).owner);
                    shed.declineRequest(id);
                }
                held -= DEPOSIT;
            }
            assertEq(usdc.balanceOf(address(shed)), held);
            assertEq(shed.totalEscrowed(), held, "the contract's own accounting agrees");
        }
    }
}
