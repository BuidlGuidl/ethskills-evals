// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ToolshedEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LoanStatus {
        Requested,
        Returned
    }

    struct Loan {
        bytes32 toolId;
        address borrower;
        address owner;
        uint64 requestedAt;
        uint64 dueAt;
        uint256 deposit;
        uint256 dailyLateFee;
        LoanStatus status;
        uint256 lateFeePaid;
        uint64 returnedAt;
    }

    struct MemberStats {
        uint64 loans;
        uint64 onTimeReturns;
        uint64 lateReturns;
        uint256 lateFeesPaid;
        uint256 feesEarned;
    }

    IERC20 public immutable usdc;
    uint256 public nextLoanId = 1;

    mapping(address member => bool active) public isMember;
    mapping(uint256 loanId => Loan loan) public loans;
    mapping(address member => MemberStats stats) public stats;

    event MemberSet(address indexed member, bool active);
    event LoanRequested(
        uint256 indexed loanId,
        bytes32 indexed toolId,
        address indexed borrower,
        address owner,
        uint64 dueAt,
        uint256 deposit,
        uint256 dailyLateFee
    );
    event ToolReturned(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed owner,
        uint256 lateFeePaid,
        uint256 depositRefunded,
        uint256 lateDays
    );

    error NotMember();
    error ZeroAddress();
    error InvalidLoanTerms();
    error LoanNotOpen();
    error OnlyToolOwner();

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    constructor(address usdc_, address steward) Ownable(steward) {
        if (usdc_ == address(0) || steward == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        isMember[steward] = true;
        emit MemberSet(steward, true);
    }

    function setMember(address member, bool active) external onlyOwner {
        if (member == address(0)) revert ZeroAddress();
        isMember[member] = active;
        emit MemberSet(member, active);
    }

    function requestLoan(
        bytes32 toolId,
        address owner,
        uint64 dueAt,
        uint256 deposit,
        uint256 dailyLateFee
    ) external nonReentrant onlyMember returns (uint256 loanId) {
        if (owner == address(0) || owner == msg.sender) revert InvalidLoanTerms();
        if (toolId == bytes32(0) || dueAt <= block.timestamp || deposit == 0) revert InvalidLoanTerms();
        if (dailyLateFee == 0 || dailyLateFee > deposit) revert InvalidLoanTerms();

        loanId = nextLoanId++;

        loans[loanId] = Loan({
            toolId: toolId,
            borrower: msg.sender,
            owner: owner,
            requestedAt: uint64(block.timestamp),
            dueAt: dueAt,
            deposit: deposit,
            dailyLateFee: dailyLateFee,
            status: LoanStatus.Requested,
            lateFeePaid: 0,
            returnedAt: 0
        });

        stats[msg.sender].loans += 1;
        usdc.safeTransferFrom(msg.sender, address(this), deposit);

        emit LoanRequested(loanId, toolId, msg.sender, owner, dueAt, deposit, dailyLateFee);
    }

    function returnTool(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested || loan.borrower == address(0)) revert LoanNotOpen();
        if (msg.sender != loan.owner) revert OnlyToolOwner();

        (uint256 lateFee, uint256 refund, uint256 lateDays) = quoteReturn(loanId);

        loan.status = LoanStatus.Returned;
        loan.returnedAt = uint64(block.timestamp);
        loan.lateFeePaid = lateFee;

        if (lateFee > 0) {
            stats[loan.borrower].lateReturns += 1;
            stats[loan.borrower].lateFeesPaid += lateFee;
            stats[loan.owner].feesEarned += lateFee;
        } else {
            stats[loan.borrower].onTimeReturns += 1;
        }

        if (lateFee > 0) usdc.safeTransfer(loan.owner, lateFee);
        if (refund > 0) usdc.safeTransfer(loan.borrower, refund);

        emit ToolReturned(loanId, loan.borrower, loan.owner, lateFee, refund, lateDays);
    }

    function quoteReturn(uint256 loanId) public view returns (uint256 lateFee, uint256 refund, uint256 lateDays) {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested || loan.borrower == address(0)) revert LoanNotOpen();

        if (block.timestamp > loan.dueAt) {
            uint256 lateSeconds = block.timestamp - loan.dueAt;
            lateDays = (lateSeconds + 1 days - 1) / 1 days;
            lateFee = lateDays * loan.dailyLateFee;
            if (lateFee > loan.deposit) lateFee = loan.deposit;
        }

        refund = loan.deposit - lateFee;
    }
}
