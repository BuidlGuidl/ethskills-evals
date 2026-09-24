// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ToolshedEscrow {
    enum LoanStatus {
        None,
        Requested,
        Active,
        Closed,
        Cancelled
    }

    struct Loan {
        bytes32 toolId;
        bytes32 listingHash;
        address owner;
        address borrower;
        uint64 requestedAt;
        uint64 startedAt;
        uint64 dueAt;
        uint64 closedAt;
        uint256 depositAmount;
        uint256 dailyLateFee;
        uint256 ownerPayout;
        uint256 borrowerRefund;
        LoanStatus status;
    }

    struct MemberStats {
        uint64 completedLoans;
        uint64 lateReturns;
        uint256 totalLateFeesPaid;
        uint256 totalLateFeesEarned;
    }

    IERC20 public immutable usdc;
    address public admin;
    uint256 public nextLoanId = 1;
    bool private locked;

    mapping(address member => bool isMember) public members;
    mapping(uint256 loanId => Loan loan) public loans;
    mapping(address member => MemberStats stats) public memberStats;

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event MemberSet(address indexed member, bool allowed);
    event LoanRequested(
        uint256 indexed loanId,
        bytes32 indexed toolId,
        address indexed owner,
        address borrower,
        uint64 dueAt,
        uint256 depositAmount,
        uint256 dailyLateFee,
        bytes32 listingHash
    );
    event LoanApproved(uint256 indexed loanId, uint64 startedAt);
    event LoanCancelled(uint256 indexed loanId, address indexed borrower, uint256 refund);
    event LoanClosed(
        uint256 indexed loanId,
        address indexed owner,
        address indexed borrower,
        bool late,
        uint256 ownerPayout,
        uint256 borrowerRefund
    );
    event ExpiredDepositClaimed(uint256 indexed loanId, address indexed owner, uint256 ownerPayout);

    error NotAdmin();
    error NotMember();
    error InvalidAddress();
    error InvalidLoan();
    error InvalidLoanStatus();
    error InvalidTerms();
    error Unauthorized();
    error TransferFailed();
    error ReentrantCall();
    error DepositStillRefundable();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyMember(address account) {
        if (!members[account]) revert NotMember();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    constructor(address usdc_, address admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidAddress();
        usdc = IERC20(usdc_);
        admin = admin_;
        members[admin_] = true;
        emit MemberSet(admin_, true);
        emit AdminTransferred(address(0), admin_);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
        members[newAdmin] = true;
        emit MemberSet(newAdmin, true);
    }

    function setMember(address member, bool allowed) external onlyAdmin {
        if (member == address(0)) revert InvalidAddress();
        members[member] = allowed;
        emit MemberSet(member, allowed);
    }

    function requestLoan(
        bytes32 toolId,
        bytes32 listingHash,
        address owner,
        uint64 dueAt,
        uint256 depositAmount,
        uint256 dailyLateFee
    ) external nonReentrant onlyMember(msg.sender) onlyMember(owner) returns (uint256 loanId) {
        if (owner == msg.sender || owner == address(0)) revert InvalidAddress();
        if (toolId == bytes32(0) || listingHash == bytes32(0)) revert InvalidLoan();
        if (dueAt <= block.timestamp || depositAmount == 0 || dailyLateFee == 0) revert InvalidTerms();

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            toolId: toolId,
            listingHash: listingHash,
            owner: owner,
            borrower: msg.sender,
            requestedAt: uint64(block.timestamp),
            startedAt: 0,
            dueAt: dueAt,
            closedAt: 0,
            depositAmount: depositAmount,
            dailyLateFee: dailyLateFee,
            ownerPayout: 0,
            borrowerRefund: 0,
            status: LoanStatus.Requested
        });

        _safeTransferFrom(msg.sender, address(this), depositAmount);

        emit LoanRequested(
            loanId, toolId, owner, msg.sender, dueAt, depositAmount, dailyLateFee, listingHash
        );
    }

    function approveLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested) revert InvalidLoanStatus();
        if (msg.sender != loan.owner) revert Unauthorized();

        loan.status = LoanStatus.Active;
        loan.startedAt = uint64(block.timestamp);

        emit LoanApproved(loanId, loan.startedAt);
    }

    function cancelRequest(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested) revert InvalidLoanStatus();
        if (msg.sender != loan.borrower) revert Unauthorized();

        uint256 refund = loan.depositAmount;
        loan.status = LoanStatus.Cancelled;
        loan.closedAt = uint64(block.timestamp);
        loan.borrowerRefund = refund;

        _safeTransfer(loan.borrower, refund);

        emit LoanCancelled(loanId, loan.borrower, refund);
    }

    function markReturned(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) revert InvalidLoanStatus();
        if (msg.sender != loan.owner) revert Unauthorized();

        (uint256 ownerPayout, uint256 borrowerRefund, bool late) = previewSettlement(loanId);
        _closeLoan(loanId, ownerPayout, borrowerRefund, late);
    }

    function claimExpiredDeposit(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) revert InvalidLoanStatus();
        if (msg.sender != loan.owner) revert Unauthorized();

        (uint256 ownerPayout, uint256 borrowerRefund, bool late) = previewSettlement(loanId);
        if (borrowerRefund != 0) revert DepositStillRefundable();

        _closeLoan(loanId, ownerPayout, borrowerRefund, late);
        emit ExpiredDepositClaimed(loanId, loan.owner, ownerPayout);
    }

    function previewSettlement(uint256 loanId)
        public
        view
        returns (uint256 ownerPayout, uint256 borrowerRefund, bool late)
    {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) revert InvalidLoanStatus();

        uint256 lateFee = 0;
        if (block.timestamp > loan.dueAt) {
            uint256 secondsLate = block.timestamp - loan.dueAt;
            uint256 daysLate = (secondsLate + 1 days - 1) / 1 days;
            lateFee = daysLate * loan.dailyLateFee;
            late = true;
        }

        if (lateFee > loan.depositAmount) {
            lateFee = loan.depositAmount;
        }

        ownerPayout = lateFee;
        borrowerRefund = loan.depositAmount - lateFee;
    }

    function loanStatus(uint256 loanId) external view returns (LoanStatus) {
        return loans[loanId].status;
    }

    function _closeLoan(
        uint256 loanId,
        uint256 ownerPayout,
        uint256 borrowerRefund,
        bool late
    ) private {
        Loan storage loan = loans[loanId];
        loan.status = LoanStatus.Closed;
        loan.closedAt = uint64(block.timestamp);
        loan.ownerPayout = ownerPayout;
        loan.borrowerRefund = borrowerRefund;

        MemberStats storage borrowerStats = memberStats[loan.borrower];
        borrowerStats.completedLoans += 1;
        if (late) {
            borrowerStats.lateReturns += 1;
            borrowerStats.totalLateFeesPaid += ownerPayout;
            memberStats[loan.owner].totalLateFeesEarned += ownerPayout;
        }

        if (ownerPayout != 0) {
            _safeTransfer(loan.owner, ownerPayout);
        }
        if (borrowerRefund != 0) {
            _safeTransfer(loan.borrower, borrowerRefund);
        }

        emit LoanClosed(loanId, loan.owner, loan.borrower, late, ownerPayout, borrowerRefund);
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
