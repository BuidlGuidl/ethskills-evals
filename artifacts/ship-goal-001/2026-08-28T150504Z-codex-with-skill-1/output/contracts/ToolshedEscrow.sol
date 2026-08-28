// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice USDC escrow and canonical loan history for a member-run tool library.
contract ToolshedEscrow {
    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }

    struct Loan {
        bytes32 toolId;
        address borrower;
        address lender;
        uint64 requestedAt;
        uint64 dueAt;
        uint64 returnedAt;
        uint128 deposit;
        uint128 lateFeePerDay;
        Status status;
    }

    IERC20 public immutable usdc;
    address public owner;
    uint256 public nextLoanId = 1;
    mapping(address => bool) public isMember;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256) public completedLoans;
    mapping(address => uint256) public lateReturns;

    event MembershipSet(address indexed member, bool active);
    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
    event LoanAccepted(uint256 indexed loanId);
    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
    event LoanClosed(uint256 indexed loanId, Status status);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }

    constructor(address usdc_, address owner_) {
        require(usdc_ != address(0) && owner_ != address(0), "zero address");
        usdc = IERC20(usdc_);
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function setMember(address member, bool active) external onlyOwner {
        require(member != address(0), "zero member");
        isMember[member] = active;
        emit MembershipSet(member, active);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
        external onlyMember returns (uint256 loanId)
    {
        require(isMember[lender] && lender != msg.sender, "invalid lender");
        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
        loanId = nextLoanId++;
        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
        _safeTransferFrom(msg.sender, address(this), deposit);
        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
    }

    function acceptLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
        require(loan.dueAt > block.timestamp, "due date passed");
        loan.status = Status.Active;
        emit LoanAccepted(loanId);
    }

    function cancelRequest(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
        loan.status = Status.Cancelled;
        _safeTransfer(loan.borrower, loan.deposit);
        emit LoanClosed(loanId, Status.Cancelled);
    }

    function rejectRequest(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
        loan.status = Status.Rejected;
        _safeTransfer(loan.borrower, loan.deposit);
        emit LoanClosed(loanId, Status.Rejected);
    }

    function markReturned(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
        loan.status = Status.Returned;
        loan.returnedAt = uint64(block.timestamp);
        emit ReturnMarked(loanId, block.timestamp);
    }

    function confirmReturn(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
        _settle(loanId, loan);
    }

    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
        loan.returnedAt = returnedAt;
        loan.status = Status.Returned;
        _settle(loanId, loan);
    }

    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
        Loan storage loan = loans[loanId];
        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
        fee = _lateFee(loan, at);
        refund = uint256(loan.deposit) - fee;
    }

    function _settle(uint256 loanId, Loan storage loan) internal {
        uint256 fee = _lateFee(loan, loan.returnedAt);
        uint256 refund = uint256(loan.deposit) - fee;
        bool late = loan.returnedAt > loan.dueAt;
        loan.status = Status.Settled;
        completedLoans[loan.borrower]++;
        if (late) lateReturns[loan.borrower]++;
        if (fee != 0) _safeTransfer(loan.lender, fee);
        if (refund != 0) _safeTransfer(loan.borrower, refund);
        emit LoanSettled(loanId, refund, fee, late);
    }

    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
        if (at <= loan.dueAt) return 0;
        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
        return fee > loan.deposit ? loan.deposit : fee;
    }

    function _safeTransfer(address to, uint256 amount) internal {
        require(usdc.transfer(to, amount), "USDC transfer failed");
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
    }
}
