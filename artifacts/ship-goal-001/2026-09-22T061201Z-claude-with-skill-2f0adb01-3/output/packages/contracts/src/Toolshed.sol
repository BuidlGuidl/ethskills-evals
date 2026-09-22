// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title Toolshed
 * @notice A lending library for a neighborhood association. Members list tools they own,
 *         other members borrow them against a USDC deposit held in escrow by this contract.
 *         Returning on time refunds the whole deposit. Returning late pays the owner a daily
 *         late fee out of the deposit; the borrower gets the rest back.
 *
 * @dev Design notes
 *      - Escrow currency is a single fixed ERC-20 (USDC on the deployed chain). All amounts are
 *        in that token's smallest unit, so 6 decimals for USDC: 25_000_000 == 25 USDC. The
 *        contract never assumes 18 decimals and never converts.
 *      - Only the deposit, the late-fee split and the track-record counters live onchain. Photos,
 *        titles and condition notes live offchain (IPFS) behind `Tool.metadataURI`; browse
 *        ordering and reputation scoring are computed by the frontend from the onchain counters.
 *      - Every open state has someone who can close it and a reason to bother, plus a fallback
 *        for when they don't: `confirmReturn`, `settleUnconfirmed`, `claimUnreturned`,
 *        `expireRequest`, and the steward's `resolveLoan` as the last resort.
 *      - Payouts are push-with-credit-fallback (`_pay`). USDC can freeze an address; if a
 *        transfer to one party fails, their share is credited for a later `withdrawCredits`
 *        rather than reverting the settlement and pinning the other party's money as well.
 *      - The steward (contract owner) admits members, resolves disputes and can pause new
 *        activity. A steward who is a party to a loan cannot adjudicate it, and no path moves
 *        escrow to the steward as steward.
 *      - Assumes a plain, non-rebasing, non-fee-on-transfer token. USDC satisfies this.
 */
