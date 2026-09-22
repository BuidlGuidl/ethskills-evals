// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract ToolshedTest is Test {
    Toolshed internal shed;
    MockUSDC internal usdc;

    address internal alice = makeAddr("alice"); // tool owner
    address internal bob = makeAddr("bob"); // borrower
    address internal carol = makeAddr("carol"); // bystander

    uint96 internal constant DEPOSIT = 60e6; // $60
    uint96 internal constant DAILY_FEE = 2e6; // $2/day
    uint32 internal constant DURATION = 4; // days
    bytes32 internal constant LISTING = keccak256("listing:circular-saw");

    function setUp() public {
        usdc = new MockUSDC();
        shed = new Toolshed(IERC20(address(usdc)));
        usdc.mint(bob, 1_000e6);
        vm.prank(bob);
        usdc.approve(address(shed), type(uint256).max);
        // Start well past the epoch so `block.timestamp` arithmetic is realistic.
        vm.warp(1_800_000_000);
    }

    function _request() internal returns (uint256 loanId) {
        vm.prank(bob);
        loanId = shed.request(alice, LISTING, DEPOSIT, DAILY_FEE, DURATION);
    }

    function _activeLoan() internal returns (uint256 loanId) {
        loanId = _request();
        vm.prank(alice);
        shed.approve(loanId);
    }

    // ---------------------------------------------------------------
    // Request / approval
    // ---------------------------------------------------------------

    function test_request_escrowsDeposit() public {
        uint256 loanId = _request();

        assertEq(usdc.balanceOf(address(shed)), DEPOSIT);
        assertEq(usdc.balanceOf(bob), 1_000e6 - DEPOSIT);

        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(loan.owner, alice);
        assertEq(loan.borrower, bob);
        assertEq(uint8(loan.status), uint8(Toolshed.Status.Requested));
        assertEq(loan.dueAt, 0);
    }

    function test_request_rejectsBadTerms() public {
        vm.startPrank(bob);
        vm.expectRevert(Toolshed.SelfLoan.selector);
        shed.request(bob, LISTING, DEPOSIT, DAILY_FEE, DURATION);

        vm.expectRevert(Toolshed.ZeroDeposit.selector);
        shed.request(alice, LISTING, 0, DAILY_FEE, DURATION);

        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.request(alice, LISTING, DEPOSIT, DAILY_FEE, 0);

        vm.expectRevert(Toolshed.BadDuration.selector);
        shed.request(alice, LISTING, DEPOSIT, DAILY_FEE, 91);

        vm.expectRevert(Toolshed.FeeExceedsDeposit.selector);
        shed.request(alice, LISTING, DEPOSIT, DEPOSIT + 1, DURATION);
        vm.stopPrank();
    }

    function test_approve_setsDueDate() public {
        uint256 loanId = _request();
        vm.prank(alice);
        shed.approve(loanId);

        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(Toolshed.Status.Active));
        assertEq(loan.dueAt, uint64(block.timestamp) + DURATION * 1 days);
    }

    function test_approve_onlyOwner() public {
        uint256 loanId = _request();
        vm.prank(carol);
        vm.expectRevert(Toolshed.NotOwner.selector);
        shed.approve(loanId);
    }

    function test_approve_revertsAfterTtl() public {
        uint256 loanId = _request();
        skip(3 days + 1);
        vm.prank(alice);
        vm.expectRevert(Toolshed.RequestExpired.selector);
        shed.approve(loanId);
    }

    function test_decline_refundsInFull() public {
        uint256 loanId = _request();
        vm.prank(alice);
        shed.decline(loanId);

        assertEq(usdc.balanceOf(bob), 1_000e6);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.Status.Cancelled));
    }

    function test_withdrawRequest_onlyBorrower() public {
        uint256 loanId = _request();
        vm.prank(carol);
        vm.expectRevert(Toolshed.NotBorrower.selector);
        shed.withdrawRequest(loanId);

        vm.prank(bob);
        shed.withdrawRequest(loanId);
        assertEq(usdc.balanceOf(bob), 1_000e6);
    }

    /// A silent owner must never be able to sit on a borrower's deposit.
    function test_expireRequest_isPermissionlessAfterTtl() public {
        uint256 loanId = _request();

        vm.prank(carol);
        vm.expectRevert(Toolshed.RequestNotExpired.selector);
        shed.expireRequest(loanId);

        skip(3 days + 1);
        vm.prank(carol);
        shed.expireRequest(loanId);

        assertEq(usdc.balanceOf(bob), 1_000e6);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    // ---------------------------------------------------------------
    // Settlement
    // ---------------------------------------------------------------

    function test_onTimeReturn_refundsWholeDeposit() public {
        uint256 loanId = _activeLoan();
        skip(3 days);

        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(bob), 1_000e6);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.Status.Settled));
    }

    function test_lateReturn_splitsDeposit() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 2 days); // exactly 2 days late

        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), 2 * DAILY_FEE);
        assertEq(usdc.balanceOf(bob), 1_000e6 - 2 * DAILY_FEE);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    /// A started day counts as a whole day, like a library desk.
    function test_partialDayCountsAsFullDay() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 1 hours);

        (uint256 fee, uint256 daysLate) = shed.quoteLateFee(loanId, uint64(block.timestamp));
        assertEq(daysLate, 1);
        assertEq(fee, DAILY_FEE);
    }

    function test_lateFeeCapsAtDeposit() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 400 days);

        (uint256 fee,) = shed.quoteLateFee(loanId, uint64(block.timestamp));
        assertEq(fee, DEPOSIT);

        vm.prank(alice);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(alice), DEPOSIT);
        assertEq(usdc.balanceOf(bob), 1_000e6 - DEPOSIT);
    }

    function test_confirmReturn_onlyOwner() public {
        uint256 loanId = _activeLoan();
        vm.prank(bob);
        vm.expectRevert(Toolshed.NotOwner.selector);
        shed.confirmReturn(loanId);
    }

    function test_settledLoanCannotSettleTwice() public {
        uint256 loanId = _activeLoan();
        vm.startPrank(alice);
        shed.confirmReturn(loanId);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.BadStatus.selector, Toolshed.Status.Settled));
        shed.confirmReturn(loanId);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------
    // Borrower liveness path
    // ---------------------------------------------------------------

    /// If the owner goes quiet after a real return, the borrower still gets out.
    function test_assertReturn_thenSettleUnchallenged() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 1 days); // 1 day late at assertion

        vm.prank(bob);
        shed.assertReturn(loanId);

        skip(3 days);
        vm.prank(carol); // permissionless once the window closes
        shed.settleUnchallenged(loanId);

        // Charged for the 1 day, not for the owner's 3 days of silence.
        assertEq(usdc.balanceOf(alice), DAILY_FEE);
        assertEq(usdc.balanceOf(bob), 1_000e6 - DAILY_FEE);
    }

    function test_settleUnchallenged_revertsDuringWindow() public {
        uint256 loanId = _activeLoan();
        vm.prank(bob);
        shed.assertReturn(loanId);

        skip(3 days - 1);
        vm.expectRevert(Toolshed.ChallengeWindowOpen.selector);
        shed.settleUnchallenged(loanId);
    }

    /// Accrual freezes at the assertion, so a slow owner earns nothing extra.
    function test_confirmAfterAssertion_usesAssertionTime() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 1 days);

        vm.prank(bob);
        shed.assertReturn(loanId);

        skip(10 days);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), DAILY_FEE);
    }

    function test_assertReturn_onlyBorrower() public {
        uint256 loanId = _activeLoan();
        vm.prank(carol);
        vm.expectRevert(Toolshed.NotBorrower.selector);
        shed.assertReturn(loanId);
    }

    // ---------------------------------------------------------------
    // Objection
    // ---------------------------------------------------------------

    function test_objection_resumesAccrual() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 1 days);

        vm.prank(bob);
        shed.assertReturn(loanId);
        vm.prank(alice);
        shed.objectToReturn(loanId);

        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(Toolshed.Status.Active));
        assertEq(loan.assertedAt, 0);
        assertTrue(loan.objected);

        // The clock never really paused: 3 days total late by now.
        skip(2 days);
        (uint256 fee,) = shed.quoteLateFee(loanId, uint64(block.timestamp));
        assertEq(fee, 3 * DAILY_FEE);
    }

    /// One objection only — otherwise an owner could drain the deposit by
    /// objecting to every assertion until the cap is reached.
    function test_objection_allowedOnlyOnce() public {
        uint256 loanId = _activeLoan();

        vm.prank(bob);
        shed.assertReturn(loanId);
        vm.prank(alice);
        shed.objectToReturn(loanId);

        vm.prank(bob);
        shed.assertReturn(loanId);
        vm.prank(alice);
        vm.expectRevert(Toolshed.AlreadyObjected.selector);
        shed.objectToReturn(loanId);

        skip(3 days);
        vm.prank(bob);
        shed.settleUnchallenged(loanId);
        assertEq(usdc.balanceOf(bob), 1_000e6);
    }

    function test_objection_revertsAfterWindow() public {
        uint256 loanId = _activeLoan();
        vm.prank(bob);
        shed.assertReturn(loanId);

        skip(3 days + 1);
        vm.prank(alice);
        vm.expectRevert(Toolshed.ChallengeWindowClosed.selector);
        shed.objectToReturn(loanId);
    }

    // ---------------------------------------------------------------
    // Unreturned tools
    // ---------------------------------------------------------------

    /// If the borrower vanishes, the loan still reaches a terminal state and
    /// the owner is made whole up to the deposit.
    function test_claimUnreturned_afterDepositExhausted() public {
        uint256 loanId = _activeLoan();
        uint256 daysToCap = DEPOSIT / DAILY_FEE; // 30 days

        skip(DURATION * 1 days + (daysToCap - 1) * 1 days);
        vm.expectRevert(Toolshed.DepositNotExhausted.selector);
        shed.claimUnreturned(loanId);

        skip(1 days);
        vm.prank(carol); // permissionless: funds only ever go to the owner
        shed.claimUnreturned(loanId);

        assertEq(usdc.balanceOf(alice), DEPOSIT);
        assertEq(usdc.balanceOf(address(shed)), 0);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.Status.Settled));
    }

    function test_settledEvent_carriesTrackRecordFacts() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 2 days);

        vm.expectEmit(true, true, true, true);
        emit Toolshed.LoanSettled(loanId, alice, bob, 2 * DAILY_FEE, DEPOSIT - 2 * DAILY_FEE, 2, false);
        vm.prank(alice);
        shed.confirmReturn(loanId);
    }

    // ---------------------------------------------------------------
    // Deferred payouts
    // ---------------------------------------------------------------

    /// A frozen borrower must not be able to trap the owner's late fee.
    function test_blockedRefund_isCreditedNotReverted() public {
        uint256 loanId = _activeLoan();
        skip(DURATION * 1 days + 2 days);

        usdc.setBlacklisted(bob, true);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), 2 * DAILY_FEE, "owner still paid");
        assertEq(shed.owed(bob), DEPOSIT - 2 * DAILY_FEE, "refund credited");

        usdc.setBlacklisted(bob, false);
        vm.prank(bob);
        shed.withdraw();
        assertEq(usdc.balanceOf(bob), 1_000e6 - 2 * DAILY_FEE);
        assertEq(shed.owed(bob), 0);
    }

    function test_withdraw_revertsWhenNothingOwed() public {
        vm.prank(bob);
        vm.expectRevert(Toolshed.NothingOwed.selector);
        shed.withdraw();
    }

    // ---------------------------------------------------------------
    // Invariant-ish fuzzing
    // ---------------------------------------------------------------

    /// The split always pays out exactly the deposit, never more, never less.
    function testFuzz_splitConservesDeposit(uint96 deposit, uint96 dailyFee, uint32 durationDays, uint32 lateSeconds)
        public
    {
        deposit = uint96(bound(deposit, 1, 100_000e6));
        dailyFee = uint96(bound(dailyFee, 0, deposit));
        durationDays = uint32(bound(durationDays, 1, 90));
        lateSeconds = uint32(bound(lateSeconds, 0, 365 days));

        usdc.mint(bob, deposit);
        vm.prank(bob);
        uint256 loanId = shed.request(alice, LISTING, deposit, dailyFee, durationDays);
        vm.prank(alice);
        shed.approve(loanId);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        skip(uint256(durationDays) * 1 days + lateSeconds);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        uint256 toOwner = usdc.balanceOf(alice) - aliceBefore;
        uint256 toBorrower = usdc.balanceOf(bob) - bobBefore;
        assertEq(toOwner + toBorrower, deposit, "deposit conserved");
        assertLe(toOwner, deposit, "fee capped at deposit");
        assertEq(usdc.balanceOf(address(shed)), 0, "escrow drained");
    }
}
