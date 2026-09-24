// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockSmartWallet} from "./mocks/MockSmartWallet.sol";

contract ToolshedTest is Test {
    Toolshed internal shed;
    MockUSDC internal usdc;

    uint256 internal ownerKey = 0xA11CE;
    uint256 internal borrowerKey = 0xB0B;
    address internal toolOwner;
    address internal borrower;
    address internal steward = address(0x51EA);
    address internal stranger = address(0x5747);

    bytes32 internal constant TOOL = keccak256("listing:circular-saw");

    uint256 internal constant DEPOSIT = 60e6; // 60 USDC
    uint256 internal constant FEE_PER_DAY = 5e6; // 5 USDC/day
    uint32 internal constant MAX_LATE_DAYS = 12; // 12 * 5 == 60 == deposit

    function setUp() public {
        toolOwner = vm.addr(ownerKey);
        borrower = vm.addr(borrowerKey);

        usdc = new MockUSDC();
        address[] memory roster = new address[](2);
        roster[0] = toolOwner;
        roster[1] = borrower;
        shed = new Toolshed(IERC20(address(usdc)), steward, roster);

        usdc.mint(borrower, 1_000e6);
        vm.prank(borrower);
        usdc.approve(address(shed), type(uint256).max);

        vm.warp(1_760_000_000); // a plausible "now"
    }

    /*//////////////////////////////////////////////////////////////
                                 HELPERS
    //////////////////////////////////////////////////////////////*/

    function _offer(uint256 nonce) internal view returns (Toolshed.LoanOffer memory) {
        return Toolshed.LoanOffer({
            toolId: TOOL,
            owner: toolOwner,
            borrower: borrower,
            deposit: DEPOSIT,
            lateFeePerDay: FEE_PER_DAY,
            dueAt: uint64(block.timestamp + 4 days),
            maxLateDays: MAX_LATE_DAYS,
            offerExpiry: uint64(block.timestamp + 1 days),
            nonce: nonce
        });
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _start(Toolshed.LoanOffer memory offer) internal returns (uint256 loanId) {
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(offer.borrower);
        loanId = shed.startLoan(offer, sig);
    }

    function _startDefault() internal returns (uint256 loanId, Toolshed.LoanOffer memory offer) {
        offer = _offer(1);
        loanId = _start(offer);
    }

    /*//////////////////////////////////////////////////////////////
                              STARTING A LOAN
    //////////////////////////////////////////////////////////////*/

    function test_startLoan_escrowsDepositAndRecordsTerms() public {
        uint256 before = usdc.balanceOf(borrower);
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();

        assertEq(loanId, 1);
        assertEq(usdc.balanceOf(address(shed)), DEPOSIT);
        assertEq(usdc.balanceOf(borrower), before - DEPOSIT);
        assertEq(shed.activeLoanOf(TOOL), loanId);
        assertTrue(shed.offerNonceUsed(toolOwner, offer.nonce));

        Toolshed.Loan memory loan = shed.getLoan(loanId);
        assertEq(loan.owner, toolOwner);
        assertEq(loan.borrower, borrower);
        assertEq(loan.deposit, DEPOSIT);
        assertEq(loan.lateFeePerDay, FEE_PER_DAY);
        assertEq(loan.dueAt, offer.dueAt);
        assertEq(loan.maxLateDays, MAX_LATE_DAYS);
        assertEq(uint8(loan.status), uint8(Toolshed.Status.Active));
    }

    function test_startLoan_revertsForNonBorrowerSubmitter() public {
        Toolshed.LoanOffer memory offer = _offer(1);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(stranger);
        vm.expectRevert(Toolshed.NotBorrower.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsOnForgedSignature() public {
        Toolshed.LoanOffer memory offer = _offer(1);
        bytes memory sig = _sign(borrowerKey, shed.hashOffer(offer)); // borrower signs their own terms
        vm.prank(borrower);
        vm.expectRevert(Toolshed.BadSignature.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsWhenTermsAreTamperedWith() public {
        Toolshed.LoanOffer memory offer = _offer(1);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        offer.dueAt = uint64(block.timestamp + 30 days); // borrower tries to keep it a month
        vm.prank(borrower);
        vm.expectRevert(Toolshed.BadSignature.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsOnReplayOfSameOffer() public {
        (, Toolshed.LoanOffer memory offer) = _startDefault();
        // settle so the tool is free again, then try the same signed offer a second time
        vm.prank(toolOwner);
        shed.confirmReturn(1);

        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.OfferNonceUsed.selector);
        shed.startLoan(offer, sig);
    }

    function test_cancelOffer_blocksAcceptance() public {
        Toolshed.LoanOffer memory offer = _offer(7);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));

        vm.prank(toolOwner);
        shed.cancelOffer(7);

        vm.prank(borrower);
        vm.expectRevert(Toolshed.OfferNonceUsed.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsAfterOfferExpiry() public {
        Toolshed.LoanOffer memory offer = _offer(1);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.warp(offer.offerExpiry + 1);
        vm.prank(borrower);
        vm.expectRevert(Toolshed.OfferExpired.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsForNonMembers() public {
        address[] memory drop = new address[](1);
        drop[0] = borrower;
        vm.prank(steward);
        shed.setMembers(drop, false);

        Toolshed.LoanOffer memory offer = _offer(1);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.NotAMember.selector, borrower));
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsWhenLateFeeCapExceedsDeposit() public {
        Toolshed.LoanOffer memory offer = _offer(1);
        offer.maxLateDays = MAX_LATE_DAYS + 1; // 13 * 5 == 65 > 60
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.LateFeeExceedsDeposit.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsWithoutALateFee() public {
        Toolshed.LoanOffer memory offer = _offer(1);
        offer.lateFeePerDay = 0;
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.NoLateFee.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsOnPastDueDate() public {
        Toolshed.LoanOffer memory offer = _offer(1);
        offer.dueAt = uint64(block.timestamp);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.DueDateInPast.selector);
        shed.startLoan(offer, sig);
    }

    function test_startLoan_revertsWhenToolIsAlreadyOut() public {
        _startDefault();
        Toolshed.LoanOffer memory second = _offer(2);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(second));
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.ToolAlreadyOnLoan.selector, 1));
        shed.startLoan(second, sig);
    }

    function test_startLoan_allowedAgainAfterPreviousLoanSettles() public {
        _startDefault();
        vm.prank(toolOwner);
        shed.confirmReturn(1);
        assertEq(shed.activeLoanOf(TOOL), 0);

        uint256 second = _start(_offer(2));
        assertEq(second, 2);
        assertEq(shed.activeLoanOf(TOOL), 2);
    }

    function test_startLoan_acceptsOwnerWithSmartWallet() public {
        MockSmartWallet wallet = new MockSmartWallet(vm.addr(ownerKey));
        address[] memory add = new address[](1);
        add[0] = address(wallet);
        vm.prank(steward);
        shed.setMembers(add, true);

        Toolshed.LoanOffer memory offer = _offer(1);
        offer.owner = address(wallet);
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));

        vm.prank(borrower);
        uint256 loanId = shed.startLoan(offer, sig);
        assertEq(shed.getLoan(loanId).owner, address(wallet));
    }

    function test_pause_blocksNewLoansButNotSettlement() public {
        (uint256 loanId,) = _startDefault();

        vm.prank(steward);
        shed.setNewLoansPaused(true);

        Toolshed.LoanOffer memory offer = _offer(2);
        offer.toolId = keccak256("listing:ladder");
        bytes memory sig = _sign(ownerKey, shed.hashOffer(offer));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.NewLoansArePaused.selector);
        shed.startLoan(offer, sig);

        vm.prank(toolOwner);
        shed.confirmReturn(loanId); // settlement still works while paused
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                             OWNER CONFIRMATION
    //////////////////////////////////////////////////////////////*/

    function test_confirmReturn_onTime_refundsWholeDeposit() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint256 borrowerBefore = usdc.balanceOf(borrower);

        vm.warp(offer.dueAt - 1 hours);
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(borrower), borrowerBefore + DEPOSIT);
        assertEq(usdc.balanceOf(toolOwner), 0);
        assertEq(usdc.balanceOf(address(shed)), 0);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.Status.Settled));
    }

    function test_confirmReturn_threeDaysLate_paysOwnerThreeDays() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint256 borrowerBefore = usdc.balanceOf(borrower);

        vm.warp(uint256(offer.dueAt) + 3 days);
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(toolOwner), 3 * FEE_PER_DAY);
        assertEq(usdc.balanceOf(borrower), borrowerBefore + DEPOSIT - 3 * FEE_PER_DAY);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    function test_confirmReturn_partDayCountsAsAWholeDay() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();

        vm.warp(uint256(offer.dueAt) + 1); // one second late
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(toolOwner), FEE_PER_DAY);
    }

    function test_confirmReturn_feeStopsAtTheCap() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint256 borrowerBefore = usdc.balanceOf(borrower);

        vm.warp(uint256(offer.dueAt) + 400 days);
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(toolOwner), DEPOSIT); // 12 days * 5 == the whole deposit
        assertEq(usdc.balanceOf(borrower), borrowerBefore);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    function test_confirmReturn_revertsForNonOwner() public {
        (uint256 loanId,) = _startDefault();
        vm.prank(borrower);
        vm.expectRevert(Toolshed.NotOwner.selector);
        shed.confirmReturn(loanId);
    }

    function test_confirmReturn_revertsOnDoubleSettle() public {
        (uint256 loanId,) = _startDefault();
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);
        vm.prank(toolOwner);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.LoanNotActive.selector, loanId));
        shed.confirmReturn(loanId);
    }

    /*//////////////////////////////////////////////////////////////
                             RETURN RECEIPTS
    //////////////////////////////////////////////////////////////*/

    function test_closeWithReceipt_letsBorrowerSettleAtSignedTime() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint256 borrowerBefore = usdc.balanceOf(borrower);

        uint64 handover = offer.dueAt - 2 hours;
        vm.warp(uint256(offer.dueAt) + 5 days); // owner only gets round to nothing; borrower acts
        bytes memory receipt = _sign(ownerKey, shed.hashReturnReceipt(loanId, handover));

        vm.prank(borrower);
        shed.closeWithReceipt(loanId, handover, receipt);

        assertEq(usdc.balanceOf(borrower), borrowerBefore + DEPOSIT);
        assertEq(shed.getLoan(loanId).returnedAt, handover);
    }

    function test_closeWithReceipt_chargesLateFeeForLateSignedTime() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint64 handover = uint64(uint256(offer.dueAt) + 2 days);
        vm.warp(handover + 1);

        bytes memory receipt = _sign(ownerKey, shed.hashReturnReceipt(loanId, handover));
        vm.prank(borrower);
        shed.closeWithReceipt(loanId, handover, receipt);

        assertEq(usdc.balanceOf(toolOwner), 2 * FEE_PER_DAY);
    }

    function test_closeWithReceipt_revertsForFutureReturnTime() public {
        (uint256 loanId,) = _startDefault();
        uint64 future = uint64(block.timestamp + 1);
        bytes memory receipt = _sign(ownerKey, shed.hashReturnReceipt(loanId, future));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.ReturnInFuture.selector);
        shed.closeWithReceipt(loanId, future, receipt);
    }

    function test_closeWithReceipt_revertsForReturnBeforeStart() public {
        (uint256 loanId,) = _startDefault();
        uint64 early = uint64(block.timestamp - 1);
        bytes memory receipt = _sign(ownerKey, shed.hashReturnReceipt(loanId, early));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.ReturnBeforeStart.selector);
        shed.closeWithReceipt(loanId, early, receipt);
    }

    function test_closeWithReceipt_revertsWhenBorrowerForgesReceipt() public {
        (uint256 loanId,) = _startDefault();
        uint64 now_ = uint64(block.timestamp);
        bytes memory receipt = _sign(borrowerKey, shed.hashReturnReceipt(loanId, now_));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.BadSignature.selector);
        shed.closeWithReceipt(loanId, now_, receipt);
    }

    function test_closeWithReceipt_receiptIsNotReusableOnAnotherLoan() public {
        (uint256 loanId,) = _startDefault();
        uint64 now_ = uint64(block.timestamp);
        bytes memory receipt = _sign(ownerKey, shed.hashReturnReceipt(loanId, now_));
        vm.prank(borrower);
        shed.closeWithReceipt(loanId, now_, receipt);

        uint256 second = _start(_offer(2));
        vm.prank(borrower);
        vm.expectRevert(Toolshed.BadSignature.selector);
        shed.closeWithReceipt(second, now_, receipt);
    }

    /*//////////////////////////////////////////////////////////////
                          BORROWER ESCAPE HATCH
    //////////////////////////////////////////////////////////////*/

    function test_closeAtMaxLateFee_revertsBeforeCapIsReached() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint64 availableAt = uint64(uint256(offer.dueAt) + uint256(MAX_LATE_DAYS) * 1 days);

        vm.warp(availableAt - 1);
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.TooEarly.selector, availableAt));
        shed.closeAtMaxLateFee(loanId);
    }

    function test_closeAtMaxLateFee_paysCapAndReleasesRemainder() public {
        // A deposit larger than the capped fee, so there is a remainder to recover.
        Toolshed.LoanOffer memory offer = _offer(1);
        offer.deposit = 100e6;
        uint256 loanId = _start(offer);
        uint256 borrowerBefore = usdc.balanceOf(borrower);

        vm.warp(uint256(offer.dueAt) + uint256(MAX_LATE_DAYS) * 1 days);
        vm.prank(borrower);
        shed.closeAtMaxLateFee(loanId);

        uint256 cappedFee = FEE_PER_DAY * MAX_LATE_DAYS;
        assertEq(usdc.balanceOf(toolOwner), cappedFee);
        assertEq(usdc.balanceOf(borrower), borrowerBefore + 100e6 - cappedFee);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    function test_closeAtMaxLateFee_ownerCannotUseItToBillTheCap() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        vm.warp(uint256(offer.dueAt) + uint256(MAX_LATE_DAYS) * 1 days + 1);
        vm.prank(toolOwner);
        vm.expectRevert(Toolshed.NotBorrower.selector);
        shed.closeAtMaxLateFee(loanId);
    }

    /*//////////////////////////////////////////////////////////////
                             STEWARD ARBITRATION
    //////////////////////////////////////////////////////////////*/

    function test_resolve_stewardSplitsWithinTheAgreedCap() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint256 borrowerBefore = usdc.balanceOf(borrower);

        vm.warp(uint256(offer.dueAt) + 10 days);
        vm.prank(steward);
        shed.resolve(loanId, 4); // committee decided 4 billable days

        assertEq(usdc.balanceOf(toolOwner), 4 * FEE_PER_DAY);
        assertEq(usdc.balanceOf(borrower), borrowerBefore + DEPOSIT - 4 * FEE_PER_DAY);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    function test_resolve_revertsBeforeDueDate() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(Toolshed.TooEarly.selector, offer.dueAt + 1));
        shed.resolve(loanId, 1);
    }

    function test_resolve_revertsAboveTheCap() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        vm.warp(uint256(offer.dueAt) + 1 days);
        vm.prank(steward);
        vm.expectRevert(Toolshed.LateDaysAboveCap.selector);
        shed.resolve(loanId, MAX_LATE_DAYS + 1);
    }

    function test_resolve_revertsForNonSteward() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        vm.warp(uint256(offer.dueAt) + 1 days);
        vm.prank(toolOwner);
        vm.expectRevert(Toolshed.NotSteward.selector);
        shed.resolve(loanId, 1);
    }

    function test_transferSteward_movesTheRole() public {
        address next = address(0xC0DE);
        vm.prank(steward);
        shed.transferSteward(next);
        assertEq(shed.steward(), next);

        address[] memory add = new address[](1);
        add[0] = stranger;
        vm.prank(steward);
        vm.expectRevert(Toolshed.NotSteward.selector);
        shed.setMembers(add, true);
    }

    function test_removingAMemberDoesNotTouchTheirOpenLoan() public {
        (uint256 loanId,) = _startDefault();
        address[] memory drop = new address[](1);
        drop[0] = borrower;
        vm.prank(steward);
        shed.setMembers(drop, false);

        vm.prank(toolOwner);
        shed.confirmReturn(loanId); // still settles; the deposit is not trapped
        assertEq(usdc.balanceOf(address(shed)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    function test_quoteSettlement_matchesActualSettlement() public {
        (uint256 loanId, Toolshed.LoanOffer memory offer) = _startDefault();
        uint64 at = uint64(uint256(offer.dueAt) + 3 days + 6 hours);

        (uint32 lateDays, uint256 lateFee, uint256 refund) = shed.quoteSettlement(loanId, at);
        assertEq(lateDays, 4); // part of a fourth day
        assertEq(lateFee, 4 * FEE_PER_DAY);
        assertEq(refund, DEPOSIT - 4 * FEE_PER_DAY);

        vm.warp(at);
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);
        assertEq(usdc.balanceOf(toolOwner), lateFee);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @dev The escrow is conservative: whatever the terms and the return time, the owner's
    ///      fee plus the borrower's refund is exactly the deposit and nothing is left behind.
    function testFuzz_settlementConservesTheDeposit(
        uint128 deposit,
        uint96 feePerDay,
        uint16 maxLateDays,
        uint32 loanDays,
        uint32 lateSeconds
    ) public {
        deposit = uint128(bound(deposit, 1e6, 100_000e6));
        feePerDay = uint96(bound(feePerDay, 1, deposit));
        maxLateDays = uint16(bound(maxLateDays, 1, deposit / feePerDay));
        loanDays = uint32(bound(loanDays, 1, 90));
        lateSeconds = uint32(bound(lateSeconds, 0, 365 days));

        Toolshed.LoanOffer memory offer = _offer(42);
        offer.deposit = deposit;
        offer.lateFeePerDay = feePerDay;
        offer.maxLateDays = maxLateDays;
        offer.dueAt = uint64(block.timestamp + uint256(loanDays) * 1 days);

        usdc.mint(borrower, deposit);
        uint256 loanId = _start(offer);
        uint256 borrowerBefore = usdc.balanceOf(borrower);
        uint256 ownerBefore = usdc.balanceOf(toolOwner);

        vm.warp(uint256(offer.dueAt) + lateSeconds);
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);

        uint256 toOwner = usdc.balanceOf(toolOwner) - ownerBefore;
        uint256 toBorrower = usdc.balanceOf(borrower) - borrowerBefore;
        assertEq(toOwner + toBorrower, deposit, "deposit conserved");
        assertLe(toOwner, uint256(feePerDay) * maxLateDays, "fee within the agreed cap");
        assertEq(usdc.balanceOf(address(shed)), 0, "escrow empty");
    }
}
