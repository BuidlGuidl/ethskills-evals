// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {MemberRegistry} from "./MemberRegistry.sol";

/// @title Toolshed
/// @notice A lending library for a neighbourhood association: members list tools, other members borrow them
///         against a USDC deposit, and a daily late fee is taken out of that deposit and paid to the owner.
/// @dev All money movement happens in this contract; every settled loan is also written to the
///      MemberRegistry so the browse screen can sort by track record.
contract Toolshed is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LoanStatus {
        None,
        Pending, // deposit escrowed, waiting for the owner to hand the tool over
        Active, // tool is out
        Settled, // tool came back, deposit split between late fee and refund
        Declined, // owner said no, deposit refunded
        Cancelled, // borrower withdrew the request, deposit refunded
        Defaulted // tool never came back, owner claimed the whole deposit
    }

    struct Tool {
        uint64 id;
        address owner;
        uint96 deposit; // USDC (6 decimals) held while the tool is out
        uint96 dailyLateFee; // USDC per started day past the due date
        bool listed; // shows up on the browse screen and accepts requests
        uint64 activeLoanId; // 0 when the tool is on the shelf
        uint64 listedAt;
        string name;
        string photoUri; // ipfs://<cid> or https://...
        string conditionNotes;
    }

    struct Loan {
        uint64 id;
        uint64 toolId;
        address borrower;
        address toolOwner;
        uint96 deposit; // terms are frozen at request time
        uint96 dailyLateFee;
        uint96 lateFeePaid;
        uint32 requestedDays;
        uint32 lateDays;
        uint64 requestedAt;
        uint64 startedAt;
        uint64 dueAt;
        uint64 returnReportedAt; // borrower's claim that the tool is back
        uint64 settledAt;
        LoanStatus status;
    }

    /// @notice How long an owner has to confirm a reported return before the borrower can close it out.
    uint64 public constant CONFIRMATION_WINDOW = 3 days;
    /// @notice How long past the due date before an unreported tool counts as gone for good.
    uint64 public constant DEFAULT_WINDOW = 14 days;
    uint32 public constant MAX_LOAN_DAYS = 90;

    IERC20 public immutable usdc;
    MemberRegistry public immutable registry;

    uint64 public toolCount;
    uint64 public loanCount;

    mapping(uint64 => Tool) private _tools;
    mapping(uint64 => Loan) private _loans;
    mapping(address => uint64[]) private _toolsOf;
    mapping(address => uint64[]) private _loansBorrowed;
    mapping(uint64 => uint64[]) private _loansOfTool;

    event ToolListed(
        uint64 indexed toolId, address indexed owner, string name, uint96 deposit, uint96 dailyLateFee
    );
    event ToolUpdated(uint64 indexed toolId, string name, uint96 deposit, uint96 dailyLateFee);
    event ToolAvailabilityChanged(uint64 indexed toolId, bool listed);
    event LoanRequested(
        uint64 indexed loanId, uint64 indexed toolId, address indexed borrower, uint32 days_, uint96 deposit
    );
    event LoanApproved(uint64 indexed loanId, uint64 indexed toolId, uint64 dueAt);
    event LoanDeclined(uint64 indexed loanId, uint64 indexed toolId);
    event LoanCancelled(uint64 indexed loanId, uint64 indexed toolId);
    event ReturnReported(uint64 indexed loanId, uint64 reportedAt);
    event LoanSettled(
        uint64 indexed loanId,
        uint64 indexed toolId,
        address indexed borrower,
        uint32 lateDays,
        uint96 lateFeeToOwner,
        uint96 refundToBorrower
    );
    event LoanDefaulted(
        uint64 indexed loanId, uint64 indexed toolId, address indexed borrower, uint96 depositToOwner
    );
    event DisputeSettled(uint64 indexed loanId, uint96 toOwner, uint96 toBorrower, bool countedLate);

    error NotAMember();
    error NotToolOwner();
    error NotBorrower();
    error NotSteward();
    error ToolNotListed();
    error ToolIsOut();
    error CannotBorrowOwnTool();
    error BadLoanLength();
    error BadTerms();
    error WrongStatus();
    error ReturnAlreadyReported();
    error NoReturnReported();
    error TooEarly();
    error AmountTooHigh();

    constructor(IERC20 usdc_, MemberRegistry registry_) {
        usdc = usdc_;
        registry = registry_;
    }

    modifier onlyMember() {
        _requireMember(msg.sender);
        _;
    }

    function _requireMember(address who) internal view {
        if (!registry.isActiveMember(who)) revert NotAMember();
    }

    // --- listing tools ---------------------------------------------------------

    /// @notice Put a tool on the shelf. Deposit and late fee are in USDC base units (6 decimals).
    function listTool(
        string calldata name,
        string calldata photoUri,
        string calldata conditionNotes,
        uint96 deposit,
        uint96 dailyLateFee
    ) external onlyMember returns (uint64 toolId) {
        if (deposit == 0 || dailyLateFee > deposit) revert BadTerms();
        toolId = ++toolCount;
        Tool storage t = _tools[toolId];
        t.id = toolId;
        t.owner = msg.sender;
        t.deposit = deposit;
        t.dailyLateFee = dailyLateFee;
        t.listed = true;
        t.listedAt = uint64(block.timestamp);
        t.name = name;
        t.photoUri = photoUri;
        t.conditionNotes = conditionNotes;
        _toolsOf[msg.sender].push(toolId);
        emit ToolListed(toolId, msg.sender, name, deposit, dailyLateFee);
    }

    /// @dev New terms apply to future requests only; open requests and loans keep the terms they were made under.
    function updateTool(
        uint64 toolId,
        string calldata name,
        string calldata photoUri,
        string calldata conditionNotes,
        uint96 deposit,
        uint96 dailyLateFee
    ) external {
        Tool storage t = _tools[toolId];
        if (t.owner != msg.sender) revert NotToolOwner();
        if (deposit == 0 || dailyLateFee > deposit) revert BadTerms();
        t.name = name;
        t.photoUri = photoUri;
        t.conditionNotes = conditionNotes;
        t.deposit = deposit;
        t.dailyLateFee = dailyLateFee;
        emit ToolUpdated(toolId, name, deposit, dailyLateFee);
    }

    /// @notice Take a tool off the browse screen (or put it back). Does not touch loans already running.
    function setToolListed(uint64 toolId, bool listed) external {
        Tool storage t = _tools[toolId];
        if (t.owner != msg.sender) revert NotToolOwner();
        t.listed = listed;
        emit ToolAvailabilityChanged(toolId, listed);
    }

    // --- borrowing -------------------------------------------------------------

    /// @notice Ask to borrow a tool for `days_` days. The deposit is escrowed right away; it comes back if
    ///         the owner declines, if you cancel, or (minus late fees) when the tool is returned.
    function requestLoan(uint64 toolId, uint32 days_)
        external
        onlyMember
        nonReentrant
        returns (uint64 loanId)
    {
        Tool storage t = _tools[toolId];
        if (!t.listed) revert ToolNotListed();
        if (t.owner == msg.sender) revert CannotBorrowOwnTool();
        if (days_ == 0 || days_ > MAX_LOAN_DAYS) revert BadLoanLength();

        loanId = ++loanCount;
        Loan storage l = _loans[loanId];
        l.id = loanId;
        l.toolId = toolId;
        l.borrower = msg.sender;
        l.toolOwner = t.owner;
        l.deposit = t.deposit;
        l.dailyLateFee = t.dailyLateFee;
        l.requestedDays = days_;
        l.requestedAt = uint64(block.timestamp);
        l.status = LoanStatus.Pending;

        _loansBorrowed[msg.sender].push(loanId);
        _loansOfTool[toolId].push(loanId);

        usdc.safeTransferFrom(msg.sender, address(this), t.deposit);
        emit LoanRequested(loanId, toolId, msg.sender, days_, t.deposit);
    }

    /// @notice Borrower pulls a request that has not been approved yet.
    function cancelRequest(uint64 loanId) external nonReentrant {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Pending) revert WrongStatus();
        if (l.borrower != msg.sender) revert NotBorrower();
        l.status = LoanStatus.Cancelled;
        l.settledAt = uint64(block.timestamp);
        usdc.safeTransfer(l.borrower, l.deposit);
        emit LoanCancelled(loanId, l.toolId);
    }

    /// @notice Owner turns a request down and the deposit goes straight back.
    function declineRequest(uint64 loanId) external nonReentrant {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Pending) revert WrongStatus();
        if (l.toolOwner != msg.sender) revert NotToolOwner();
        l.status = LoanStatus.Declined;
        l.settledAt = uint64(block.timestamp);
        usdc.safeTransfer(l.borrower, l.deposit);
        emit LoanDeclined(loanId, l.toolId);
    }

    /// @notice Owner hands the tool over. The clock starts now, not when the request was made.
    function approveRequest(uint64 loanId) external {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Pending) revert WrongStatus();
        if (l.toolOwner != msg.sender) revert NotToolOwner();
        Tool storage t = _tools[l.toolId];
        if (t.activeLoanId != 0) revert ToolIsOut();
        _requireMember(l.borrower);

        l.status = LoanStatus.Active;
        l.startedAt = uint64(block.timestamp);
        l.dueAt = uint64(block.timestamp) + uint64(l.requestedDays) * 1 days;
        t.activeLoanId = loanId;
        emit LoanApproved(loanId, l.toolId, l.dueAt);
    }

    /// @notice Borrower says the tool is back. This freezes the late-fee clock at this moment even if the
    ///         owner takes a few days to confirm.
    function reportReturn(uint64 loanId) external {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Active) revert WrongStatus();
        if (l.borrower != msg.sender) revert NotBorrower();
        if (l.returnReportedAt != 0) revert ReturnAlreadyReported();
        l.returnReportedAt = uint64(block.timestamp);
        emit ReturnReported(loanId, l.returnReportedAt);
    }

    /// @notice Owner confirms the tool is back and the deposit is split.
    function confirmReturn(uint64 loanId) external nonReentrant {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Active) revert WrongStatus();
        if (l.toolOwner != msg.sender) revert NotToolOwner();
        uint64 returnedAt = l.returnReportedAt == 0 ? uint64(block.timestamp) : l.returnReportedAt;
        _settle(l, returnedAt);
    }

    /// @notice Borrower closes out a return the owner never got round to confirming.
    function finalizeReportedReturn(uint64 loanId) external nonReentrant {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Active) revert WrongStatus();
        if (l.borrower != msg.sender) revert NotBorrower();
        if (l.returnReportedAt == 0) revert NoReturnReported();
        if (block.timestamp < l.returnReportedAt + CONFIRMATION_WINDOW) revert TooEarly();
        _settle(l, l.returnReportedAt);
    }

    /// @notice Owner writes the tool off once it is DEFAULT_WINDOW past due with no return reported. The whole
    ///         deposit goes to the owner and the borrower's record takes a default.
    function claimDefault(uint64 loanId) external nonReentrant {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Active) revert WrongStatus();
        if (l.toolOwner != msg.sender) revert NotToolOwner();
        if (l.returnReportedAt != 0) revert ReturnAlreadyReported();
        if (block.timestamp < l.dueAt + DEFAULT_WINDOW) revert TooEarly();

        l.status = LoanStatus.Defaulted;
        l.settledAt = uint64(block.timestamp);
        l.lateFeePaid = l.deposit;
        l.lateDays = _lateDays(l.dueAt, uint64(block.timestamp));
        _tools[l.toolId].activeLoanId = 0;

        usdc.safeTransfer(l.toolOwner, l.deposit);
        registry.recordDefault(l.borrower, l.toolOwner);
        emit LoanDefaulted(loanId, l.toolId, l.borrower, l.deposit);
    }

    /// @notice Escape hatch for the association steward when the two sides disagree about a return.
    /// @param toOwner How much of the deposit the owner keeps; the rest goes back to the borrower.
    /// @param countedLate Whether this counts as a late return on the borrower's record.
    function settleDispute(uint64 loanId, uint96 toOwner, bool countedLate) external nonReentrant {
        if (msg.sender != registry.steward()) revert NotSteward();
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Active) revert WrongStatus();
        if (toOwner > l.deposit) revert AmountTooHigh();

        uint96 refund = l.deposit - toOwner;
        l.status = LoanStatus.Settled;
        l.settledAt = uint64(block.timestamp);
        l.lateFeePaid = toOwner;
        l.lateDays = countedLate ? _lateDays(l.dueAt, uint64(block.timestamp)) : 0;
        _tools[l.toolId].activeLoanId = 0;

        if (toOwner > 0) usdc.safeTransfer(l.toolOwner, toOwner);
        if (refund > 0) usdc.safeTransfer(l.borrower, refund);
        registry.recordSettledLoan(l.borrower, l.toolOwner, countedLate);
        emit DisputeSettled(loanId, toOwner, refund, countedLate);
        emit LoanSettled(loanId, l.toolId, l.borrower, l.lateDays, toOwner, refund);
    }

    function _settle(Loan storage l, uint64 returnedAt) internal {
        uint32 lateDays = _lateDays(l.dueAt, returnedAt);
        uint256 fee = uint256(lateDays) * uint256(l.dailyLateFee);
        if (fee > l.deposit) fee = l.deposit; // the deposit is the cap: never more than was put down
        // forge-lint: disable-next-line(unsafe-typecast) - capped at l.deposit above
        uint96 lateFee = uint96(fee);
        uint96 refund = l.deposit - lateFee;

        l.status = LoanStatus.Settled;
        l.settledAt = uint64(block.timestamp);
        l.lateDays = lateDays;
        l.lateFeePaid = lateFee;
        _tools[l.toolId].activeLoanId = 0;

        if (lateFee > 0) usdc.safeTransfer(l.toolOwner, lateFee);
        if (refund > 0) usdc.safeTransfer(l.borrower, refund);
        registry.recordSettledLoan(l.borrower, l.toolOwner, lateDays > 0);
        emit LoanSettled(l.id, l.toolId, l.borrower, lateDays, lateFee, refund);
    }

    /// @dev Any part of a day past the due date counts as a whole late day.
    function _lateDays(uint64 dueAt, uint64 returnedAt) internal pure returns (uint32) {
        if (returnedAt <= dueAt) return 0;
        return uint32((returnedAt - dueAt + 1 days - 1) / 1 days);
    }

    // --- views -----------------------------------------------------------------

    /// @notice Late fee a loan would pay if it were settled right now.
    function accruedLateFee(uint64 loanId) external view returns (uint96) {
        Loan storage l = _loans[loanId];
        if (l.status != LoanStatus.Active) return l.lateFeePaid;
        uint64 at = l.returnReportedAt == 0 ? uint64(block.timestamp) : l.returnReportedAt;
        uint256 fee = uint256(_lateDays(l.dueAt, at)) * uint256(l.dailyLateFee);
        // forge-lint: disable-next-line(unsafe-typecast) - the ternary keeps fee <= l.deposit
        return fee > l.deposit ? l.deposit : uint96(fee);
    }

    function getTool(uint64 toolId) external view returns (Tool memory) {
        return _tools[toolId];
    }

    function getLoan(uint64 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    /// @notice Page through every tool. Tool ids start at 1, so `offset` 0 returns tool 1 first.
    function getTools(uint64 offset, uint64 limit) external view returns (Tool[] memory page) {
        uint64 total = toolCount;
        if (offset >= total) return new Tool[](0);
        uint64 end = offset + limit;
        if (end > total) end = total;
        page = new Tool[](end - offset);
        for (uint64 i = 0; i < page.length; i++) {
            page[i] = _tools[offset + i + 1];
        }
    }

    function getLoans(uint64 offset, uint64 limit) external view returns (Loan[] memory page) {
        uint64 total = loanCount;
        if (offset >= total) return new Loan[](0);
        uint64 end = offset + limit;
        if (end > total) end = total;
        page = new Loan[](end - offset);
        for (uint64 i = 0; i < page.length; i++) {
            page[i] = _loans[offset + i + 1];
        }
    }

    function toolIdsOfOwner(address owner) external view returns (uint64[] memory) {
        return _toolsOf[owner];
    }

    function loanIdsOfBorrower(address borrower) external view returns (uint64[] memory) {
        return _loansBorrowed[borrower];
    }

    function loanIdsOfTool(uint64 toolId) external view returns (uint64[] memory) {
        return _loansOfTool[toolId];
    }
}
