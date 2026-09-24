// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title Toolshed
/// @notice Escrow for neighborhood tool loans. A borrower locks a USDC deposit,
///         the owner hands over the tool, and on return the deposit is split:
///         a daily late fee to the owner, the remainder back to the borrower.
///
/// @dev Deliberately admin-free: no owner, no pause, no upgrade path, no
///      protocol fee. Membership, listings, photos, condition notes and the
///      reputation ranking all live offchain; this contract only holds money
///      and emits the facts needed to compute a track record.
contract Toolshed is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------

    enum Status {
        None,
        /// Borrower has escrowed the deposit, owner has not handed the tool over yet.
        Requested,
        /// Tool is out. Late fees accrue after `dueAt`.
        Active,
        /// Borrower says the tool is back; owner has a window to object.
        ReturnAsserted,
        /// Terminal: deposit has been split and paid out.
        Settled,
        /// Terminal: request was withdrawn or declined, deposit refunded in full.
        Cancelled
    }

    struct Loan {
        address owner;
        address borrower;
        uint96 deposit; // USDC, 6 decimals
        uint96 dailyLateFee; // USDC per started day past `dueAt`
        /// keccak256 of the offchain listing id this loan is for. Informational.
        bytes32 listingRef;
        uint64 requestedAt;
        /// Return-by timestamp, set when the owner approves.
        uint64 dueAt;
        /// When the borrower asserted the return. Freezes late-fee accrual.
        uint64 assertedAt;
        /// End of the owner's objection window.
        uint64 challengeEndsAt;
        uint32 durationDays;
        Status status;
        /// The owner may object to a return assertion exactly once.
        bool objected;
    }

    // -------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------

    /// @notice An unanswered request expires and is refundable after this long.
    uint64 public constant REQUEST_TTL = 3 days;
    /// @notice How long the owner has to object to a claimed return.
    uint64 public constant CHALLENGE_WINDOW = 3 days;
    /// @notice Longest loan the contract will escrow.
    uint32 public constant MAX_DURATION_DAYS = 90;

    // -------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------

    IERC20 public immutable usdc;

    uint256 public nextLoanId = 1;
    mapping(uint256 loanId => Loan) internal _loans;

    /// @notice Payouts that could not be pushed (e.g. a token-level transfer
    ///         failure), claimable by the recipient via `withdraw`.
    mapping(address account => uint256 amount) public owed;

    // -------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------

    event LoanRequested(
        uint256 indexed loanId,
        address indexed owner,
        address indexed borrower,
        bytes32 listingRef,
        uint256 deposit,
        uint256 dailyLateFee,
        uint32 durationDays
    );
    event LoanApproved(uint256 indexed loanId, address indexed owner, address indexed borrower, uint64 dueAt);
    event LoanCancelled(uint256 indexed loanId, address indexed owner, address indexed borrower, address by);
    event ReturnAsserted(uint256 indexed loanId, address indexed borrower, uint64 assertedAt, uint64 challengeEndsAt);
    event ReturnObjected(uint256 indexed loanId, address indexed owner);
    /// @notice The single fact the offchain track record is built from.
    event LoanSettled(
        uint256 indexed loanId,
        address indexed owner,
        address indexed borrower,
        uint256 lateFee,
        uint256 refund,
        uint256 daysLate,
        bool unreturned
    );
    event PayoutDeferred(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    // -------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------

    error BadStatus(Status actual);
    error NotOwner();
    error NotBorrower();
    error SelfLoan();
    error ZeroDeposit();
    error BadDuration();
    error FeeExceedsDeposit();
    error RequestExpired();
    error RequestNotExpired();
    error ChallengeWindowOpen();
    error ChallengeWindowClosed();
    error AlreadyObjected();
    error DepositNotExhausted();
    error NothingOwed();

    constructor(IERC20 usdc_) {
        usdc = usdc_;
    }

    // -------------------------------------------------------------------
    // Borrow flow
    // -------------------------------------------------------------------

    /// @notice Escrow a deposit and ask `owner` for their tool.
    /// @dev Caller must have approved `deposit` USDC to this contract.
    ///      Terms are passed in rather than read from storage because listings
    ///      live offchain; the owner accepts them by calling `approve`.
    /// @param dailyLateFee Charged per started day past the due date, capped at the deposit.
    function request(
        address owner,
        bytes32 listingRef,
        uint96 deposit,
        uint96 dailyLateFee,
        uint32 durationDays
    ) external nonReentrant returns (uint256 loanId) {
        if (owner == msg.sender) revert SelfLoan();
        if (deposit == 0) revert ZeroDeposit();
        if (durationDays == 0 || durationDays > MAX_DURATION_DAYS) revert BadDuration();
        // A fee larger than the deposit would let one day consume everything;
        // the cap makes the borrower's worst case legible up front.
        if (dailyLateFee > deposit) revert FeeExceedsDeposit();

        loanId = nextLoanId++;
        _loans[loanId] = Loan({
            owner: owner,
            borrower: msg.sender,
            deposit: deposit,
            dailyLateFee: dailyLateFee,
            listingRef: listingRef,
            requestedAt: uint64(block.timestamp),
            dueAt: 0,
            assertedAt: 0,
            challengeEndsAt: 0,
            durationDays: durationDays,
            status: Status.Requested,
            objected: false
        });

        usdc.safeTransferFrom(msg.sender, address(this), deposit);

        emit LoanRequested(loanId, owner, msg.sender, listingRef, deposit, dailyLateFee, durationDays);
    }

    /// @notice Owner accepts the terms and hands the tool over. Starts the clock.
    function approve(uint256 loanId) external {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.Requested) revert BadStatus(loan.status);
        if (msg.sender != loan.owner) revert NotOwner();
        if (block.timestamp > loan.requestedAt + REQUEST_TTL) revert RequestExpired();

        loan.status = Status.Active;
        uint64 dueAt = uint64(block.timestamp) + uint64(loan.durationDays) * 1 days;
        loan.dueAt = dueAt;

        emit LoanApproved(loanId, loan.owner, loan.borrower, dueAt);
    }

    /// @notice Owner declines a pending request; the deposit goes straight back.
    function decline(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.Requested) revert BadStatus(loan.status);
        if (msg.sender != loan.owner) revert NotOwner();
        _cancel(loanId, loan);
    }

    /// @notice Borrower withdraws their own pending request.
    function withdrawRequest(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.Requested) revert BadStatus(loan.status);
        if (msg.sender != loan.borrower) revert NotBorrower();
        _cancel(loanId, loan);
    }

    /// @notice Anyone may clear a request the owner never answered, refunding
    ///         the borrower. Keeps a silent owner from locking a deposit.
    function expireRequest(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.Requested) revert BadStatus(loan.status);
        if (block.timestamp <= loan.requestedAt + REQUEST_TTL) revert RequestNotExpired();
        _cancel(loanId, loan);
    }

    // -------------------------------------------------------------------
    // Return flow
    // -------------------------------------------------------------------

    /// @notice Owner confirms they have the tool back. Settles immediately.
    /// @dev The happy path, and the owner's incentive to call it is that this
    ///      is how the accrued late fee reaches their wallet.
    function confirmReturn(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.Active && loan.status != Status.ReturnAsserted) revert BadStatus(loan.status);
        if (msg.sender != loan.owner) revert NotOwner();
        // If the borrower already asserted, accrual stopped then, not now:
        // the owner should not earn fees for being slow to confirm.
        uint64 endAt = loan.status == Status.ReturnAsserted ? loan.assertedAt : uint64(block.timestamp);
        _settle(loanId, loan, endAt, false);
    }

    /// @notice Borrower states the tool is back. Freezes late-fee accrual now
    ///         and opens the owner's objection window.
    function assertReturn(uint256 loanId) external {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.Active) revert BadStatus(loan.status);
        if (msg.sender != loan.borrower) revert NotBorrower();

        loan.status = Status.ReturnAsserted;
        loan.assertedAt = uint64(block.timestamp);
        uint64 endsAt = uint64(block.timestamp) + CHALLENGE_WINDOW;
        loan.challengeEndsAt = endsAt;

        emit ReturnAsserted(loanId, msg.sender, loan.assertedAt, endsAt);
    }

    /// @notice Owner says the tool is not actually back. Accrual resumes as if
    ///         it never paused. Allowed once per loan, so a stubborn owner
    ///         cannot object forever and drain the deposit by attrition.
    function objectToReturn(uint256 loanId) external {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.ReturnAsserted) revert BadStatus(loan.status);
        if (msg.sender != loan.owner) revert NotOwner();
        if (loan.objected) revert AlreadyObjected();
        if (block.timestamp > loan.challengeEndsAt) revert ChallengeWindowClosed();

        loan.objected = true;
        loan.status = Status.Active;
        loan.assertedAt = 0;
        loan.challengeEndsAt = 0;

        emit ReturnObjected(loanId, msg.sender);
    }

    /// @notice Settle an unanswered return assertion once the window closes.
    /// @dev Permissionless: the borrower calls it to get their money, but the
    ///      split is fixed by then, so letting anyone finish it is harmless.
    function settleUnchallenged(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.ReturnAsserted) revert BadStatus(loan.status);
        if (block.timestamp < loan.challengeEndsAt) revert ChallengeWindowOpen();
        _settle(loanId, loan, loan.assertedAt, false);
    }

    /// @notice Write the tool off once late fees have eaten the whole deposit.
    ///         The full deposit goes to the owner and the loan closes.
    /// @dev Permissionless so an abandoned loan always has a terminal state,
    ///      even if the borrower disappears and the owner never calls anything.
    function claimUnreturned(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status != Status.Active) revert BadStatus(loan.status);
        (uint256 fee,) = _lateFeeAt(loan, uint64(block.timestamp));
        if (fee < loan.deposit) revert DepositNotExhausted();
        _settle(loanId, loan, uint64(block.timestamp), true);
    }

    // -------------------------------------------------------------------
    // Payouts
    // -------------------------------------------------------------------

    /// @notice Claim a payout that could not be pushed at settlement time.
    function withdraw() external nonReentrant {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();
        owed[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // -------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    /// @notice Late fee and whole days late as of `timestamp`, for UI previews.
    function quoteLateFee(uint256 loanId, uint64 timestamp) external view returns (uint256 fee, uint256 daysLate) {
        return _lateFeeAt(_loans[loanId], timestamp);
    }

    // -------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------

    /// @dev Any started day past the due date counts as a full day, the way a
    ///      library desk charges it. Capped at the deposit.
    function _lateFeeAt(Loan storage loan, uint64 timestamp) internal view returns (uint256 fee, uint256 daysLate) {
        uint64 dueAt = loan.dueAt;
        if (dueAt == 0 || timestamp <= dueAt) return (0, 0);
        uint256 elapsed = timestamp - dueAt;
        daysLate = (elapsed + 1 days - 1) / 1 days;
        fee = daysLate * loan.dailyLateFee;
        if (fee > loan.deposit) fee = loan.deposit;
    }

    function _settle(uint256 loanId, Loan storage loan, uint64 endAt, bool unreturned) internal {
        (uint256 fee, uint256 daysLate) = _lateFeeAt(loan, endAt);
        uint256 deposit = loan.deposit;
        if (unreturned) fee = deposit;
        uint256 refund = deposit - fee;

        address owner = loan.owner;
        address borrower = loan.borrower;
        loan.status = Status.Settled;

        if (fee > 0) _pay(owner, fee);
        if (refund > 0) _pay(borrower, refund);

        emit LoanSettled(loanId, owner, borrower, fee, refund, daysLate, unreturned);
    }

    function _cancel(uint256 loanId, Loan storage loan) internal {
        loan.status = Status.Cancelled;
        _pay(loan.borrower, loan.deposit);
        emit LoanCancelled(loanId, loan.owner, loan.borrower, msg.sender);
    }

    /// @dev USDC can block transfers to a blacklisted address. If that happens
    ///      we credit the amount instead of reverting, so one frozen party
    ///      cannot trap the other party's money in escrow.
    function _pay(address to, uint256 amount) internal {
        (bool ok, bytes memory ret) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (ok && (ret.length == 0 || abi.decode(ret, (bool)))) return;
        owed[to] += amount;
        emit PayoutDeferred(to, amount);
    }
}
