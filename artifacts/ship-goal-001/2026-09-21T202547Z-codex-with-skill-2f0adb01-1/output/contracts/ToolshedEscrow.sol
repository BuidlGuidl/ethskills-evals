// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ToolshedEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LoanStatus {
        None,
        Requested,
        Active,
        Returned,
        Cancelled,
        Defaulted
    }

    struct Loan {
        bytes32 toolId;
        address toolOwner;
        address borrower;
        uint256 depositAmount;
        uint256 lateFeePerDay;
        uint64 startsAt;
        uint64 dueAt;
        uint64 returnedAt;
        LoanStatus status;
    }

    struct BorrowerStats {
        uint64 completedLoans;
        uint64 lateReturns;
        uint256 totalLateFeesPaid;
    }

    IERC20 public immutable usdc;
    uint256 public nextLoanId = 1;
    uint256 public constant DEFAULT_GRACE_PERIOD = 30 days;

    mapping(address => bool) public isMember;
    mapping(uint256 => Loan) public loans;
    mapping(address => BorrowerStats) public borrowerStats;

    event MemberUpdated(address indexed member, bool allowed);
    event LoanRequested(
        uint256 indexed loanId,
        bytes32 indexed toolId,
        address indexed borrower,
        address toolOwner,
        uint256 depositAmount,
        uint256 lateFeePerDay,
        uint64 startsAt,
        uint64 dueAt
    );
    event LoanAccepted(uint256 indexed loanId);
    event LoanCancelled(uint256 indexed loanId);
    event LoanReturned(uint256 indexed loanId, uint256 lateDays, uint256 lateFee, uint256 refund);
    event LoanDefaulted(uint256 indexed loanId, uint256 ownerPayout);

    error NotMember();
    error InvalidLoan();
    error InvalidSchedule();
    error InvalidAmount();
    error Unauthorized();
    error WrongStatus();

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    constructor(IERC20Metadata usdcToken, address initialOwner) Ownable(initialOwner) {
        if (address(usdcToken) == address(0) || initialOwner == address(0)) revert InvalidAmount();
        if (usdcToken.decimals() != 6) revert InvalidAmount();
        usdc = IERC20(address(usdcToken));
        isMember[initialOwner] = true;
        emit MemberUpdated(initialOwner, true);
    }

    function setMember(address member, bool allowed) external onlyOwner {
        if (member == address(0)) revert InvalidAmount();
        isMember[member] = allowed;
        emit MemberUpdated(member, allowed);
    }

    function setMembers(address[] calldata members, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == address(0)) revert InvalidAmount();
            isMember[members[i]] = allowed;
            emit MemberUpdated(members[i], allowed);
        }
    }

    function requestLoan(
        bytes32 toolId,
        address toolOwner,
        uint256 depositAmount,
        uint256 lateFeePerDay,
        uint64 startsAt,
        uint64 dueAt
    ) external onlyMember nonReentrant returns (uint256 loanId) {
        if (!isMember[toolOwner]) revert NotMember();
        if (toolOwner == msg.sender || toolOwner == address(0) || toolId == bytes32(0)) revert InvalidLoan();
        if (depositAmount == 0 || lateFeePerDay == 0 || lateFeePerDay > depositAmount) revert InvalidAmount();
        if (startsAt < block.timestamp || dueAt <= startsAt) revert InvalidSchedule();

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            toolId: toolId,
            toolOwner: toolOwner,
            borrower: msg.sender,
            depositAmount: depositAmount,
            lateFeePerDay: lateFeePerDay,
            startsAt: startsAt,
            dueAt: dueAt,
            returnedAt: 0,
            status: LoanStatus.Requested
        });

        usdc.safeTransferFrom(msg.sender, address(this), depositAmount);

        emit LoanRequested(loanId, toolId, msg.sender, toolOwner, depositAmount, lateFeePerDay, startsAt, dueAt);
    }

    function acceptLoan(uint256 loanId) external onlyMember {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested) revert WrongStatus();
        if (loan.toolOwner != msg.sender) revert Unauthorized();

        loan.status = LoanStatus.Active;
        emit LoanAccepted(loanId);
    }

    function cancelRequest(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Requested) revert WrongStatus();
        if (msg.sender != loan.borrower && msg.sender != loan.toolOwner) revert Unauthorized();

        uint256 refund = loan.depositAmount;
        loan.status = LoanStatus.Cancelled;
        loan.depositAmount = 0;

        usdc.safeTransfer(loan.borrower, refund);
        emit LoanCancelled(loanId);
    }

    function confirmReturn(uint256 loanId) external onlyMember nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) revert WrongStatus();
        if (loan.toolOwner != msg.sender) revert Unauthorized();

        uint64 returnedAt = uint64(block.timestamp);
        uint256 lateDays = lateDaysFor(loan.dueAt, returnedAt);
        uint256 lateFee = lateDays * loan.lateFeePerDay;
        if (lateFee > loan.depositAmount) {
            lateFee = loan.depositAmount;
        }
        uint256 refund = loan.depositAmount - lateFee;

        loan.status = LoanStatus.Returned;
        loan.returnedAt = returnedAt;
        loan.depositAmount = 0;

        BorrowerStats storage stats = borrowerStats[loan.borrower];
        stats.completedLoans += 1;
        if (lateDays > 0) {
            stats.lateReturns += 1;
            stats.totalLateFeesPaid += lateFee;
        }

        if (lateFee > 0) {
            usdc.safeTransfer(loan.toolOwner, lateFee);
        }
        if (refund > 0) {
            usdc.safeTransfer(loan.borrower, refund);
        }

        emit LoanReturned(loanId, lateDays, lateFee, refund);
    }

    function claimDefault(uint256 loanId) external onlyMember nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) revert WrongStatus();
        if (loan.toolOwner != msg.sender) revert Unauthorized();
        if (block.timestamp <= loan.dueAt + DEFAULT_GRACE_PERIOD) revert InvalidSchedule();

        uint256 payout = loan.depositAmount;
        loan.status = LoanStatus.Defaulted;
        loan.depositAmount = 0;

        BorrowerStats storage stats = borrowerStats[loan.borrower];
        stats.completedLoans += 1;
        stats.lateReturns += 1;
        stats.totalLateFeesPaid += payout;

        usdc.safeTransfer(loan.toolOwner, payout);
        emit LoanDefaulted(loanId, payout);
    }

    function lateDaysFor(uint64 dueAt, uint64 returnedAt) public pure returns (uint256) {
        if (returnedAt <= dueAt) {
            return 0;
        }
        return (uint256(returnedAt - dueAt) + 1 days - 1) / 1 days;
    }
}
