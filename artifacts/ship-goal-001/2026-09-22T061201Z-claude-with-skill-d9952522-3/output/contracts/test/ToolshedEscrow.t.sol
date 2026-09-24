// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ToolshedEscrow} from "../src/ToolshedEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract ToolshedEscrowTest is Test {
    ToolshedEscrow internal escrow;
    MockUSDC internal usdc;

    uint256 internal ownerKey = 0xA11CE;
    uint256 internal borrowerKey = 0xB0B;
    address internal owner;
    address internal borrower;
    address internal arbiter = address(0xA2B);

    uint128 internal constant DEPOSIT = 120e6; // 120 USDC
    uint128 internal constant DAILY_FEE = 5e6; // 5 USDC/day -> forfeit 24 days after due
    bytes32 internal constant LISTING = keccak256("listing:circular-saw");

    function setUp() public {
        owner = vm.addr(ownerKey);
        borrower = vm.addr(borrowerKey);
        usdc = new MockUSDC();
        escrow = new ToolshedEscrow(IERC20(address(usdc)), arbiter);

        usdc.mint(borrower, 1_000e6);
        vm.prank(borrower);
        usdc.approve(address(escrow), type(uint256).max);

        vm.warp(1_750_000_000);
    }

    // ------------------------------------------------------------------ helpers

    function _terms(uint64 durationDays, uint256 salt)
        internal
        view
        returns (ToolshedEscrow.Terms memory)
    {
        return ToolshedEscrow.Terms({
            owner: owner,
            borrower: borrower,
            listingId: LISTING,
            deposit: DEPOSIT,
            dailyLateFee: DAILY_FEE,
            dueAt: uint64(block.timestamp) + durationDays * 1 days,
            offerExpiry: uint64(block.timestamp) + 1 days,
            salt: salt
        });
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _open(ToolshedEscrow.Terms memory terms) internal returns (bytes32) {
        bytes memory sig = _sign(ownerKey, escrow.hashTerms(terms));
        vm.prank(borrower);
        return escrow.openLoan(terms, sig);
    }

    function _openDefault() internal returns (bytes32, ToolshedEscrow.Terms memory) {
        ToolshedEscrow.Terms memory terms = _terms(3, 1);
        return (_open(terms), terms);
    }

    // ------------------------------------------------------------------ opening

    function test_openLoan_escrowsDeposit() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();

        assertEq(usdc.balanceOf(address(escrow)), DEPOSIT, "escrow holds deposit");
        assertEq(usdc.balanceOf(borrower), 1_000e6 - DEPOSIT, "borrower paid deposit");

        ToolshedEscrow.Loan memory loan = escrow.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(ToolshedEscrow.Status.Active));
        assertEq(loan.owner, owner);
        assertEq(loan.borrower, borrower);
        assertEq(loan.deposit, DEPOSIT);
        assertEq(loan.dueAt, terms.dueAt);
        assertEq(loan.startedAt, uint64(block.timestamp));
    }

    function test_openLoan_revertsForWrongCaller() public {
        ToolshedEscrow.Terms memory terms = _terms(3, 1);
        bytes memory sig = _sign(ownerKey, escrow.hashTerms(terms));
        address stranger = address(0xDEAD);
        usdc.mint(stranger, DEPOSIT);
        vm.startPrank(stranger);
        usdc.approve(address(escrow), DEPOSIT);
        vm.expectRevert(ToolshedEscrow.NotBorrower.selector);
        escrow.openLoan(terms, sig);
        vm.stopPrank();
    }

    function test_openLoan_revertsOnForgedSignature() public {
        ToolshedEscrow.Terms memory terms = _terms(3, 1);
        bytes memory sig = _sign(borrowerKey, escrow.hashTerms(terms));
        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.BadSignature.selector);
        escrow.openLoan(terms, sig);
    }

    /// @dev The signature covers every field, so a borrower cannot shave the deposit or push the
    ///      due date out after the owner approved.
    function test_openLoan_revertsWhenTermsTampered() public {
        ToolshedEscrow.Terms memory terms = _terms(3, 1);
        bytes memory sig = _sign(ownerKey, escrow.hashTerms(terms));
        terms.dueAt += 30 days;
        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.BadSignature.selector);
        escrow.openLoan(terms, sig);
    }

    function test_openLoan_signatureIsSingleUse() public {
        ToolshedEscrow.Terms memory terms = _terms(3, 1);
        bytes memory sig = _sign(ownerKey, escrow.hashTerms(terms));
        vm.startPrank(borrower);
        escrow.openLoan(terms, sig);
        vm.expectRevert(
            abi.encodeWithSelector(ToolshedEscrow.BadStatus.selector, ToolshedEscrow.Status.Active)
        );
        escrow.openLoan(terms, sig);
        vm.stopPrank();
    }

    function test_openLoan_revertsOnExpiredOffer() public {
        ToolshedEscrow.Terms memory terms = _terms(3, 1);
        bytes memory sig = _sign(ownerKey, escrow.hashTerms(terms));
        vm.warp(terms.offerExpiry + 1);
        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.OfferExpired.selector);
        escrow.openLoan(terms, sig);
    }

    function test_openLoan_rejectsBadTerms() public {
        ToolshedEscrow.Terms memory terms = _terms(3, 1);

        terms.dailyLateFee = 0;
        _expectOpenRevert(terms, ToolshedEscrow.ZeroLateFee.selector);

        terms.dailyLateFee = DEPOSIT + 1;
        _expectOpenRevert(terms, ToolshedEscrow.LateFeeAboveDeposit.selector);

        terms = _terms(3, 1);
        terms.deposit = 0;
        _expectOpenRevert(terms, ToolshedEscrow.ZeroDeposit.selector);

        terms = _terms(3, 1);
        terms.dueAt = uint64(block.timestamp);
        _expectOpenRevert(terms, ToolshedEscrow.DueDateInPast.selector);

        terms = _terms(3, 1);
        terms.dueAt = uint64(block.timestamp) + escrow.MAX_LOAN_DURATION() + 1;
        terms.offerExpiry = terms.dueAt;
        _expectOpenRevert(terms, ToolshedEscrow.LoanTooLong.selector);
    }

    function _expectOpenRevert(ToolshedEscrow.Terms memory terms, bytes4 err) internal {
        bytes memory sig = _sign(ownerKey, escrow.hashTerms(terms));
        vm.prank(borrower);
        vm.expectRevert(err);
        escrow.openLoan(terms, sig);
    }

    // ------------------------------------------------------------------ on-time return

    function test_confirmReturn_onTime_refundsEverything() public {
        (bytes32 loanId,) = _openDefault();
        skip(2 days);

        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(borrower), 1_000e6, "borrower whole again");
        assertEq(usdc.balanceOf(owner), 0, "owner charged nothing");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow emptied");
        assertEq(uint8(escrow.getLoan(loanId).status), uint8(ToolshedEscrow.Status.Closed));
    }

    /// @dev Returning exactly at the deadline is on time; one second later is a full day late.
    function test_confirmReturn_boundaryAtDueDate() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();
        vm.warp(terms.dueAt);
        vm.prank(owner);
        escrow.confirmReturn(loanId);
        assertEq(usdc.balanceOf(owner), 0);
    }

    function test_confirmReturn_oneSecondLateCostsOneDay() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();
        vm.warp(terms.dueAt + 1);
        vm.prank(owner);
        escrow.confirmReturn(loanId);
        assertEq(usdc.balanceOf(owner), DAILY_FEE, "one started day");
        assertEq(usdc.balanceOf(borrower), 1_000e6 - DAILY_FEE);
    }

    // ------------------------------------------------------------------ late return

    function test_confirmReturn_late_splitsDeposit() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();
        vm.warp(terms.dueAt + 3 days + 4 hours); // 4 started days

        vm.prank(owner);
        escrow.confirmReturn(loanId);

        uint256 expectedFee = 4 * DAILY_FEE;
        assertEq(usdc.balanceOf(owner), expectedFee, "owner paid 4 late days");
        assertEq(usdc.balanceOf(borrower), 1_000e6 - expectedFee, "borrower refunded the rest");
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_lateFeeIsCappedAtDeposit() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();
        vm.warp(terms.dueAt + 400 days);

        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(owner), DEPOSIT, "never more than the deposit");
        assertEq(usdc.balanceOf(borrower), 1_000e6 - DEPOSIT);
    }

    function test_quote_matchesSettlement() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();
        uint64 returnAt = terms.dueAt + 2 days;
        (uint256 lateDays, uint256 ownerAmount, uint256 borrowerAmount) =
            escrow.quote(loanId, returnAt);
        assertEq(lateDays, 2);
        assertEq(ownerAmount, 2 * DAILY_FEE);
        assertEq(borrowerAmount, DEPOSIT - 2 * DAILY_FEE);

        vm.warp(returnAt);
        vm.prank(owner);
        escrow.confirmReturn(loanId);
        assertEq(usdc.balanceOf(owner), ownerAmount);
    }

    // ------------------------------------------------------------------ receipt path

    function test_closeWithReceipt_paysOutAtReceiptTime() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();

        // Tool handed back one day late; owner signs a receipt at the door, then goes quiet.
        uint64 returnedAt = terms.dueAt + 1 days;
        vm.warp(returnedAt);
        bytes memory receipt = _sign(ownerKey, escrow.hashReceipt(loanId, returnedAt));

        // Two weeks later the borrower closes it themselves. Fees stopped at the receipt time.
        skip(14 days);
        vm.prank(borrower);
        escrow.closeWithReceipt(loanId, returnedAt, receipt);

        assertEq(usdc.balanceOf(owner), DAILY_FEE, "only the one late day");
        assertEq(usdc.balanceOf(borrower), 1_000e6 - DAILY_FEE);
    }

    function test_closeWithReceipt_revertsOnFutureOrForgedReceipt() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();

        uint64 future = uint64(block.timestamp) + 1 days;
        bytes memory sig = _sign(ownerKey, escrow.hashReceipt(loanId, future));
        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.ReturnInFuture.selector);
        escrow.closeWithReceipt(loanId, future, sig);

        // Borrower cannot sign their own receipt.
        uint64 now_ = uint64(block.timestamp);
        bytes memory forged = _sign(borrowerKey, escrow.hashReceipt(loanId, now_));
        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.BadSignature.selector);
        escrow.closeWithReceipt(loanId, now_, forged);

        // A receipt for a different loan does not work on this one.
        ToolshedEscrow.Terms memory other = _terms(5, 2);
        bytes32 otherId = _open(other);
        bytes memory wrongLoan = _sign(ownerKey, escrow.hashReceipt(otherId, now_));
        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.BadSignature.selector);
        escrow.closeWithReceipt(loanId, now_, wrongLoan);
        assertEq(uint8(escrow.getLoan(loanId).status), uint8(ToolshedEscrow.Status.Active));
        terms; // silence unused warning
    }

    function test_closeWithReceipt_revertsIfCalledByOwner() public {
        (bytes32 loanId,) = _openDefault();
        uint64 now_ = uint64(block.timestamp);
        bytes memory sig = _sign(ownerKey, escrow.hashReceipt(loanId, now_));
        vm.prank(owner);
        vm.expectRevert(ToolshedEscrow.NotBorrower.selector);
        escrow.closeWithReceipt(loanId, now_, sig);
    }

    // ------------------------------------------------------------------ forfeit

    function test_claimForfeit_onlyAfterFeesCoverDeposit() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();
        uint64 forfeitAt = escrow.forfeitableAt(loanId);
        assertEq(forfeitAt, terms.dueAt + 23 days + 1, "120 / 5 = 24 started days late");

        vm.warp(forfeitAt - 1);
        vm.prank(owner);
        vm.expectRevert(ToolshedEscrow.NotFullyForfeited.selector);
        escrow.claimForfeit(loanId);

        vm.warp(forfeitAt);
        vm.prank(owner);
        escrow.claimForfeit(loanId);

        assertEq(usdc.balanceOf(owner), DEPOSIT, "owner keeps the whole deposit");
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(uint8(escrow.getLoan(loanId).status), uint8(ToolshedEscrow.Status.Closed));
    }

    function test_claimForfeit_borrowerCannotCall() public {
        (bytes32 loanId,) = _openDefault();
        vm.warp(escrow.forfeitableAt(loanId));
        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.NotOwner.selector);
        escrow.claimForfeit(loanId);
    }

    // ------------------------------------------------------------------ disputes

    function test_dispute_freezesEveryUnilateralPath() public {
        (bytes32 loanId,) = _openDefault();
        vm.prank(borrower);
        escrow.dispute(loanId);

        bytes memory expected = abi.encodeWithSelector(
            ToolshedEscrow.BadStatus.selector, ToolshedEscrow.Status.Disputed
        );

        vm.prank(owner);
        vm.expectRevert(expected);
        escrow.confirmReturn(loanId);

        vm.warp(escrow.forfeitableAt(loanId));
        vm.prank(owner);
        vm.expectRevert(expected);
        escrow.claimForfeit(loanId);

        uint64 now_ = uint64(block.timestamp);
        bytes memory receipt = _sign(ownerKey, escrow.hashReceipt(loanId, now_));
        vm.prank(borrower);
        vm.expectRevert(expected);
        escrow.closeWithReceipt(loanId, now_, receipt);
    }

    function test_dispute_onlyParties() public {
        (bytes32 loanId,) = _openDefault();
        vm.prank(address(0xDEAD));
        vm.expectRevert(ToolshedEscrow.NotParty.selector);
        escrow.dispute(loanId);
    }

    function test_resolve_splitsDeposit() public {
        (bytes32 loanId,) = _openDefault();
        vm.prank(owner);
        escrow.dispute(loanId);

        vm.prank(arbiter);
        escrow.resolve(loanId, 30e6);

        assertEq(usdc.balanceOf(owner), 30e6);
        assertEq(usdc.balanceOf(borrower), 1_000e6 - DEPOSIT + 90e6);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_resolve_isBoundedAndGated() public {
        (bytes32 loanId,) = _openDefault();

        // Not while the loan is merely active.
        vm.prank(arbiter);
        vm.expectRevert(
            abi.encodeWithSelector(ToolshedEscrow.BadStatus.selector, ToolshedEscrow.Status.Active)
        );
        escrow.resolve(loanId, 1e6);

        vm.prank(owner);
        escrow.dispute(loanId);

        // Not by anyone else.
        vm.prank(owner);
        vm.expectRevert(ToolshedEscrow.NotArbiter.selector);
        escrow.resolve(loanId, 1e6);

        // Never more than this loan's deposit.
        vm.prank(arbiter);
        vm.expectRevert(ToolshedEscrow.AmountAboveDeposit.selector);
        escrow.resolve(loanId, DEPOSIT + 1);
    }

    /// @dev The arbiter cannot reach a second loan's escrow through the one it is resolving.
    function test_resolve_cannotDrainOtherLoans() public {
        (bytes32 disputed,) = _openDefault();
        _open(_terms(4, 2));
        assertEq(usdc.balanceOf(address(escrow)), 2 * DEPOSIT);

        vm.prank(owner);
        escrow.dispute(disputed);
        vm.prank(arbiter);
        escrow.resolve(disputed, DEPOSIT);

        assertEq(usdc.balanceOf(address(escrow)), DEPOSIT, "other loan untouched");
    }

    // ------------------------------------------------------------------ frozen addresses

    function test_frozenOwnerDoesNotBlockBorrowerRefund() public {
        (bytes32 loanId, ToolshedEscrow.Terms memory terms) = _openDefault();
        vm.warp(terms.dueAt + 1 days);
        usdc.setBlocked(owner, true);

        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(usdc.balanceOf(borrower), 1_000e6 - DAILY_FEE, "refund still landed");
        assertEq(escrow.credited(owner), DAILY_FEE, "owner's cut is held for them");
        assertEq(usdc.balanceOf(address(escrow)), DAILY_FEE);

        usdc.setBlocked(owner, false);
        vm.prank(owner);
        escrow.withdraw(owner);
        assertEq(usdc.balanceOf(owner), DAILY_FEE);
        assertEq(escrow.credited(owner), 0);
    }

    function test_withdraw_revertsWhenNothingOwed() public {
        vm.prank(owner);
        vm.expectRevert(ToolshedEscrow.NothingToWithdraw.selector);
        escrow.withdraw(owner);
    }

    // ------------------------------------------------------------------ arbiter handover

    function test_arbiterHandoverIsTwoStep() public {
        address next = address(0xBEEF);
        vm.prank(arbiter);
        escrow.transferArbiter(next);
        assertEq(escrow.arbiter(), arbiter, "unchanged until accepted");

        vm.prank(address(0xDEAD));
        vm.expectRevert(ToolshedEscrow.NotArbiter.selector);
        escrow.acceptArbiter();

        vm.prank(next);
        escrow.acceptArbiter();
        assertEq(escrow.arbiter(), next);
        assertEq(escrow.pendingArbiter(), address(0));
    }

    // ------------------------------------------------------------------ invariants

    /// @dev Whatever the timing, the two payouts always add up to exactly the deposit and the
    ///      escrow never keeps a remainder.
    function testFuzz_settlementConservesDeposit(uint128 deposit, uint128 dailyFee, uint32 lateBy)
        public
    {
        deposit = uint128(bound(deposit, 1e6, 10_000e6));
        dailyFee = uint128(bound(dailyFee, 1, deposit));
        lateBy = uint32(bound(lateBy, 0, 365 days));

        usdc.mint(borrower, deposit);
        uint256 borrowerBefore = usdc.balanceOf(borrower);
        uint256 ownerBefore = usdc.balanceOf(owner);

        ToolshedEscrow.Terms memory terms = _terms(3, uint256(keccak256(abi.encode(deposit, dailyFee, lateBy))));
        terms.deposit = deposit;
        terms.dailyLateFee = dailyFee;
        bytes32 loanId = _open(terms);

        vm.warp(terms.dueAt + lateBy);
        vm.prank(owner);
        escrow.confirmReturn(loanId);

        uint256 ownerGot = usdc.balanceOf(owner) - ownerBefore;
        uint256 borrowerGot = usdc.balanceOf(borrower) - (borrowerBefore - deposit);
        assertEq(ownerGot + borrowerGot, deposit, "payouts sum to the deposit");
        assertLe(ownerGot, deposit, "owner never gets more than the deposit");
        if (lateBy == 0) assertEq(ownerGot, 0, "on time costs nothing");
        assertEq(usdc.balanceOf(address(escrow)), 0, "no dust left behind");
    }
}
