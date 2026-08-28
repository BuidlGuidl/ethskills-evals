// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title ToolshedEscrow
/// @notice USDC deposits for loans agreed by association members offchain.
contract ToolshedEscrow {
    enum Status { None, Active, Settled, Cancelled }

    struct Loan {
        bytes32 listingId;
        address lender;
        address borrower;
        uint128 deposit;
        uint128 dailyLateFee;
        uint64 dueAt;
        Status status;
    }

    IERC20 public immutable usdc;
    address public admin;
    address public pendingAdmin;
    uint256 public nextLoanId = 1;
    mapping(address => bool) public isMember;
    mapping(uint256 => Loan) public loans;

    error Unauthorized();
    error InvalidLoan();
    error TransferFailed();

    event MemberSet(address indexed member, bool allowed);
    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
    event LoanCancelled(uint256 indexed loanId);
    event AdminTransferStarted(address indexed pendingAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    constructor(address usdc_, address admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
        usdc = IERC20(usdc_);
        admin = admin_;
    }

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }

    function setMember(address member, bool allowed) external onlyAdmin {
        if (member == address(0)) revert InvalidLoan();
        isMember[member] = allowed;
        emit MemberSet(member, allowed);
    }

    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
        loanId = nextLoanId++;
        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
        _safeTransferFrom(msg.sender, address(this), deposit);
        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
    }

    /// @notice Lender confirms the physical return. Late days round up.
    function confirmReturn(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
        _settle(loanId, block.timestamp);
    }

    /// @notice Association resolves a dispute using the agreed effective return time.
    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
        _settle(loanId, returnedAt);
    }

    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
    function cancelLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
        loan.status = Status.Cancelled;
        _safeTransfer(loan.borrower, loan.deposit);
        emit LoanCancelled(loanId);
    }

    function startAdminTransfer(address nextAdmin) external onlyAdmin {
        if (nextAdmin == address(0)) revert InvalidLoan();
        pendingAdmin = nextAdmin;
        emit AdminTransferStarted(nextAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert Unauthorized();
        address previous = admin;
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferred(previous, msg.sender);
    }

    function _settle(uint256 loanId, uint256 returnedAt) internal {
        Loan storage loan = loans[loanId];
        uint256 lateFee;
        if (returnedAt > loan.dueAt) {
            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
            lateFee = lateDays * loan.dailyLateFee;
            if (lateFee > loan.deposit) lateFee = loan.deposit;
        }
        uint256 refund = loan.deposit - lateFee;
        loan.status = Status.Settled;
        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
        if (refund != 0) _safeTransfer(loan.borrower, refund);
        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}

