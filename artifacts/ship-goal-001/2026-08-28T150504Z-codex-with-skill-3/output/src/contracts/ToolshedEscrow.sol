// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
contract ToolshedEscrow {
    enum Status { None, Funded, Active, Settled, Cancelled }

    struct Loan {
        address borrower;
        address owner;
        uint64 dueAt;
        uint128 deposit;
        uint128 dailyLateFee;
        bytes32 metadataHash;
        Status status;
    }

    IERC20 public immutable usdc;
    address public immutable admin;
    mapping(bytes32 => Loan) public loans;

    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
    event LoanActivated(bytes32 indexed loanId);
    event LoanCancelled(bytes32 indexed loanId);
    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);

    error Unauthorized();
    error InvalidLoan();
    error InvalidTerms();
    error TransferFailed();

    constructor(address usdc_, address admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
        usdc = IERC20(usdc_);
        admin = admin_;
    }

    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
    }

    function activateLoan(bytes32 loanId) external {
        Loan storage loan = loans[loanId];
        if (msg.sender != loan.owner) revert Unauthorized();
        if (loan.status != Status.Funded) revert InvalidLoan();
        loan.status = Status.Active;
        emit LoanActivated(loanId);
    }

    function cancelLoan(bytes32 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Funded) revert InvalidLoan();
        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
        loan.status = Status.Cancelled;
        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
        emit LoanCancelled(loanId);
    }

    function confirmReturn(bytes32 loanId) external {
        Loan storage loan = loans[loanId];
        if (msg.sender != loan.owner) revert Unauthorized();
        _settle(loanId, uint64(block.timestamp), false);
    }

    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
        if (msg.sender != admin) revert Unauthorized();
        if (returnedAt > block.timestamp) revert InvalidTerms();
        _settle(loanId, returnedAt, true);
    }

    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active) revert InvalidLoan();
        return _amounts(loan, returnedAt);
    }

    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Active) revert InvalidLoan();
        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
        loan.status = Status.Settled;
        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
    }

    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
        ownerPayout = lateDays * loan.dailyLateFee;
        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
        borrowerRefund = loan.deposit - ownerPayout;
    }
}
