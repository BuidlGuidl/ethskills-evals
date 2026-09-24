// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ToolshedEscrow
/// @notice USDC deposit escrow for neighborhood tool loans.
contract ToolshedEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant DAY = 1 days;

    IERC20 public immutable usdc;
    uint256 public nextToolId = 1;
    uint256 public nextLoanId = 1;

    enum LoanState {
        None,
        Pending,
        Active,
        Returned,
        Cancelled
    }

    struct ToolListing {
        address owner;
        uint256 depositAmount;
        uint256 lateFeePerDay;
        uint16 maxLoanDays;
        bool listed;
        uint256 activeLoanId;
        string metadataURI;
    }

    struct Loan {
        uint256 toolId;
        address borrower;
        uint16 requestedDays;
        uint256 depositAmount;
        uint256 lateFeePerDay;
        uint256 startAt;
        uint256 dueAt;
        uint256 returnedAt;
        uint256 lateFeeCharged;
        LoanState state;
    }

    struct MemberStats {
        uint64 completedLoans;
        uint64 lateReturns;
    }

    mapping(uint256 toolId => ToolListing) public tools;
    mapping(uint256 loanId => Loan) public loans;
    mapping(address member => bool) public isMember;
    mapping(address member => MemberStats) public memberStats;

    event MemberUpdated(address indexed member, bool allowed);
    event ToolListed(
        uint256 indexed toolId,
        address indexed owner,
        uint256 depositAmount,
        uint256 lateFeePerDay,
        uint16 maxLoanDays,
        string metadataURI
    );
    event ToolUpdated(
        uint256 indexed toolId,
        uint256 depositAmount,
        uint256 lateFeePerDay,
        uint16 maxLoanDays,
        string metadataURI,
        bool listed
    );
    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 requestedDays);
    event LoanApproved(uint256 indexed loanId, uint256 indexed toolId, address indexed owner, address borrower, uint256 dueAt);
    event PendingLoanCancelled(uint256 indexed loanId, address indexed by, uint256 refundedAmount);
    event ToolReturned(
        uint256 indexed loanId,
        uint256 indexed toolId,
        address indexed borrower,
        uint256 lateDays,
        uint256 ownerFee,
        uint256 borrowerRefund
    );

    error ZeroAddress();
    error EmptyMetadata();
    error InvalidAmount();
    error InvalidLoanDays();
    error NotToolOwner();
    error ToolUnavailable();
    error ToolNotListed();
    error InvalidLoanState();
    error NotBorrowerOrOwner();
    error NotMember();

    constructor(IERC20 usdc_, address associationAdmin) Ownable(associationAdmin) {
        if (address(usdc_) == address(0)) revert ZeroAddress();
        if (associationAdmin == address(0)) revert ZeroAddress();
        usdc = usdc_;
        isMember[associationAdmin] = true;
        emit MemberUpdated(associationAdmin, true);
    }

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    function setMember(address member, bool allowed) external onlyOwner {
        if (member == address(0)) revert ZeroAddress();
        isMember[member] = allowed;
        emit MemberUpdated(member, allowed);
    }

    function listTool(
        string calldata metadataURI,
        uint256 depositAmount,
        uint256 lateFeePerDay,
        uint16 maxLoanDays
    ) external onlyMember returns (uint256 toolId) {
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();
        _validateTerms(depositAmount, lateFeePerDay, maxLoanDays);

        toolId = nextToolId++;
        tools[toolId] = ToolListing({
            owner: msg.sender,
            depositAmount: depositAmount,
            lateFeePerDay: lateFeePerDay,
            maxLoanDays: maxLoanDays,
            listed: true,
            activeLoanId: 0,
            metadataURI: metadataURI
        });

        emit ToolListed(toolId, msg.sender, depositAmount, lateFeePerDay, maxLoanDays, metadataURI);
    }

    function updateTool(
        uint256 toolId,
        string calldata metadataURI,
        uint256 depositAmount,
        uint256 lateFeePerDay,
        uint16 maxLoanDays,
        bool listed
    ) external {
        ToolListing storage tool = tools[toolId];
        if (tool.owner != msg.sender) revert NotToolOwner();
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();
        _validateTerms(depositAmount, lateFeePerDay, maxLoanDays);
        if (!listed && tool.activeLoanId != 0) revert ToolUnavailable();

        tool.metadataURI = metadataURI;
        tool.depositAmount = depositAmount;
        tool.lateFeePerDay = lateFeePerDay;
        tool.maxLoanDays = maxLoanDays;
        tool.listed = listed;

        emit ToolUpdated(toolId, depositAmount, lateFeePerDay, maxLoanDays, metadataURI, listed);
    }

    function requestLoan(uint256 toolId, uint16 requestedDays) external onlyMember nonReentrant returns (uint256 loanId) {
        ToolListing storage tool = tools[toolId];
        if (tool.owner == address(0) || !tool.listed) revert ToolNotListed();
        if (tool.activeLoanId != 0) revert ToolUnavailable();
        if (requestedDays == 0 || requestedDays > tool.maxLoanDays) revert InvalidLoanDays();

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            toolId: toolId,
            borrower: msg.sender,
            requestedDays: requestedDays,
            depositAmount: tool.depositAmount,
            lateFeePerDay: tool.lateFeePerDay,
            startAt: 0,
            dueAt: 0,
            returnedAt: 0,
            lateFeeCharged: 0,
            state: LoanState.Pending
        });

        usdc.safeTransferFrom(msg.sender, address(this), tool.depositAmount);
        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
    }

    function approveLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.Pending) revert InvalidLoanState();

        ToolListing storage tool = tools[loan.toolId];
        if (tool.owner != msg.sender) revert NotToolOwner();
        if (tool.activeLoanId != 0 || !tool.listed) revert ToolUnavailable();

        loan.state = LoanState.Active;
        loan.startAt = block.timestamp;
        loan.dueAt = block.timestamp + uint256(loan.requestedDays) * DAY;
        tool.activeLoanId = loanId;

        emit LoanApproved(loanId, loan.toolId, msg.sender, loan.borrower, loan.dueAt);
    }

    function cancelPendingLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.Pending) revert InvalidLoanState();

        ToolListing storage tool = tools[loan.toolId];
        if (msg.sender != loan.borrower && msg.sender != tool.owner) revert NotBorrowerOrOwner();

        loan.state = LoanState.Cancelled;
        uint256 refund = loan.depositAmount;
        loan.depositAmount = 0;

        usdc.safeTransfer(loan.borrower, refund);
        emit PendingLoanCancelled(loanId, msg.sender, refund);
    }

    function confirmReturn(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.Active) revert InvalidLoanState();

        ToolListing storage tool = tools[loan.toolId];
        if (tool.owner != msg.sender) revert NotToolOwner();

        uint256 returnedAt = block.timestamp;
        uint256 lateDays = _lateDays(returnedAt, loan.dueAt);
        uint256 ownerFee = lateDays * loan.lateFeePerDay;
        if (ownerFee > loan.depositAmount) {
            ownerFee = loan.depositAmount;
        }
        uint256 borrowerRefund = loan.depositAmount - ownerFee;

        loan.state = LoanState.Returned;
        loan.returnedAt = returnedAt;
        loan.lateFeeCharged = ownerFee;
        loan.depositAmount = 0;
        tool.activeLoanId = 0;

        MemberStats storage stats = memberStats[loan.borrower];
        stats.completedLoans += 1;
        if (lateDays > 0) {
            stats.lateReturns += 1;
        }

        if (ownerFee > 0) {
            usdc.safeTransfer(tool.owner, ownerFee);
        }
        if (borrowerRefund > 0) {
            usdc.safeTransfer(loan.borrower, borrowerRefund);
        }

        emit ToolReturned(loanId, loan.toolId, loan.borrower, lateDays, ownerFee, borrowerRefund);
    }

    function lateFeeOwed(uint256 loanId) external view returns (uint256 lateDays, uint256 ownerFee, uint256 borrowerRefund) {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.Active) revert InvalidLoanState();

        lateDays = _lateDays(block.timestamp, loan.dueAt);
        ownerFee = lateDays * loan.lateFeePerDay;
        if (ownerFee > loan.depositAmount) {
            ownerFee = loan.depositAmount;
        }
        borrowerRefund = loan.depositAmount - ownerFee;
    }

    function reliabilityBps(address member) external view returns (uint256) {
        MemberStats memory stats = memberStats[member];
        if (stats.completedLoans == 0) {
            return 10_000;
        }
        return ((uint256(stats.completedLoans) - uint256(stats.lateReturns)) * 10_000) / uint256(stats.completedLoans);
    }

    function _lateDays(uint256 returnedAt, uint256 dueAt) internal pure returns (uint256) {
        if (returnedAt <= dueAt) {
            return 0;
        }
        return ((returnedAt - dueAt) + DAY - 1) / DAY;
    }

    function _validateTerms(uint256 depositAmount, uint256 lateFeePerDay, uint16 maxLoanDays) internal pure {
        if (depositAmount == 0 || lateFeePerDay == 0) revert InvalidAmount();
        if (maxLoanDays == 0 || maxLoanDays > 90) revert InvalidLoanDays();
    }
}
