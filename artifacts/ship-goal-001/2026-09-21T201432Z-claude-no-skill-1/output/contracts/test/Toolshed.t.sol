// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {MockUSDC} from "../src/test/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

contract ToolshedTest is Test {
    MockUSDC usdc;
    MemberRegistry registry;
    Toolshed shed;

    address steward = makeAddr("steward");
    address alice = makeAddr("alice"); // owns the tool
    address bob = makeAddr("bob"); // borrows
    address carol = makeAddr("carol");
    address outsider = makeAddr("outsider");

    uint96 constant DEPOSIT = 60e6; // 60 USDC
    uint96 constant LATE_FEE = 5e6; // 5 USDC / day

    uint64 toolId;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MemberRegistry(steward);
        shed = new Toolshed(IERC20(address(usdc)), registry);

        vm.startPrank(steward);
        registry.setLedger(address(shed), true);
        registry.addMember(alice, "Alice");
        registry.addMember(bob, "Bob");
        registry.addMember(carol, "Carol");
        vm.stopPrank();

        usdc.mint(bob, 1000e6);
        usdc.mint(carol, 1000e6);
        vm.prank(bob);
        usdc.approve(address(shed), type(uint256).max);
        vm.prank(carol);
        usdc.approve(address(shed), type(uint256).max);

        vm.prank(alice);
        toolId =
            shed.listTool("Circular saw", "ipfs://cid", "Blade is sharp, guard sticks", DEPOSIT, LATE_FEE);
    }

    function _activeLoan(address borrower, uint32 days_) internal returns (uint64 loanId) {
        vm.prank(borrower);
        loanId = shed.requestLoan(toolId, days_);
        vm.prank(alice);
        shed.approveRequest(loanId);
    }

    // --- listing ---------------------------------------------------------------

    function test_onlyMembersCanList() public {
        vm.prank(outsider);
        vm.expectRevert(Toolshed.NotAMember.selector);
        shed.listTool("Ladder", "", "", DEPOSIT, LATE_FEE);
    }

    function test_listedToolShowsUpInBrowse() public {
        Toolshed.Tool[] memory page = shed.getTools(0, 50);
        assertEq(page.length, 1);
        assertEq(page[0].name, "Circular saw");
        assertEq(page[0].owner, alice);
        assertTrue(page[0].listed);
    }

    function test_lateFeeCannotExceedDeposit() public {
        vm.prank(alice);
        vm.expectRevert(Toolshed.BadTerms.selector);
        shed.listTool("Ladder", "", "", 10e6, 11e6);
    }

    // --- requesting ------------------------------------------------------------

    function test_requestEscrowsDeposit() public {
        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);
        assertEq(usdc.balanceOf(bob), before - DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), DEPOSIT);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Pending));
    }

    function test_cannotBorrowOwnTool() public {
        vm.prank(alice);
        vm.expectRevert(Toolshed.CannotBorrowOwnTool.selector);
        shed.requestLoan(toolId, 3);
    }

    function test_declineRefundsDeposit() public {
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);
        vm.prank(alice);
        shed.declineRequest(loanId);
        assertEq(usdc.balanceOf(bob), 1000e6);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Declined));
    }

    function test_borrowerCanCancelPendingRequest() public {
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);
        vm.prank(bob);
        shed.cancelRequest(loanId);
        assertEq(usdc.balanceOf(bob), 1000e6);
    }

    function test_onlyOwnerApproves() public {
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);
        vm.prank(carol);
        vm.expectRevert(Toolshed.NotToolOwner.selector);
        shed.approveRequest(loanId);
    }

    function test_approvalStartsClockAndLocksTool() public {
        uint64 loanId = _activeLoan(bob, 3);
        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertEq(l.dueAt, uint64(block.timestamp) + 3 days);
        assertEq(shed.getTool(toolId).activeLoanId, loanId);

        // A second request can be made, but it cannot be approved while the tool is out.
        vm.prank(carol);
        uint64 second = shed.requestLoan(toolId, 2);
        vm.prank(alice);
        vm.expectRevert(Toolshed.ToolIsOut.selector);
        shed.approveRequest(second);
    }

    // --- returns and late fees -------------------------------------------------

    function test_onTimeReturnRefundsEverything() public {
        uint64 loanId = _activeLoan(bob, 3);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(bob), 1000e6);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(shed.getTool(toolId).activeLoanId, 0);

        MemberRegistry.Member memory m = registry.getMember(bob);
        assertEq(m.loansBorrowed, 1);
        assertEq(m.lateReturns, 0);
        assertEq(registry.reliabilityBps(bob), 10_000);
        assertEq(registry.getMember(alice).loansLent, 1);
    }

    function test_lateReturnPaysOwnerPerStartedDay() public {
        uint64 loanId = _activeLoan(bob, 3);
        // 2 days and 1 hour late -> 3 started days.
        vm.warp(block.timestamp + 3 days + 2 days + 1 hours);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        uint96 expectedFee = 3 * LATE_FEE;
        assertEq(usdc.balanceOf(alice), expectedFee);
        assertEq(usdc.balanceOf(bob), 1000e6 - expectedFee);
        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertEq(l.lateDays, 3);
        assertEq(l.lateFeePaid, expectedFee);
        assertEq(registry.getMember(bob).lateReturns, 1);
        assertEq(registry.reliabilityBps(bob), 0);
    }

    function test_lateFeeIsCappedAtDeposit() public {
        uint64 loanId = _activeLoan(bob, 1);
        vm.warp(block.timestamp + 1 days + 100 days);
        vm.prank(alice);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(alice), DEPOSIT);
        assertEq(usdc.balanceOf(bob), 1000e6 - DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    function test_reportedReturnFreezesTheClock() public {
        uint64 loanId = _activeLoan(bob, 3);
        vm.warp(block.timestamp + 4 days); // 1 day late
        vm.prank(bob);
        shed.reportReturn(loanId);

        vm.warp(block.timestamp + 2 days); // owner is slow to confirm
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), LATE_FEE);
        assertEq(shed.getLoan(loanId).lateDays, 1);
    }

    function test_borrowerCanFinalizeAfterConfirmationWindow() public {
        uint64 loanId = _activeLoan(bob, 3);
        vm.warp(block.timestamp + 3 days);
        vm.prank(bob);
        shed.reportReturn(loanId);

        vm.prank(bob);
        vm.expectRevert(Toolshed.TooEarly.selector);
        shed.finalizeReportedReturn(loanId);

        vm.warp(block.timestamp + shed.CONFIRMATION_WINDOW());
        vm.prank(bob);
        shed.finalizeReportedReturn(loanId);
        assertEq(usdc.balanceOf(bob), 1000e6);
        assertEq(registry.getMember(bob).loansBorrowed, 1);
    }

    function test_defaultAfterWindowGivesOwnerTheWholeDeposit() public {
        uint64 loanId = _activeLoan(bob, 2);
        vm.warp(block.timestamp + 2 days + shed.DEFAULT_WINDOW() - 1);
        vm.prank(alice);
        vm.expectRevert(Toolshed.TooEarly.selector);
        shed.claimDefault(loanId);

        vm.warp(block.timestamp + 1);
        vm.prank(alice);
        shed.claimDefault(loanId);

        assertEq(usdc.balanceOf(alice), DEPOSIT);
        MemberRegistry.Member memory m = registry.getMember(bob);
        assertEq(m.defaults, 1);
        assertEq(m.lateReturns, 1);
        assertEq(m.loansBorrowed, 1);
        assertEq(shed.getTool(toolId).activeLoanId, 0);
    }

    function test_defaultBlockedOnceReturnReported() public {
        uint64 loanId = _activeLoan(bob, 2);
        vm.warp(block.timestamp + 3 days);
        vm.prank(bob);
        shed.reportReturn(loanId);
        vm.warp(block.timestamp + shed.DEFAULT_WINDOW());
        vm.prank(alice);
        vm.expectRevert(Toolshed.ReturnAlreadyReported.selector);
        shed.claimDefault(loanId);
    }

    function test_accruedLateFeePreviewsTheSplit() public {
        uint64 loanId = _activeLoan(bob, 3);
        assertEq(shed.accruedLateFee(loanId), 0);
        vm.warp(block.timestamp + 5 days); // 2 days late
        assertEq(shed.accruedLateFee(loanId), 2 * LATE_FEE);
    }

    function test_settleDisputeSplitsDeposit() public {
        uint64 loanId = _activeLoan(bob, 3);
        vm.warp(block.timestamp + 10 days);

        vm.prank(alice);
        vm.expectRevert(Toolshed.NotSteward.selector);
        shed.settleDispute(loanId, 10e6, true);

        vm.prank(steward);
        vm.expectRevert(Toolshed.AmountTooHigh.selector);
        shed.settleDispute(loanId, DEPOSIT + 1, true);

        vm.prank(steward);
        shed.settleDispute(loanId, 10e6, true);
        assertEq(usdc.balanceOf(alice), 10e6);
        assertEq(usdc.balanceOf(bob), 1000e6 - 10e6);
        assertEq(registry.getMember(bob).lateReturns, 1);
    }

    function test_settledLoanCannotBeSettledTwice() public {
        uint64 loanId = _activeLoan(bob, 3);
        vm.prank(alice);
        shed.confirmReturn(loanId);
        vm.prank(alice);
        vm.expectRevert(Toolshed.WrongStatus.selector);
        shed.confirmReturn(loanId);
    }

    function test_removedMemberCannotBeHandedATool() public {
        vm.prank(bob);
        uint64 loanId = shed.requestLoan(toolId, 3);
        vm.prank(steward);
        registry.deactivateMember(bob);
        vm.prank(alice);
        vm.expectRevert(Toolshed.NotAMember.selector);
        shed.approveRequest(loanId);
        // ... but their escrowed deposit is not stuck.
        vm.prank(alice);
        shed.declineRequest(loanId);
        assertEq(usdc.balanceOf(bob), 1000e6);
    }

    function test_toolCanBeLentAgainAfterReturn() public {
        uint64 first = _activeLoan(bob, 1);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        shed.confirmReturn(first);
        uint64 second = _activeLoan(carol, 2);
        assertEq(shed.getTool(toolId).activeLoanId, second);
    }

    // --- track record ----------------------------------------------------------

    function test_reliabilityRanksBorrowers() public {
        // Bob: 2 loans, 1 late. Carol: 1 loan, on time.
        uint64 l1 = _activeLoan(bob, 1);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        shed.confirmReturn(l1);

        uint64 l2 = _activeLoan(bob, 1);
        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        shed.confirmReturn(l2);

        uint64 l3 = _activeLoan(carol, 1);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        shed.confirmReturn(l3);

        assertEq(registry.reliabilityBps(bob), 5000);
        assertEq(registry.reliabilityBps(carol), 10_000);
        assertEq(registry.reliabilityBps(outsider), registry.NEWCOMER_SCORE_BPS());
    }

    function test_onlyLedgerWritesTrackRecord() public {
        vm.prank(bob);
        vm.expectRevert(MemberRegistry.NotLedger.selector);
        registry.recordSettledLoan(bob, alice, false);
    }

    function test_rosterPaging() public {
        (address[] memory addrs, MemberRegistry.Member[] memory members) = registry.getMembers(0, 10);
        assertEq(addrs.length, 3);
        assertEq(members[0].displayName, "Alice");
        (addrs,) = registry.getMembers(2, 10);
        assertEq(addrs.length, 1);
        assertEq(addrs[0], carol);
    }

    function test_deactivatedMemberCanBeReadded() public {
        vm.prank(steward);
        registry.deactivateMember(bob);
        assertFalse(registry.isActiveMember(bob));
        vm.prank(steward);
        registry.addMember(bob, "Bob again");
        assertTrue(registry.isActiveMember(bob));
        assertEq(registry.memberCount(), 3); // no duplicate roster entry
    }

    function testFuzz_settlementNeverLosesOrInventsMoney(uint32 days_, uint32 lateSeconds, uint96 fee)
        public
    {
        days_ = uint32(bound(days_, 1, shed.MAX_LOAN_DAYS()));
        fee = uint96(bound(fee, 0, DEPOSIT));
        vm.prank(alice);
        uint64 t2 = shed.listTool("Fuzz tool", "", "", DEPOSIT, fee);

        vm.prank(bob);
        uint64 loanId = shed.requestLoan(t2, days_);
        vm.prank(alice);
        shed.approveRequest(loanId);

        vm.warp(block.timestamp + uint256(days_) * 1 days + lateSeconds);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        Toolshed.Loan memory l = shed.getLoan(loanId);
        assertLe(l.lateFeePaid, DEPOSIT);
        assertEq(usdc.balanceOf(alice) + usdc.balanceOf(bob), 1000e6);
        assertEq(usdc.balanceOf(address(shed)), 0);
        assertEq(usdc.balanceOf(alice), l.lateFeePaid);
    }
}