contract Toolshed is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --------------------------------------------------------------------- types

    enum LoanStatus {
        None,
        /// Borrower asked and funded the deposit; waiting on the tool owner.
        Requested,
        /// Owner approved and handed the tool over; the clock is running.
        Active,
        /// Borrower says they handed it back; waiting on the owner to confirm.
        ReturnPending,
        /// Borrower withdrew the request before the owner acted.
        Withdrawn,
        /// Owner (or steward) turned the request down.
        Declined,
        /// Closed: deposit split between borrower and owner.
        Settled,
        /// Owner says the tool is not actually back. Late fees keep running.
        Disputed,
        /// Request went stale before the owner acted; deposit refunded.
        Expired
    }

    struct Tool {
        address owner;
        /// Deposit a borrower must put up, in escrow-token units.
        uint96 deposit;
        /// Charged to the borrower per late day, in escrow-token units.
        uint96 dailyLateFee;
        /// Longest loan the owner will approve, in days.
        uint16 maxLoanDays;
        /// Owner can hide a tool from browse without deleting its history.
        bool listed;
        /// Non-zero while a loan of this tool is open past the request stage.
        uint64 activeLoanId;
        /// IPFS (or https) URI of the tool's JSON metadata: name, condition notes, photo.
        string metadataURI;
    }

    struct Loan {
        uint64 toolId;
        address borrower;
        LoanStatus status;
        uint16 loanDays;
        uint64 requestedAt;
        /// Set when the owner approves.
        uint64 startedAt;
        /// startedAt + loanDays; late fees accrue after this.
        uint64 dueAt;
        /// When the borrower reported the return; cleared if the owner disputes it.
        uint64 returnedAt;
        uint64 settledAt;
        /// Terms snapshotted at request time, so later edits to the tool cannot change them.
        uint96 deposit;
        uint96 dailyLateFee;
        /// Filled in at settlement.
        uint96 lateFeePaid;
        uint32 lateDays;
    }

    struct Member {
        bool active;
        uint64 joinedAt;
        /// Loans this member took out and closed, as borrower.
        uint32 loansTaken;
        /// Of those, how many came back after the due date.
        uint32 lateReturns;
        /// Of those, how many never came back at all.
        uint32 unreturned;
        /// Loans this member handed out, as tool owner.
        uint32 loansGiven;
    }

    // ------------------------------------------------------------------- storage

    /// @notice Escrow token. USDC on the chain this is deployed to.
    IERC20 public immutable escrowToken;

    /// @notice How long the tool owner has to confirm or dispute a return the borrower reported
    ///         before the borrower may close the loan themselves, at the reported return date.
    uint64 public constant CONFIRM_WINDOW = 3 days;

    /// @notice A request the owner never answered goes stale and can no longer be approved.
    ///         Nobody should be handed a tool against terms they agreed to months ago.
    uint64 public constant REQUEST_TTL = 7 days;

    /// @notice Once a loan is this far overdue the owner may write the tool off, even if the
    ///         daily fee would never have added up to the whole deposit.
    uint64 public constant MAX_OVERDUE = 30 days;

    /// @notice Ceiling on any tool's deposit, so a typo cannot lock an unreasonable sum.
    uint96 public maxDeposit;

    /// @notice When paused, no new tools, requests or approvals. Settlement always stays open.
    bool public paused;

    /// @notice Deposits currently held for open loans. The contract's token balance should never
    ///         drop below `totalEscrowed + totalCredited`.
    uint96 public totalEscrowed;

    /// @notice Payouts that could not be pushed (e.g. a frozen USDC address), awaiting a pull.
    uint96 public totalCredited;

    /// @notice Per-address unclaimed payouts. See `withdrawCredits`.
    mapping(address => uint96) public credits;

    mapping(address => Member) private _members;

    /// @notice Members currently able to list and borrow. Suspending one decrements it.
    uint32 public memberCount;

    /// @dev Ids are 1-based; index 0 of each array is a burned sentinel.
    Tool[] private _tools;
    Loan[] private _loans;

    /// @dev Kept onchain so the frontend can render "my tools" / "my loans" and an owner's
    ///      request queue with plain contract reads, no indexer required at this size.
    mapping(address => uint64[]) private _toolsOfOwner;
    mapping(address => uint64[]) private _loansOfBorrower;
    mapping(uint64 => uint64[]) private _loansOfTool;

    // -------------------------------------------------------------------- events

    event MemberAdmitted(address indexed member);
    event MemberSuspended(address indexed member);
    event MemberReinstated(address indexed member);
    event MaxDepositSet(uint96 maxDeposit);
    event PausedSet(bool paused);
    event StrayTokensSwept(address indexed to, uint256 amount);

    event ToolListed(
        uint64 indexed toolId,
        address indexed owner,
        uint96 deposit,
        uint96 dailyLateFee,
        uint16 maxLoanDays,
        string metadataURI
    );
    event ToolUpdated(
        uint64 indexed toolId, uint96 deposit, uint96 dailyLateFee, uint16 maxLoanDays, string metadataURI
    );
    event ToolVisibilitySet(uint64 indexed toolId, bool listed);

    event LoanRequested(
        uint64 indexed loanId, uint64 indexed toolId, address indexed borrower, uint16 loanDays, uint96 deposit
    );
    event LoanRequestWithdrawn(uint64 indexed loanId, uint64 indexed toolId, address indexed borrower);
    event LoanRequestDeclined(uint64 indexed loanId, uint64 indexed toolId, address indexed borrower);
    event LoanRequestExpired(uint64 indexed loanId, uint64 indexed toolId, address indexed borrower);
    event LoanApproved(uint64 indexed loanId, uint64 indexed toolId, address indexed borrower, uint64 dueAt);
    event ReturnReported(uint64 indexed loanId, uint64 indexed toolId, uint64 returnedAt);
    event ReturnDisputed(uint64 indexed loanId, uint64 indexed toolId, address indexed borrower);
    event LoanSettled(
        uint64 indexed loanId,
        uint64 indexed toolId,
        address indexed borrower,
        uint96 lateFeeToOwner,
        uint96 refundToBorrower,
        uint32 lateDays,
        bool unreturned
    );

    event PaymentCredited(address indexed to, uint96 amount);
    event CreditsWithdrawn(address indexed to, uint96 amount);

    // -------------------------------------------------------------------- errors

    error NotAMember(address who);
    error AlreadyAMember(address who);
    error NotToolOwner(uint64 toolId);
    error NotBorrower(uint64 loanId);
    error NoSuchTool(uint64 toolId);
    error NoSuchLoan(uint64 loanId);
    error ToolNotListed(uint64 toolId);
    error ToolUnavailable(uint64 toolId);
    error CannotBorrowOwnTool(uint64 toolId);
    error WrongLoanStatus(uint64 loanId, LoanStatus status);
    error InvalidLoanDays(uint16 loanDays, uint16 maxLoanDays);
    error DepositTooLarge(uint96 deposit, uint96 limit);
    error ZeroDeposit();
    error ZeroLateFee();
    error EmptyMetadata();
    error ConfirmWindowOpen(uint64 openUntil);
    error RequestExpired(uint64 expiredAt);
    error RequestStillFresh(uint64 expiresAt);
    error NotWriteOffableYet(uint96 accrued, uint96 deposit, uint64 claimableAt);
    error FeeExceedsDeposit(uint96 fee, uint96 deposit);
    error StewardIsAParty(uint64 loanId);
    error NothingToWithdraw();
    error NothingToSweep();
    error ContractPaused();
    error ZeroAddress();
    error OwnershipCannotBeRenounced();

    // ----------------------------------------------------------------- modifiers

    modifier onlyMember() {
        if (!_members[msg.sender].active) revert NotAMember(msg.sender);
        _;
    }

    modifier notPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // --------------------------------------------------------------- constructor

    /**
     * @param escrowToken_ The deposit currency, e.g. USDC on Base.
     * @param steward The association's admin account: admits members, resolves disputes.
     *                Should be a multisig in production.
     * @param maxDeposit_ Ceiling on a tool's deposit, in escrow-token units.
     */
    constructor(IERC20 escrowToken_, address steward, uint96 maxDeposit_) Ownable(steward) {
        if (address(escrowToken_) == address(0) || steward == address(0)) revert ZeroAddress();
        escrowToken = escrowToken_;
        maxDeposit = maxDeposit_;
        emit MaxDepositSet(maxDeposit_);

        // Burn index 0 in both arrays so that id 0 can mean "none".
        _tools.push();
        _loans.push();
    }

    // ------------------------------------------------------------- steward admin

    /// @notice Admit a neighbour to the association. Only members can list or borrow.
    function admitMember(address member) external onlyOwner {
        _admit(member);
        memberCount += 1;
    }

    /// @notice Admit several neighbours in one transaction (onboarding the initial roster).
    ///         The roster counter is written once rather than once per neighbour.
    function admitMembers(address[] calldata members) external onlyOwner {
        for (uint256 i; i < members.length; ++i) {
            _admit(members[i]);
        }
        memberCount += uint32(members.length);
    }

    function _admit(address member) private {
        if (member == address(0)) revert ZeroAddress();
        Member storage m = _members[member];
        if (m.active) revert AlreadyAMember(member);
        m.active = true;
        if (m.joinedAt == 0) {
            m.joinedAt = uint64(block.timestamp);
            emit MemberAdmitted(member);
        } else {
            emit MemberReinstated(member);
        }
    }

    /**
     * @notice Suspend a member. They can no longer list, borrow, or approve requests on their
     *         own tools, and nobody can start a new loan of a tool they own. Loans already
     *         running still settle and refund normally — suspension never strands escrowed money.
     */
    function suspendMember(address member) external onlyOwner {
        if (!_members[member].active) revert NotAMember(member);
        _members[member].active = false;
        memberCount -= 1;
        emit MemberSuspended(member);
    }

    function setMaxDeposit(uint96 maxDeposit_) external onlyOwner {
        maxDeposit = maxDeposit_;
        emit MaxDepositSet(maxDeposit_);
    }

    /// @notice Emergency stop for new activity. Never blocks settlement of an existing loan.
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    /**
     * @notice Recover tokens sent here by mistake — only the surplus over what the contract owes.
     *         Open deposits and unclaimed credits are unreachable by construction.
     */
    function sweepStrayTokens(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 owed = uint256(totalEscrowed) + uint256(totalCredited);
        uint256 balance = escrowToken.balanceOf(address(this));
        if (balance <= owed) revert NothingToSweep();
        uint256 surplus = balance - owed;
        emit StrayTokensSwept(to, surplus);
        escrowToken.safeTransfer(to, surplus);
    }

    /**
     * @notice Disabled. Renouncing would permanently remove the only party who can resolve a
     *         dispute, reinstate a member or unpause — worse than the risk it avoids. Hand the
     *         role over with `transferOwnership` (two-step) instead.
     */
    function renounceOwnership() public view override onlyOwner {
        revert OwnershipCannotBeRenounced();
    }

    // --------------------------------------------------------------------- tools

    /**
     * @notice List a tool you own.
     * @param metadataURI IPFS or https URI of the tool's JSON metadata (name, condition, photo).
     * @param deposit Deposit a borrower must escrow, in escrow-token units (USDC: 6 decimals).
     * @param dailyLateFee Charged to the borrower per late day, in escrow-token units.
     * @param maxLoanDays Longest loan you are willing to approve.
     * @return toolId The new tool's id.
     */
    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, uint16 maxLoanDays)
        external
        onlyMember
        notPaused
        returns (uint64 toolId)
    {
        _validateTerms(metadataURI, deposit, dailyLateFee, maxLoanDays);

        toolId = uint64(_tools.length);
        Tool storage t = _tools.push();
        t.owner = msg.sender;
        t.deposit = deposit;
        t.dailyLateFee = dailyLateFee;
        t.maxLoanDays = maxLoanDays;
        t.listed = true;
        t.metadataURI = metadataURI;

        _toolsOfOwner[msg.sender].push(toolId);
        emit ToolListed(toolId, msg.sender, deposit, dailyLateFee, maxLoanDays, metadataURI);
    }

    /// @notice Edit a tool's terms or metadata. Blocked while a loan of it is open, and existing
    ///         loans keep the terms they were requested under either way.
    function updateTool(
        uint64 toolId,
        string calldata metadataURI,
        uint96 deposit,
        uint96 dailyLateFee,
        uint16 maxLoanDays
    ) external notPaused {
        Tool storage t = _tool(toolId);
        if (t.owner != msg.sender) revert NotToolOwner(toolId);
        if (t.activeLoanId != 0) revert ToolUnavailable(toolId);
        _validateTerms(metadataURI, deposit, dailyLateFee, maxLoanDays);

        t.deposit = deposit;
        t.dailyLateFee = dailyLateFee;
        t.maxLoanDays = maxLoanDays;
        t.metadataURI = metadataURI;
        emit ToolUpdated(toolId, deposit, dailyLateFee, maxLoanDays, metadataURI);
    }

    /// @notice Show or hide a tool on the browse screen. Hiding does not cancel open requests;
    ///         decline those explicitly so the deposits go back.
    function setToolListed(uint64 toolId, bool listed) external {
        Tool storage t = _tool(toolId);
        if (t.owner != msg.sender) revert NotToolOwner(toolId);
        t.listed = listed;
        emit ToolVisibilitySet(toolId, listed);
    }

    function _validateTerms(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, uint16 maxLoanDays)
        private
        view
    {
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();
        if (deposit == 0) revert ZeroDeposit();
        if (deposit > maxDeposit) revert DepositTooLarge(deposit, maxDeposit);
        // A zero daily fee would disarm the mechanism: a tool that never comes back would cost
        // the borrower nothing. Lend generously by setting a small fee and forgiving it.
        if (dailyLateFee == 0) revert ZeroLateFee();
        // A late fee above the deposit is pointless: fees are capped at the deposit anyway.
        if (dailyLateFee > deposit) revert FeeExceedsDeposit(dailyLateFee, deposit);
        if (maxLoanDays == 0) revert InvalidLoanDays(0, maxLoanDays);
    }

    // --------------------------------------------------------------------- loans

    /**
     * @notice Ask to borrow a tool for `loanDays` days, escrowing the deposit now.
     *         Requires an ERC-20 allowance of at least the tool's deposit.
     *         The deposit sits in escrow while the owner decides; withdraw the request to get it
     *         back at any time before they approve.
     */
    function requestLoan(uint64 toolId, uint16 loanDays)
        external
        onlyMember
        notPaused
        nonReentrant
        returns (uint64 loanId)
    {
        Tool storage t = _tool(toolId);
        if (!t.listed) revert ToolNotListed(toolId);
        if (t.activeLoanId != 0) revert ToolUnavailable(toolId);
        if (t.owner == msg.sender) revert CannotBorrowOwnTool(toolId);
        // A suspended member's tools are out of circulation, whether or not they hid them.
        if (!_members[t.owner].active) revert NotAMember(t.owner);
        if (loanDays == 0 || loanDays > t.maxLoanDays) revert InvalidLoanDays(loanDays, t.maxLoanDays);

        uint96 deposit = t.deposit;
        loanId = uint64(_loans.length);
        Loan storage l = _loans.push();
        l.toolId = toolId;
        l.borrower = msg.sender;
        l.status = LoanStatus.Requested;
        l.loanDays = loanDays;
        l.requestedAt = uint64(block.timestamp);
        l.deposit = deposit;
        l.dailyLateFee = t.dailyLateFee;

        _loansOfBorrower[msg.sender].push(loanId);
        _loansOfTool[toolId].push(loanId);
        totalEscrowed += deposit;
        emit LoanRequested(loanId, toolId, msg.sender, loanDays, deposit);

        escrowToken.safeTransferFrom(msg.sender, address(this), deposit);
    }

    /// @notice Withdraw your own pending request and take the deposit back.
    function withdrawRequest(uint64 loanId) external nonReentrant {
        Loan storage l = _loan(loanId);
        if (l.borrower != msg.sender) revert NotBorrower(loanId);
        if (l.status != LoanStatus.Requested) revert WrongLoanStatus(loanId, l.status);

        emit LoanRequestWithdrawn(loanId, l.toolId, l.borrower);
        _closeRequest(l, LoanStatus.Withdrawn);
    }

    /// @notice Turn a request down (tool owner, or the steward on their behalf). Refunds in full.
    function declineRequest(uint64 loanId) external nonReentrant {
        Loan storage l = _loan(loanId);
        Tool storage t = _tools[l.toolId];
        if (t.owner != msg.sender && msg.sender != owner()) revert NotToolOwner(l.toolId);
        if (l.status != LoanStatus.Requested) revert WrongLoanStatus(loanId, l.status);

        emit LoanRequestDeclined(loanId, l.toolId, l.borrower);
        _closeRequest(l, LoanStatus.Declined);
    }

    /**
     * @notice Refund a request nobody ever answered. Callable by anyone once the request is older
     *         than `REQUEST_TTL`, so a deposit cannot sit in limbo behind an owner who simply
     *         stopped opening the app — and so a months-old request cannot be sprung on a
     *         borrower by a late approval.
     */
    function expireRequest(uint64 loanId) external nonReentrant {
        Loan storage l = _loan(loanId);
        if (l.status != LoanStatus.Requested) revert WrongLoanStatus(loanId, l.status);
        uint64 expiresAt = l.requestedAt + REQUEST_TTL;
        if (block.timestamp <= expiresAt) revert RequestStillFresh(expiresAt);

        emit LoanRequestExpired(loanId, l.toolId, l.borrower);
        _closeRequest(l, LoanStatus.Expired);
    }

    /// @dev Closes a request without touching any track record, and refunds the deposit.
    function _closeRequest(Loan storage l, LoanStatus status) private {
        l.status = status;
        l.settledAt = uint64(block.timestamp);
        uint96 deposit = l.deposit;
        totalEscrowed -= deposit;
        _pay(l.borrower, deposit);
    }

    /**
     * @notice Approve a request and start the clock: you are handing the tool over now.
     *         The due date is `loanDays` days from this moment. Requests older than
     *         `REQUEST_TTL` can no longer be approved — ask for a fresh one.
     */
    function approveRequest(uint64 loanId) external onlyMember notPaused {
        Loan storage l = _loan(loanId);
        uint64 toolId = l.toolId;
        Tool storage t = _tools[toolId];
        if (t.owner != msg.sender) revert NotToolOwner(toolId);
        if (l.status != LoanStatus.Requested) revert WrongLoanStatus(loanId, l.status);
        if (t.activeLoanId != 0) revert ToolUnavailable(toolId);

        uint64 expiresAt = l.requestedAt + REQUEST_TTL;
        if (block.timestamp > expiresAt) revert RequestExpired(expiresAt);

        uint64 dueAt = uint64(block.timestamp) + uint64(l.loanDays) * 1 days;
        l.status = LoanStatus.Active;
        l.startedAt = uint64(block.timestamp);
        l.dueAt = dueAt;
        t.activeLoanId = loanId;

        emit LoanApproved(loanId, toolId, l.borrower, dueAt);
    }

    /**
     * @notice Borrower: report that you have handed the tool back. This freezes late-fee accrual
     *         at this moment and gives the owner `CONFIRM_WINDOW` to confirm or dispute; after
     *         that you can close the loan yourself with `settleUnconfirmed`.
     */
    function reportReturn(uint64 loanId) external {
        Loan storage l = _loan(loanId);
        if (l.borrower != msg.sender) revert NotBorrower(loanId);
        if (l.status != LoanStatus.Active) revert WrongLoanStatus(loanId, l.status);

        l.status = LoanStatus.ReturnPending;
        l.returnedAt = uint64(block.timestamp);
        emit ReturnReported(loanId, l.toolId, l.returnedAt);
    }

    /**
     * @notice Tool owner: the tool is not actually back. Undoes the borrower's report — fees
     *         resume accruing from the original due date and the borrower can no longer close
     *         the loan on their own word. From here the tool turning up ends it (`confirmReturn`),
     *         or the steward splits the deposit, or it is written off as never returned.
     */
    function disputeReturn(uint64 loanId) external {
        Loan storage l = _loan(loanId);
        Tool storage t = _tools[l.toolId];
        if (t.owner != msg.sender) revert NotToolOwner(l.toolId);
        if (l.status != LoanStatus.ReturnPending) revert WrongLoanStatus(loanId, l.status);

        l.status = LoanStatus.Disputed;
        l.returnedAt = 0;
        emit ReturnDisputed(loanId, l.toolId, l.borrower);
    }

    /**
     * @notice Tool owner: confirm the tool is back and close the loan. Any late fee is paid to
     *         you out of the deposit (capped at the deposit) and the rest goes back to the
     *         borrower. Works whether or not the borrower reported the return; if they did, fees
     *         stop at the moment they reported, which is what keeps this honest for both sides.
     */
    function confirmReturn(uint64 loanId) external nonReentrant {
        Loan storage l = _loan(loanId);
        Tool storage t = _tools[l.toolId];
        if (t.owner != msg.sender) revert NotToolOwner(l.toolId);
        if (!_isOpenLoan(l.status)) revert WrongLoanStatus(loanId, l.status);

        uint64 returnTime = l.status == LoanStatus.ReturnPending ? l.returnedAt : uint64(block.timestamp);
        (uint32 lateDays, uint96 fee) = _lateFeeAt(l, returnTime);
        _settle(loanId, l, t, returnTime, lateDays, lateDays > 0, fee, false);
    }

    /**
     * @notice Borrower: close a loan the owner never got around to confirming. Only after the
     *         confirm window has passed, and only if they did not dispute your return. Late fees
     *         are computed up to the return you reported, so an absent owner cannot hold your
     *         deposit hostage while fees pile up.
     */
    function settleUnconfirmed(uint64 loanId) external nonReentrant {
        Loan storage l = _loan(loanId);
        if (l.borrower != msg.sender) revert NotBorrower(loanId);
        if (l.status != LoanStatus.ReturnPending) revert WrongLoanStatus(loanId, l.status);

        uint64 openUntil = l.returnedAt + CONFIRM_WINDOW;
        if (block.timestamp < openUntil) revert ConfirmWindowOpen(openUntil);

        (uint32 lateDays, uint96 fee) = _lateFeeAt(l, l.returnedAt);
        _settle(loanId, l, _tools[l.toolId], l.returnedAt, lateDays, lateDays > 0, fee, false);
    }

    /**
     * @notice Tool owner: write off a tool that never came back. Callable once late fees have
     *         eaten the whole deposit — the point at which the borrower has no financial reason
     *         left to bring it back — or once the loan is `MAX_OVERDUE` past due, whichever comes
     *         first. The full deposit goes to you and the loan is recorded against the borrower
     *         as an unreturned tool.
     */
    function claimUnreturned(uint64 loanId) external nonReentrant {
        Loan storage l = _loan(loanId);
        Tool storage t = _tools[l.toolId];
        if (t.owner != msg.sender) revert NotToolOwner(l.toolId);
        if (l.status != LoanStatus.Active && l.status != LoanStatus.Disputed) {
            revert WrongLoanStatus(loanId, l.status);
        }

        (uint32 lateDays, uint96 fee) = _lateFeeAt(l, uint64(block.timestamp));
        uint64 claimableAt = l.dueAt + MAX_OVERDUE;
        if (fee < l.deposit && block.timestamp <= claimableAt) {
            revert NotWriteOffableYet(fee, l.deposit, claimableAt);
        }

        t.listed = false;
        emit ToolVisibilitySet(l.toolId, false);
        _settle(loanId, l, t, uint64(block.timestamp), lateDays, true, l.deposit, true);
    }

    /**
     * @notice Steward: resolve a disputed loan by splitting the deposit. Use when the two
     *         neighbours disagree (tool came back broken, owner says it never arrived, a late
     *         return everyone agrees to forgive). The steward chooses only the split of this
     *         loan's own deposit — no more than the deposit, nothing to the steward — and cannot
     *         adjudicate a loan they are themselves a party to.
     * @param lateFeeToOwner Portion of the deposit paid to the tool owner; the rest is refunded.
     * @param countLate Whether this counts as a late return on the borrower's track record.
     * @param markUnreturned Whether the tool is being written off as never returned.
     */
    function resolveLoan(uint64 loanId, uint96 lateFeeToOwner, bool countLate, bool markUnreturned)
        external
        onlyOwner
        nonReentrant
    {
        Loan storage l = _loan(loanId);
        Tool storage t = _tools[l.toolId];
        if (!_isOpenLoan(l.status)) revert WrongLoanStatus(loanId, l.status);
        if (lateFeeToOwner > l.deposit) revert FeeExceedsDeposit(lateFeeToOwner, l.deposit);
        // A steward who is the borrower or the tool owner here is a party, not a judge.
        if (t.owner == msg.sender || l.borrower == msg.sender) revert StewardIsAParty(loanId);

        uint64 returnTime = l.returnedAt == 0 ? uint64(block.timestamp) : l.returnedAt;
        (uint32 lateDays,) = _lateFeeAt(l, returnTime);
        _settle(loanId, l, t, returnTime, lateDays, countLate, lateFeeToOwner, markUnreturned);
    }

    /**
     * @notice Claim a payout that could not be sent to you automatically. That only happens if
     *         the escrow token refused the transfer — a frozen USDC address, for instance.
     */
    function withdrawCredits() external nonReentrant {
        uint96 amount = credits[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        credits[msg.sender] = 0;
        totalCredited -= amount;
        emit CreditsWithdrawn(msg.sender, amount);
        escrowToken.safeTransfer(msg.sender, amount);
    }

    /// @dev Statuses where the tool is out and the deposit is still in escrow.
    function _isOpenLoan(LoanStatus status) private pure returns (bool) {
        return status == LoanStatus.Active || status == LoanStatus.ReturnPending || status == LoanStatus.Disputed;
    }

    /// @dev Closes a loan: writes final state and track record, then moves the money (CEI).
    function _settle(
        uint64 loanId,
        Loan storage l,
        Tool storage t,
        uint64 returnTime,
        uint32 lateDays,
        bool countLate,
        uint96 fee,
        bool unreturned
    ) private {
        address borrower = l.borrower;
        address toolOwner = t.owner;
        uint96 deposit = l.deposit;
        uint96 refund = deposit - fee;

        l.status = LoanStatus.Settled;
        l.returnedAt = returnTime;
        l.settledAt = uint64(block.timestamp);
        l.lateFeePaid = fee;
        l.lateDays = lateDays;
        t.activeLoanId = 0;

        Member storage b = _members[borrower];
        b.loansTaken += 1;
        if (countLate) b.lateReturns += 1;
        if (unreturned) b.unreturned += 1;
        _members[toolOwner].loansGiven += 1;

        totalEscrowed -= deposit;
        emit LoanSettled(loanId, l.toolId, borrower, fee, refund, lateDays, unreturned);

        _pay(toolOwner, fee);
        _pay(borrower, refund);
    }

    /**
     * @dev Pays `to`, or credits them if the token refuses. USDC can freeze an address; without
     *      this fallback one frozen neighbour would pin the other party's money in escrow too.
     */
    function _pay(address to, uint96 amount) private {
        if (amount == 0) return;
        (bool ok, bytes memory data) = address(escrowToken).call(abi.encodeCall(IERC20.transfer, (to, uint256(amount))));
        if (ok && (data.length == 0 || abi.decode(data, (bool)))) return;

        credits[to] += amount;
        totalCredited += amount;
        emit PaymentCredited(to, amount);
    }

    /**
     * @dev Late fee for a loan at `at`. Any part of a day counts as a whole late day (a tool
     *      handed back 25 hours late owes two days), and the total is capped at the deposit, so
     *      a borrower's worst case is always exactly the deposit they put up.
     */
    function _lateFeeAt(Loan storage l, uint64 at) private view returns (uint32 lateDays, uint96 fee) {
        if (at <= l.dueAt) return (0, 0);
        uint256 overdue = uint256(at) - uint256(l.dueAt);
        uint256 days_ = (overdue + 1 days - 1) / 1 days; // ceiling
        uint256 accrued = days_ * uint256(l.dailyLateFee);
        if (accrued > l.deposit) accrued = l.deposit;
        // days_ is clamped for the counter's sake only; accrued is already capped at the
        // deposit, which is a uint96, so that cast cannot truncate.
        if (days_ > type(uint32).max) days_ = type(uint32).max;
        return (uint32(days_), uint96(accrued));
    }

    // --------------------------------------------------------------------- views

    /// @notice Late fee a loan would pay if it were settled right now.
    function accruedLateFee(uint64 loanId) external view returns (uint32 lateDays, uint96 fee) {
        Loan storage l = _loan(loanId);
        if (l.status == LoanStatus.ReturnPending) return _lateFeeAt(l, l.returnedAt);
        if (l.status != LoanStatus.Active && l.status != LoanStatus.Disputed) {
            return (l.lateDays, l.lateFeePaid);
        }
        return _lateFeeAt(l, uint64(block.timestamp));
    }

    function isMember(address who) external view returns (bool) {
        return _members[who].active;
    }

    function getMember(address who) external view returns (Member memory) {
        return _members[who];
    }

    /// @notice Batch read of track records, for sorting a browse screen or a request queue.
    function getMembers(address[] calldata who) external view returns (Member[] memory out) {
        out = new Member[](who.length);
        for (uint256 i; i < who.length; ++i) {
            out[i] = _members[who[i]];
        }
    }

    /// @notice Number of tools ever listed (ids run 1..toolCount).
    function toolCount() external view returns (uint256) {
        return _tools.length - 1;
    }

    /// @notice Number of loans ever requested (ids run 1..loanCount).
    function loanCount() external view returns (uint256) {
        return _loans.length - 1;
    }

    function getTool(uint64 toolId) external view returns (Tool memory) {
        return _tool(toolId);
    }

    /// @notice Page through tools, newest ids last. `start` is a tool id (1-based). An oversized
    ///         `count` is clamped, so "give me everything" is a valid call rather than a revert.
    function getTools(uint64 start, uint64 count) external view returns (Tool[] memory out, uint64[] memory ids) {
        uint256 total = _tools.length;
        uint256 from = start == 0 ? 1 : start;
        if (from >= total || count == 0) return (new Tool[](0), new uint64[](0));

        uint256 end = from + uint256(count);
        if (end > total) end = total;

        uint256 n = end - from;
        out = new Tool[](n);
        ids = new uint64[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = uint64(from + i);
            out[i] = _tools[from + i];
        }
    }

    function getLoan(uint64 loanId) external view returns (Loan memory) {
        return _loan(loanId);
    }

    function getLoans(uint64[] calldata loanIds) external view returns (Loan[] memory out) {
        out = new Loan[](loanIds.length);
        for (uint256 i; i < loanIds.length; ++i) {
            out[i] = _loan(loanIds[i]);
        }
    }

    function toolsOfOwner(address who) external view returns (uint64[] memory) {
        return _toolsOfOwner[who];
    }

    function loansOfBorrower(address who) external view returns (uint64[] memory) {
        return _loansOfBorrower[who];
    }

    function loansOfTool(uint64 toolId) external view returns (uint64[] memory) {
        return _loansOfTool[toolId];
    }

    function _tool(uint64 toolId) private view returns (Tool storage) {
        if (toolId == 0 || toolId >= _tools.length) revert NoSuchTool(toolId);
        return _tools[toolId];
    }

    function _loan(uint64 loanId) private view returns (Loan storage) {
        if (loanId == 0 || loanId >= _loans.length) revert NoSuchLoan(loanId);
        return _loans[loanId];
    }
}
