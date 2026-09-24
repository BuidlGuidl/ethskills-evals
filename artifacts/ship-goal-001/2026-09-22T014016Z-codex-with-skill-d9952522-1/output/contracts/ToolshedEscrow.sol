// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ToolshedEscrow is Ownable {
    using SafeERC20 for IERC20;

    enum LoanStatus {
        None,
        Active,
        Settled
    }

    struct Loan {
        address toolOwner;
        address borrower;
        bytes32 toolId;
        uint64 dueAt;
        uint64 returnedAt;
        uint256 deposit;
        uint256 dailyLateFee;
        LoanStatus status;
    }

    IERC20 public immutable usdc;
    uint256 public nextLoanId = 1;

    mapping(uint256 loanId => Loan) public loans;

    event LoanOpened(
        uint256 indexed loanId,
        bytes32 indexed toolId,
        address indexed borrower,
        address toolOwner,
        uint64 dueAt,
        uint256 deposit,
        uint256 dailyLateFee
    );
    event ReturnSettled(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed toolOwner,
        uint64 returnedAt,
        uint256 lateDays,
        uint256 ownerFee,
        uint256 borrowerRefund
    );
    event LoanEscalated(uint256 indexed loanId, address indexed caller);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidDueDate();
    error LoanNotActive();
    error NotToolOwner();
    error NotParticipant();
    error ReturnedInFuture();

    constructor(IERC20 usdc_, address initialOwner) Ownable(initialOwner) {
        if (address(usdc_) == address(0) || initialOwner == address(0)) {
            revert InvalidAddress();
        }

        usdc = usdc_;
    }

    function openLoan(
        bytes32 toolId,
        address toolOwner,
        uint64 dueAt,
        uint256 deposit,
        uint256 dailyLateFee
    ) external returns (uint256 loanId) {
        if (toolOwner == address(0) || toolOwner == msg.sender) {
            revert InvalidAddress();
        }
        if (dueAt <= block.timestamp) {
            revert InvalidDueDate();
        }
        if (deposit == 0 || dailyLateFee == 0) {
            revert InvalidAmount();
        }

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            toolOwner: toolOwner,
            borrower: msg.sender,
            toolId: toolId,
            dueAt: dueAt,
            returnedAt: 0,
            deposit: deposit,
            dailyLateFee: dailyLateFee,
            status: LoanStatus.Active
        });

        usdc.safeTransferFrom(msg.sender, address(this), deposit);

        emit LoanOpened(loanId, toolId, msg.sender, toolOwner, dueAt, deposit, dailyLateFee);
    }

    function settleReturn(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) {
            revert LoanNotActive();
        }
        if (msg.sender != loan.toolOwner) {
            revert NotToolOwner();
        }

        _settle(loanId, loan, uint64(block.timestamp));
    }

    function associationSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) {
            revert LoanNotActive();
        }
        if (returnedAt > block.timestamp) {
            revert ReturnedInFuture();
        }

        _settle(loanId, loan, returnedAt);
    }

    function escalate(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) {
            revert LoanNotActive();
        }
        if (msg.sender != loan.borrower && msg.sender != loan.toolOwner) {
            revert NotParticipant();
        }

        emit LoanEscalated(loanId, msg.sender);
    }

    function quoteSettlement(uint256 loanId, uint64 returnedAt)
        external
        view
        returns (uint256 lateDays, uint256 ownerFee, uint256 borrowerRefund)
    {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) {
            revert LoanNotActive();
        }

        return _quote(loan, returnedAt);
    }

    function _settle(uint256 loanId, Loan storage loan, uint64 returnedAt) private {
        (uint256 lateDays, uint256 ownerFee, uint256 borrowerRefund) = _quote(loan, returnedAt);

        loan.returnedAt = returnedAt;
        loan.status = LoanStatus.Settled;

        if (ownerFee > 0) {
            usdc.safeTransfer(loan.toolOwner, ownerFee);
        }
        if (borrowerRefund > 0) {
            usdc.safeTransfer(loan.borrower, borrowerRefund);
        }

        emit ReturnSettled(
            loanId,
            loan.borrower,
            loan.toolOwner,
            returnedAt,
            lateDays,
            ownerFee,
            borrowerRefund
        );
    }

    function _quote(Loan storage loan, uint64 returnedAt)
        private
        view
        returns (uint256 lateDays, uint256 ownerFee, uint256 borrowerRefund)
    {
        if (returnedAt <= loan.dueAt) {
            return (0, 0, loan.deposit);
        }

        unchecked {
            uint256 secondsLate = uint256(returnedAt - loan.dueAt);
            lateDays = (secondsLate + 1 days - 1) / 1 days;
        }
        ownerFee = lateDays * loan.dailyLateFee;
        if (ownerFee > loan.deposit) {
            ownerFee = loan.deposit;
        }
        borrowerRefund = loan.deposit - ownerFee;
    }
}
