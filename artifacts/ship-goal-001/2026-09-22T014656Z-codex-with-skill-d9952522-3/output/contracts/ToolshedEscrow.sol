// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./IERC20.sol";

contract ToolshedEscrow {
    enum LoanStatus {
        None,
        Requested,
        Active,
        ReturnPending,
        Settled,
        Cancelled
    }

    struct Loan {
        bytes32 toolId;
        string listingURI;
        address borrower;
        address toolOwner;
        uint64 startAt;
        uint64 dueAt;
        uint64 returnedAt;
        uint256 deposit;
        uint256 dailyLateFee;
        LoanStatus status;
    }

    struct MemberStats {
        uint64 loansBorrowed;
        uint64 loansLent;
        uint64 lateReturns;
        uint256 lateFeesPaid;
        uint256 lateFeesEarned;
    }

    IERC20 public immutable usdc;
    address public owner;
    uint256 public nextLoanId = 1;
    uint256 public constant REVIEW_PERIOD = 2 days;

    mapping(address => bool) public members;
    mapping(address => MemberStats) public memberStats;
    mapping(uint256 => Loan) public loans;

    bool private locked;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MemberSet(address indexed member, bool enabled);
    event LoanRequested(
        uint256 indexed loanId,
        bytes32 indexed toolId,
        address indexed borrower,
        address toolOwner,
        uint64 startAt,
        uint64 dueAt,
        uint256 deposit,
        uint256 dailyLateFee,
        string listingURI
    );
    event LoanAccepted(uint256 indexed loanId);
    event LoanCancelled(uint256 indexed loanId, address indexed caller);
    event ReturnMarked(uint256 indexed loanId, uint64 returnedAt);
    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);

    error NotOwner();
    error NotMember();
    error InvalidMember();
    error InvalidLoan();
    error InvalidStatus();
    error Unauthorized();
    error TransferFailed();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyMember() {
        if (!members[msg.sender]) revert NotMember();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    constructor(IERC20 usdc_, address owner_) {
        if (address(usdc_) == address(0) || owner_ == address(0)) revert InvalidMember();
        usdc = usdc_;
        owner = owner_;
        members[owner_] = true;
        emit OwnershipTransferred(address(0), owner_);
        emit MemberSet(owner_, true);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidMember();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMember(address member, bool enabled) external onlyOwner {
        if (member == address(0)) revert InvalidMember();
        members[member] = enabled;
        emit MemberSet(member, enabled);
    }

    function createRequest(
        bytes32 toolId,
        address toolOwner,
        uint64 startAt,
        uint64 dueAt,
        uint256 deposit,
        uint256 dailyLateFee,
        string calldata listingURI
    ) external onlyMember nonReentrant returns (uint256 loanId) {
        if (toolId == bytes32(0) || toolOwner == address(0) || toolOwner == msg.sender) revert InvalidLoan();
        if (!members[toolOwner]) revert NotMember();
        if (startAt < block.timestamp || dueAt <= startAt || deposit == 0 || dailyLateFee == 0) revert InvalidLoan();

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            toolId: toolId,
            listingURI: listingURI,
            borrower: msg.sender,
            toolOwner: toolOwner,
            startAt: startAt,
            dueAt: dueAt,
            returnedAt: 0,
            deposit: deposit,
            dailyLateFee: dailyLateFee,
            status: LoanStatus.Requested
        });

        _safeTransferFrom(msg.sender, address(this), deposit);
        emit LoanRequested(loanId, toolId, msg.sender, toolOwner, startAt, dueAt, deposit, dailyLateFee, listingURI);
    }

    function acceptRequest(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
        if (msg.sender != loan.toolOwner) revert Unauthorized();
        if (!members[msg.sender]) revert NotMember();
        if (block.timestamp > loan.startAt) revert InvalidLoan();
        loan.status = LoanStatus.Active;
        emit LoanAccepted(loanId);
    }

    function declineRequest(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
        if (msg.sender != loan.toolOwner) revert Unauthorized();
        loan.status = LoanStatus.Cancelled;
        uint256 refund = loan.deposit;
        loan.deposit = 0;
        _safeTransfer(loan.borrower, refund);
        emit LoanCancelled(loanId, msg.sender);
    }

    function cancelRequest(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
        if (msg.sender != loan.borrower) revert Unauthorized();
        loan.status = LoanStatus.Cancelled;
        uint256 refund = loan.deposit;
        loan.deposit = 0;
        _safeTransfer(loan.borrower, refund);
        emit LoanCancelled(loanId, msg.sender);
    }

    function markReturned(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) revert InvalidStatus();
        if (msg.sender != loan.borrower) revert Unauthorized();
        loan.status = LoanStatus.ReturnPending;
        loan.returnedAt = uint64(block.timestamp);
        emit ReturnMarked(loanId, loan.returnedAt);
    }

    function confirmReturn(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.ReturnPending) revert InvalidStatus();
        if (msg.sender != loan.toolOwner) revert Unauthorized();
        _settle(loanId, loan);
    }

    function claimRefundAfterReview(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.ReturnPending) revert InvalidStatus();
        if (msg.sender != loan.borrower) revert Unauthorized();
        if (block.timestamp < loan.returnedAt + REVIEW_PERIOD) revert InvalidLoan();
        _settle(loanId, loan);
    }

    function claimOverdueDeposit(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) revert InvalidStatus();
        if (msg.sender != loan.toolOwner) revert Unauthorized();
        uint256 fee = lateFeeOwed(loanId, uint64(block.timestamp));
        if (fee < loan.deposit) revert InvalidLoan();

        uint256 deposit = loan.deposit;
        loan.deposit = 0;
        loan.status = LoanStatus.Settled;
        _recordStats(loan.borrower, loan.toolOwner, true, deposit);
        _safeTransfer(loan.toolOwner, deposit);
        emit LoanSettled(loanId, 0, deposit, true);
    }

    function lateFeeOwed(uint256 loanId, uint64 returnedAt) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (loan.status == LoanStatus.None) revert InvalidLoan();
        if (returnedAt <= loan.dueAt) return 0;

        uint256 lateSeconds = uint256(returnedAt - loan.dueAt);
        uint256 daysLate = (lateSeconds + 1 days - 1) / 1 days;
        uint256 fee = daysLate * loan.dailyLateFee;
        return fee > loan.deposit ? loan.deposit : fee;
    }

    function _settle(uint256 loanId, Loan storage loan) private {
        uint256 fee = lateFeeOwed(loanId, loan.returnedAt);
        uint256 refund = loan.deposit - fee;
        bool late = fee > 0;

        loan.deposit = 0;
        loan.status = LoanStatus.Settled;
        _recordStats(loan.borrower, loan.toolOwner, late, fee);

        if (fee > 0) _safeTransfer(loan.toolOwner, fee);
        if (refund > 0) _safeTransfer(loan.borrower, refund);
        emit LoanSettled(loanId, refund, fee, late);
    }

    function _recordStats(address borrower, address toolOwner, bool late, uint256 fee) private {
        MemberStats storage borrowerStats = memberStats[borrower];
        MemberStats storage ownerStats = memberStats[toolOwner];
        borrowerStats.loansBorrowed += 1;
        ownerStats.loansLent += 1;
        if (late) {
            borrowerStats.lateReturns += 1;
            borrowerStats.lateFeesPaid += fee;
            ownerStats.lateFeesEarned += fee;
        }
    }

    function _safeTransfer(address to, uint256 amount) private {
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        if (!usdc.transferFrom(from, to, amount)) revert TransferFailed();
    }
}
