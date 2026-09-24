//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Toolshed
 * @notice A lending library for a neighborhood association. Members list tools they own, other
 *         members borrow them for a fixed number of days against a USDC deposit held in escrow by
 *         this contract. The deposit comes back on return; a per-day late fee is carved out of it
 *         and paid to the tool owner for every day (or part of a day) past the due date.
 *
 * @dev Design notes
 *
 *      What lives onchain: the escrowed money, the loan state machine, and the track record
 *      counters that the money mechanics produce. What does not: photos, condition notes and tool
 *      descriptions (IPFS, referenced by `metadataURI`), and all browsing/sorting/search, which the
 *      frontend does from events and the batched view functions at the bottom of this file.
 *
 *      Nothing is automatic. Every state transition below names a caller who has a reason to pay
 *      for it, and no path can strand an escrowed deposit:
 *
 *        Requested  --approveLoan(owner)------> Active
 *                   --declineLoan(owner)------> Closed (full refund)
 *                   --cancelRequest(borrower)-> Closed (full refund)
 *                   (a request that nobody answers simply expires and can be cancelled forever)
 *
 *        Active     --reportReturn(borrower)--> ReturnClaimed   (stops the late-fee clock)
 *                   --confirmReturn(owner)----> Closed          (settles, owner gets late fees)
 *                   --flagMissing(owner)------> Active          (an onchain accusation, on the record)
 *                   --claimDefault(anyone)----> Closed          (fees ate the deposit AND the owner
 *                                                                flagged it CONFIRM_WINDOW ago)
 *
 *        ReturnClaimed --confirmReturn(owner)-> Closed
 *                      --disputeReturn(owner)-> Disputed        (only inside CONFIRM_WINDOW)
 *                      --settleUnconfirmed(anyone, after CONFIRM_WINDOW)-> Closed
 *
 *        Disputed   --resolveDispute(steward)----------------------------> Closed
 *                   --settleStaleDispute(anyone, after DISPUTE_WINDOW)---> Closed (50/50)
 *
 *      Two rules keep either side from profiting by simply going quiet:
 *
 *      An owner cannot take a deposit by silence. Late fees alone never close a loan — the owner
 *      must first `flagMissing`, an accusation the borrower can see and rebut with `reportReturn`
 *      for CONFIRM_WINDOW before `claimDefault` becomes reachable. And a borrower is never stuck
 *      waiting on an owner: `reportReturn` is open for the whole life of an active loan, and
 *      CONFIRM_WINDOW later anyone can settle it.
 *
 *      A steward who never rules cannot be waited out either. `settleStaleDispute` splits the
 *      escrow down the middle rather than handing it to whichever party's timestamp the contract
 *      happens to trust, so stalling is unattractive to both sides and both prefer a real ruling.
 *
 *      The steward (the association's multisig) can only arbitrate a disputed loan, and only by
 *      splitting that loan's own escrow. It cannot touch any other deposit and cannot pause the
 *      contract.
 *
 *      USDC has 6 decimals. All amounts in this contract are raw USDC units (1_000000 == $1).
 */
contract Toolshed is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                  ROLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Can add/remove members and arbitrate disputed loans. Held by the association multisig.
    bytes32 public constant STEWARD_ROLE = keccak256("STEWARD_ROLE");
    /// @notice Can list tools and request loans. One per household in the association.
    bytes32 public constant MEMBER_ROLE = keccak256("MEMBER_ROLE");

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice A pending request an owner never answers stops being approvable after this long.
    uint64 public constant REQUEST_TTL = 7 days;
    /// @notice How long an owner has to confirm or dispute a reported return, and how long a
    ///         borrower has to answer a `flagMissing` accusation. A week, because the people on
    ///         both ends of this are volunteers who check the app when they remember to.
    uint64 public constant CONFIRM_WINDOW = 7 days;
    /// @notice How long the steward has to arbitrate before anyone may settle by the ordinary rule.
    uint64 public constant DISPUTE_WINDOW = 14 days;
    /// @notice Upper bound on a loan's length, also the cap on a tool's `maxDurationDays`.
    uint32 public constant MAX_DURATION_DAYS = 90;
    /// @notice Sanity cap on a deposit ($10,000). Keeps a fat-fingered listing from escrowing a fortune.
    uint96 public constant MAX_DEPOSIT = 10_000_000_000;
    /// @notice Floor on a deposit ($1). A deposit of dust is not a deposit; it is a way to run
    ///         costless loans back and forth with a friend to pad a track record.
    uint96 public constant MIN_DEPOSIT = 1_000000;
    /// @notice A daily fee may be at most a seventh of the deposit, so total forfeiture is always at
    ///         least a week away and a borrower who stops checking the app has time to notice.
    uint96 public constant MIN_DAYS_TO_FORFEIT = 7;
    /// @notice A borrower may have one open request per tool — no spamming an owner's queue.
    uint8 public constant MAX_OPEN_REQUESTS_PER_TOOL = 1;
    /// @notice How long late fees run on their own before the owner has to put their name to an
    ///         accusation. See `flagMissing`.
    uint64 public constant UNFLAGGED_FEE_GRACE = 7 days;

    /*//////////////////////////////////////////////////////////////
                                  TYPES
    //////////////////////////////////////////////////////////////*/

    enum LoanState {
        None,
        Requested,
        Active,
        ReturnClaimed,
        Disputed,
        Closed
    }

    enum Outcome {
        Pending,
        Cancelled, // request withdrawn by the borrower
        Declined, // request turned down by the owner
        OnTime,
        Late,
        Defaulted, // never came back, or came back so late the whole deposit was consumed
        Unresolved // disputed, and the steward never ruled: escrow split, nobody's record marked
    }

    struct Tool {
        address owner;
        uint96 deposit; // USDC held in escrow for the length of a loan
        uint96 dailyLateFee; // USDC per late day, paid to the owner out of the deposit
        uint32 maxDurationDays;
        bool listed; // owner can delist without deleting history
        uint64 activeLoanId; // 0 when the tool is on the shelf
        string metadataURI; // ipfs://... -> { name, description, condition, image }
    }

    struct Loan {
        uint64 toolId;
        address borrower;
        uint96 deposit; // terms are snapshotted at request time...
        uint96 dailyLateFee; // ...so an owner cannot change them under an active loan
        uint32 durationDays;
        uint64 requestedAt;
        uint64 startedAt;
        uint64 dueAt;
        uint64 returnedAt; // when the borrower says it came back; 0 until reported
        uint64 missingFlaggedAt; // when the owner put "it never came back" on the record; 0 if never
        LoanState state;
        Outcome outcome;
        uint96 feeToOwner; // filled in at settlement
        uint96 refundToBorrower;
    }

    /// @notice The track record the browse screen ranks people by.
    struct Record {
        uint32 loansBorrowed;
        uint32 lateReturns;
        uint32 defaults;
        uint32 loansLent;
        uint96 lateFeesPaid;
        uint96 lateFeesEarned;
    }

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The deposit token. Base mainnet USDC in production.
    IERC20 public immutable depositToken;

    uint64 public toolCount;
    uint64 public loanCount;

    mapping(uint64 toolId => Tool) private _tools;
    mapping(uint64 loanId => Loan) private _loans;
    mapping(address member => Record) private _records;

    mapping(address owner => uint64[] toolIds) private _toolsByOwner;
    mapping(uint64 toolId => uint64[] loanIds) private _loansByTool;
    mapping(address borrower => uint64[] loanIds) private _loansByBorrower;
    /// @dev Every loan ever requested on one of this member's tools, so an owner's queue is one read.
    mapping(address toolOwner => uint64[] loanIds) private _loansByOwner;
    /// @dev One open request per borrower per tool.
    mapping(uint64 toolId => mapping(address borrower => bool)) private _hasOpenRequest;

    /**
     * @notice USDC that belongs to a member but could not be delivered, claimable with `withdraw`.
     * @dev USDC can block an address or pause transfers. Without this, one blocked counterparty
     *      would take down the whole settlement — including the other party's much larger refund —
     *      and leave the escrow and the tool locked forever. Settlement always completes; a payout
     *      that cannot land becomes a credit.
     */
    mapping(address member => uint256 amount) public owed;

    /// @notice Members in join order, for the directory screen. Entries are never removed, so an
    ///         address that is removed and re-added keeps one slot; use `hasRole` for the truth.
    address[] private _memberRoll;
    mapping(address => bool) private _everMember;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);
    event ToolListed(
        uint64 indexed toolId,
        address indexed owner,
        uint96 deposit,
        uint96 dailyLateFee,
        uint32 maxDurationDays,
        string metadataURI
    );
    event ToolUpdated(
        uint64 indexed toolId, uint96 deposit, uint96 dailyLateFee, uint32 maxDurationDays, string metadataURI
    );
    event ToolListingChanged(uint64 indexed toolId, bool listed);
    event LoanRequested(
        uint64 indexed loanId, uint64 indexed toolId, address indexed borrower, uint32 durationDays, uint96 deposit
    );
    event LoanApproved(uint64 indexed loanId, uint64 indexed toolId, address indexed borrower, uint64 dueAt);
    event ReturnReported(uint64 indexed loanId, uint64 returnedAt, uint32 lateDays);
    event MissingFlagged(uint64 indexed loanId, address indexed owner, uint64 claimableAt);
    event LoanDisputed(uint64 indexed loanId, address indexed owner);
    event PayoutCredited(address indexed member, uint256 amount);
    event Withdrawn(address indexed member, uint256 amount);
    event DisputeResolved(uint64 indexed loanId, address indexed steward, uint96 feeToOwner, Outcome outcome);
    event LoanClosed(
        uint64 indexed loanId,
        uint64 indexed toolId,
        address indexed borrower,
        Outcome outcome,
        uint32 lateDays,
        uint96 feeToOwner,
        uint96 refundToBorrower
    );

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error NotAMember(address account);
    error NoSuchTool(uint64 toolId);
    error NoSuchLoan(uint64 loanId);
    error NotToolOwner(uint64 toolId, address caller);
    error NotBorrower(uint64 loanId, address caller);
    error ToolNotListed(uint64 toolId);
    error ToolOnLoan(uint64 toolId);
    error CannotBorrowOwnTool();
    error BadState(uint64 loanId, LoanState state);
    error BadDeposit();
    error BadLateFee();
    error BadDuration();
    error EmptyMetadata();
    error RequestExpired(uint64 loanId);
    error ConfirmWindowOpen(uint64 loanId, uint64 opensAt);
    error ConfirmWindowClosed(uint64 loanId);
    error DisputeWindowOpen(uint64 loanId, uint64 opensAt);
    error NotDefaultedYet(uint64 loanId, uint64 defaultsAt);
    error NotFlaggedMissing(uint64 loanId);
    error AlreadyFlagged(uint64 loanId);
    error NotOverdue(uint64 loanId, uint64 dueAt);
    error RequestAlreadyOpen(uint64 toolId, address borrower);
    error UnexpectedDepositAmount(uint256 expected, uint256 received);
    error NothingOwed(address member);
    error AwardExceedsDeposit(uint96 award, uint96 deposit);
    error BadPagination();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTION
    //////////////////////////////////////////////////////////////*/

    /**
     * @param _depositToken USDC on the target chain.
     * @param steward The association's multisig. Gets both admin and steward rights.
     * @param initialMembers Optional first batch of members (the steward can add more later).
     */
    constructor(IERC20 _depositToken, address steward, address[] memory initialMembers) {
        if (address(_depositToken) == address(0) || steward == address(0)) revert ZeroAddress();
        depositToken = _depositToken;
        _grantRole(DEFAULT_ADMIN_ROLE, steward);
        _grantRole(STEWARD_ROLE, steward);
        _setRoleAdmin(MEMBER_ROLE, STEWARD_ROLE);
        for (uint256 i = 0; i < initialMembers.length; i++) {
            _addMember(initialMembers[i]);
        }
    }

    modifier onlyMember() {
        if (!hasRole(MEMBER_ROLE, msg.sender)) revert NotAMember(msg.sender);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                               MEMBERSHIP
    //////////////////////////////////////////////////////////////*/

    /// @notice Add members to the roll. ~300 households, so batching matters.
    function addMembers(address[] calldata members) external onlyRole(STEWARD_ROLE) {
        for (uint256 i = 0; i < members.length; i++) {
            _addMember(members[i]);
        }
    }

    /**
     * @notice Remove a member. They can no longer list tools or request loans, but every loan they
     *         are already party to settles normally — settlement never checks membership.
     */
    function removeMember(address member) external onlyRole(STEWARD_ROLE) {
        _revokeRole(MEMBER_ROLE, member);
        emit MemberRemoved(member);
    }

    function _addMember(address member) internal {
        if (member == address(0)) revert ZeroAddress();
        if (!_everMember[member]) {
            _everMember[member] = true;
            _memberRoll.push(member);
        }
        if (_grantRole(MEMBER_ROLE, member)) emit MemberAdded(member);
    }

    /*//////////////////////////////////////////////////////////////
                                  TOOLS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice List a tool you own.
     * @param metadataURI IPFS URI of a JSON blob with the name, photo, and condition notes.
     * @param deposit What a borrower escrows, in USDC units (6 decimals).
     * @param dailyLateFee Carved out of the deposit for each late day, in USDC units.
     * @param maxDurationDays Longest loan you will grant.
     *
     * @dev Both a real deposit and a nonzero daily fee are required: the fee is what makes a tool
     *      come back, and a nonzero fee is also what guarantees a loan can eventually be written
     *      off, so none can sit open forever waiting on a borrower who vanished. The fee is capped
     *      at a seventh of the deposit so that total forfeiture is never less than a week away.
     */
    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, uint32 maxDurationDays)
        external
        onlyMember
        returns (uint64 toolId)
    {
        _validateTerms(metadataURI, deposit, dailyLateFee, maxDurationDays);

        toolId = ++toolCount;
        Tool storage tool = _tools[toolId];
        tool.owner = msg.sender;
        tool.deposit = deposit;
        tool.dailyLateFee = dailyLateFee;
        tool.maxDurationDays = maxDurationDays;
        tool.listed = true;
        tool.metadataURI = metadataURI;

        _toolsByOwner[msg.sender].push(toolId);
        emit ToolListed(toolId, msg.sender, deposit, dailyLateFee, maxDurationDays, metadataURI);
    }

    /// @notice Update a tool's terms or photo. New terms apply to new requests only.
    function updateTool(
        uint64 toolId,
        string calldata metadataURI,
        uint96 deposit,
        uint96 dailyLateFee,
        uint32 maxDurationDays
    ) external {
        Tool storage tool = _requireToolOwner(toolId);
        _validateTerms(metadataURI, deposit, dailyLateFee, maxDurationDays);

        tool.deposit = deposit;
        tool.dailyLateFee = dailyLateFee;
        tool.maxDurationDays = maxDurationDays;
        tool.metadataURI = metadataURI;
        emit ToolUpdated(toolId, deposit, dailyLateFee, maxDurationDays, metadataURI);
    }

    /// @notice Take a tool off the browse screen (or put it back). History and open loans are kept.
    function setToolListed(uint64 toolId, bool listed) external {
        Tool storage tool = _requireToolOwner(toolId);
        tool.listed = listed;
        emit ToolListingChanged(toolId, listed);
    }

    function _validateTerms(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, uint32 maxDurationDays)
        internal
        pure
    {
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();
        if (deposit < MIN_DEPOSIT || deposit > MAX_DEPOSIT) revert BadDeposit();
        // A nonzero fee guarantees forfeiture is always reachable, and capping it at a seventh of
        // the deposit guarantees it is never less than a week away.
        if (dailyLateFee == 0 || dailyLateFee * MIN_DAYS_TO_FORFEIT > deposit) revert BadLateFee();
        if (maxDurationDays == 0 || maxDurationDays > MAX_DURATION_DAYS) revert BadDuration();
    }

    /*//////////////////////////////////////////////////////////////
                             BORROWING FLOW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Ask to borrow a tool for `durationDays`, escrowing the deposit now.
     * @dev The deposit moves up front so an owner who says yes knows the money is there. It is
     *      refundable in full right up until the owner approves: the borrower can always
     *      `cancelRequest`, and the owner can `declineLoan`.
     */
    function requestLoan(uint64 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint64 loanId) {
        Tool storage tool = _tools[toolId];
        if (tool.owner == address(0)) revert NoSuchTool(toolId);
        if (!tool.listed) revert ToolNotListed(toolId);
        if (tool.owner == msg.sender) revert CannotBorrowOwnTool();
        if (durationDays == 0 || durationDays > tool.maxDurationDays) revert BadDuration();
        // Without this, request/cancel is a free loop that grows an owner's queue without bound.
        if (_hasOpenRequest[toolId][msg.sender]) revert RequestAlreadyOpen(toolId, msg.sender);

        loanId = ++loanCount;
        Loan storage loan = _loans[loanId];
        loan.toolId = toolId;
        loan.borrower = msg.sender;
        loan.deposit = tool.deposit;
        loan.dailyLateFee = tool.dailyLateFee;
        loan.durationDays = durationDays;
        loan.requestedAt = uint64(block.timestamp);
        loan.state = LoanState.Requested;

        _hasOpenRequest[toolId][msg.sender] = true;
        _loansByTool[toolId].push(loanId);
        _loansByBorrower[msg.sender].push(loanId);
        _loansByOwner[tool.owner].push(loanId);

        emit LoanRequested(loanId, toolId, msg.sender, durationDays, tool.deposit);

        // Measure what actually arrived. Real USDC transfers the full amount, but the deposit token
        // is a deploy-time argument, and a fee-on-transfer token would otherwise let a loan claim
        // escrow it never funded — and be settled out of some other loan's money.
        uint256 balanceBefore = depositToken.balanceOf(address(this));
        depositToken.safeTransferFrom(msg.sender, address(this), tool.deposit);
        uint256 received = depositToken.balanceOf(address(this)) - balanceBefore;
        if (received != tool.deposit) revert UnexpectedDepositAmount(tool.deposit, received);
    }

    /// @notice Withdraw your own pending request and take the deposit back.
    function cancelRequest(uint64 loanId) external nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.borrower != msg.sender) revert NotBorrower(loanId, msg.sender);
        if (loan.state != LoanState.Requested) revert BadState(loanId, loan.state);
        _closeRequest(loanId, loan, Outcome.Cancelled);
    }

    /// @notice Turn down a pending request on your tool; the borrower's deposit goes straight back.
    function declineLoan(uint64 loanId) external nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        _requireToolOwner(loan.toolId);
        if (loan.state != LoanState.Requested) revert BadState(loanId, loan.state);
        _closeRequest(loanId, loan, Outcome.Declined);
    }

    /**
     * @notice Hand the tool over: approves a pending request and starts the clock.
     * @dev Only one loan at a time per tool. Approving is what makes the deposit non-refundable
     *      and starts the due date, so an owner should call it as they physically hand the tool over.
     */
    function approveLoan(uint64 loanId) external {
        Loan storage loan = _requireLoan(loanId);
        Tool storage tool = _requireToolOwner(loan.toolId);
        if (loan.state != LoanState.Requested) revert BadState(loanId, loan.state);
        if (!tool.listed) revert ToolNotListed(loan.toolId); // delisted mid-request: don't lend it out
        if (block.timestamp > loan.requestedAt + REQUEST_TTL) revert RequestExpired(loanId);
        if (tool.activeLoanId != 0) revert ToolOnLoan(loan.toolId);

        loan.state = LoanState.Active;
        loan.startedAt = uint64(block.timestamp);
        loan.dueAt = uint64(block.timestamp) + uint64(loan.durationDays) * 1 days;
        tool.activeLoanId = loanId;

        emit LoanApproved(loanId, loan.toolId, loan.borrower, loan.dueAt);
    }

    /**
     * @notice Say you have handed the tool back. Stops the late-fee clock at this moment.
     * @dev The owner then has CONFIRM_WINDOW to confirm (settling at this timestamp) or dispute.
     *      If they do neither, anyone — in practice the borrower — can call `settleUnconfirmed`.
     */
    function reportReturn(uint64 loanId) external {
        Loan storage loan = _requireLoan(loanId);
        if (loan.borrower != msg.sender) revert NotBorrower(loanId, msg.sender);
        if (loan.state != LoanState.Active) revert BadState(loanId, loan.state);

        loan.returnedAt = uint64(block.timestamp);
        loan.state = LoanState.ReturnClaimed;
        (uint32 lateDays,) = _quote(loan, uint64(block.timestamp));
        emit ReturnReported(loanId, uint64(block.timestamp), lateDays);
    }

    /**
     * @notice Confirm you have the tool back. Settles the loan: late fees to you, the rest refunded.
     * @dev Callable straight from Active (the owner is the one holding the tool again, so their
     *      word is enough) or from ReturnClaimed, in which case the borrower's reported time is
     *      used — the owner accepted it by confirming. Settling is also how the tool is freed up
     *      for the next loan, which is the owner's standing reason to call it.
     */
    function confirmReturn(uint64 loanId) external nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        _requireToolOwner(loan.toolId);
        if (loan.state != LoanState.Active && loan.state != LoanState.ReturnClaimed) {
            revert BadState(loanId, loan.state);
        }
        uint64 returnedAt = loan.state == LoanState.ReturnClaimed ? loan.returnedAt : uint64(block.timestamp);
        loan.returnedAt = returnedAt;
        _settle(loanId, loan, returnedAt);
    }

    /**
     * @notice Settle a reported return the owner never answered. Callable by anyone once
     *         CONFIRM_WINDOW has passed; the borrower calls it to get their deposit back.
     */
    function settleUnconfirmed(uint64 loanId) external nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.ReturnClaimed) revert BadState(loanId, loan.state);
        uint64 opensAt = loan.returnedAt + CONFIRM_WINDOW;
        if (block.timestamp < opensAt) revert ConfirmWindowOpen(loanId, opensAt);
        _settle(loanId, loan, loan.returnedAt);
    }

    /**
     * @notice Reject a reported return — it never came back, or came back broken. Sends the loan
     *         to the steward for arbitration. Only inside CONFIRM_WINDOW, so a borrower who
     *         reported honestly is not left hanging indefinitely.
     */
    function disputeReturn(uint64 loanId) external {
        Loan storage loan = _requireLoan(loanId);
        _requireToolOwner(loan.toolId);
        if (loan.state != LoanState.ReturnClaimed) revert BadState(loanId, loan.state);
        // Strictly before the instant `settleUnconfirmed` opens, so the two can never both be legal.
        if (block.timestamp >= loan.returnedAt + CONFIRM_WINDOW) revert ConfirmWindowClosed(loanId);

        loan.state = LoanState.Disputed;
        emit LoanDisputed(loanId, _tools[loan.toolId].owner);
    }

    /**
     * @notice Steward's ruling on a disputed loan: how much of the escrow the owner keeps.
     * @param feeToOwner USDC to the owner, capped at that loan's own deposit. The rest is refunded.
     * @dev The track-record mark is derived from the award rather than passed in, so the numbers a
     *      member is ranked by can never contradict the money that actually moved: the whole
     *      escrow means the tool never came back, part of it means it came back late, none of it
     *      means the borrower was in the right.
     *
     *      This is the one discretionary power in the contract, and it is bounded by a single
     *      loan's escrow. Disputes are about physical facts — was the drill returned, was it
     *      broken — which nothing onchain can observe.
     */
    function resolveDispute(uint64 loanId, uint96 feeToOwner) external onlyRole(STEWARD_ROLE) nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Disputed) revert BadState(loanId, loan.state);
        if (feeToOwner > loan.deposit) revert AwardExceedsDeposit(feeToOwner, loan.deposit);

        Outcome outcome =
            feeToOwner == loan.deposit ? Outcome.Defaulted : feeToOwner > 0 ? Outcome.Late : Outcome.OnTime;

        emit DisputeResolved(loanId, msg.sender, feeToOwner, outcome);
        (uint32 lateDays,) = _quote(loan, loan.returnedAt);
        _payOut(loanId, loan, outcome, lateDays, feeToOwner);
    }

    /**
     * @notice Settle a dispute the steward never ruled on by splitting the escrow down the middle.
     *         Callable by anyone after DISPUTE_WINDOW, so escrow cannot be locked up by an absent
     *         steward.
     * @dev A coin-split rather than the ordinary rule, deliberately. The ordinary rule settles at
     *      the moment the *borrower* reported, which in a dispute is exactly the fact in question —
     *      falling back to it would hand the whole escrow to whoever was willing to lie, and make
     *      stalling the steward out a winning move. Splitting it means neither side gains by
     *      waiting, and both would rather have a real ruling. Nobody's track record is marked,
     *      because nothing was established.
     */
    function settleStaleDispute(uint64 loanId) external nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Disputed) revert BadState(loanId, loan.state);
        uint64 opensAt = loan.returnedAt + CONFIRM_WINDOW + DISPUTE_WINDOW;
        if (block.timestamp < opensAt) revert DisputeWindowOpen(loanId, opensAt);

        (uint32 lateDays,) = _quote(loan, loan.returnedAt);
        _payOut(loanId, loan, Outcome.Unresolved, lateDays, loan.deposit / 2);
    }

    /**
     * @notice Put on the record that an overdue tool has not come back. Owner only, and required
     *         before the deposit can be written off.
     * @dev This is what stops the one move that would otherwise dominate everything else for an
     *      owner: take the tool back, say nothing, let the late fees run to the full deposit, and
     *      keep it. Confirming a return pays an owner nothing, so silence had to be made expensive.
     *      Now it costs them an accusation with their name on it, which the borrower can see in the
     *      app and answer with `reportReturn` — and which the steward and every neighbor can read
     *      later, because it is an event on a public chain.
     */
    function flagMissing(uint64 loanId) external {
        Loan storage loan = _requireLoan(loanId);
        _requireToolOwner(loan.toolId);
        if (loan.state != LoanState.Active) revert BadState(loanId, loan.state);
        if (block.timestamp <= loan.dueAt) revert NotOverdue(loanId, loan.dueAt);
        if (loan.missingFlaggedAt != 0) revert AlreadyFlagged(loanId);

        loan.missingFlaggedAt = uint64(block.timestamp);
        emit MissingFlagged(loanId, msg.sender, uint64(block.timestamp) + CONFIRM_WINDOW);
    }

    /**
     * @notice Write off a loan that was flagged missing and whose late fees have reached the whole
     *         deposit: the owner takes all of it and the borrower's record gets a default.
     * @dev Callable by anyone — the owner has the money reason to, and it also frees the tool for
     *      relisting. Needs two independent things to be true: the fees have actually run to the
     *      cap (never less than a week, by construction), and the owner accused the borrower at
     *      least CONFIRM_WINDOW ago and the borrower never answered.
     */
    function claimDefault(uint64 loanId) external nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Active) revert BadState(loanId, loan.state);
        if (loan.missingFlaggedAt == 0) revert NotFlaggedMissing(loanId);
        uint64 claimableAt = loan.missingFlaggedAt + CONFIRM_WINDOW;
        uint64 defaultsAt = defaultTime(loanId);
        if (claimableAt > defaultsAt) defaultsAt = claimableAt;
        if (block.timestamp < defaultsAt) revert NotDefaultedYet(loanId, defaultsAt);

        (uint32 lateDays,) = _quote(loan, uint64(block.timestamp));
        loan.returnedAt = 0; // never came back
        _payOut(loanId, loan, Outcome.Defaulted, lateDays, loan.deposit);
    }

    /*//////////////////////////////////////////////////////////////
                          SETTLEMENT INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _closeRequest(uint64 loanId, Loan storage loan, Outcome outcome) internal {
        loan.state = LoanState.Closed;
        loan.outcome = outcome;
        loan.refundToBorrower = loan.deposit;
        _hasOpenRequest[loan.toolId][loan.borrower] = false;

        emit LoanClosed(loanId, loan.toolId, loan.borrower, outcome, 0, 0, loan.deposit);
        _send(loan.borrower, loan.deposit);
    }

    function _settle(uint64 loanId, Loan storage loan, uint64 returnedAt) internal {
        (uint32 lateDays, uint96 feeToOwner) = _quote(loan, returnedAt);
        Outcome outcome;
        if (feeToOwner == loan.deposit) {
            // Late long enough to burn through the whole deposit — that is a default, not a late return.
            outcome = Outcome.Defaulted;
        } else if (lateDays > 0) {
            outcome = Outcome.Late;
        } else {
            outcome = Outcome.OnTime;
        }
        _payOut(loanId, loan, outcome, lateDays, feeToOwner);
    }

    /// @dev The single exit for every active loan: records the track record, frees the tool, pays out.
    function _payOut(uint64 loanId, Loan storage loan, Outcome outcome, uint32 lateDays, uint96 feeToOwner) internal {
        Tool storage tool = _tools[loan.toolId];
        address owner = tool.owner;
        address borrower = loan.borrower;
        uint96 refund = loan.deposit - feeToOwner;

        // Effects
        loan.state = LoanState.Closed;
        loan.outcome = outcome;
        loan.feeToOwner = feeToOwner;
        loan.refundToBorrower = refund;
        if (tool.activeLoanId == loanId) tool.activeLoanId = 0;
        _hasOpenRequest[loan.toolId][borrower] = false;

        Record storage borrowerRecord = _records[borrower];
        borrowerRecord.loansBorrowed += 1;
        borrowerRecord.lateFeesPaid += feeToOwner;
        if (outcome == Outcome.Late) borrowerRecord.lateReturns += 1;
        if (outcome == Outcome.Defaulted) {
            // A default is also a late return: an offchain ranker that adds them is double-counting
            // on purpose, because a tool that never came back is worse than one that came back late.
            borrowerRecord.lateReturns += 1;
            borrowerRecord.defaults += 1;
        }
        // Outcome.Unresolved counts as a loan and nothing else — nothing was established.

        Record storage ownerRecord = _records[owner];
        ownerRecord.loansLent += 1;
        ownerRecord.lateFeesEarned += feeToOwner;

        emit LoanClosed(loanId, loan.toolId, borrower, outcome, lateDays, feeToOwner, refund);

        // Interactions
        if (feeToOwner > 0) _send(owner, feeToOwner);
        if (refund > 0) _send(borrower, refund);
    }

    /**
     * @dev Pay someone, and if the token will not let us, credit them instead of reverting.
     *
     *      USDC can block an address or pause transfers entirely. Paying the owner and the borrower
     *      in the same transaction means that without this, one blocked counterparty takes the
     *      whole settlement down with them: the other party's refund never lands, the escrow is
     *      stuck in this contract, and the tool stays marked as on loan forever. Settlement must
     *      always complete, so an undeliverable payout becomes a claim on `withdraw`.
     */
    function _send(address to, uint96 amount) internal {
        try depositToken.transfer(to, amount) returns (bool ok) {
            if (ok) return;
        } catch { }
        owed[to] += amount;
        emit PayoutCredited(to, amount);
    }

    /// @notice Collect a payout that could not be delivered when its loan settled.
    function withdraw() external nonReentrant {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed(msg.sender);
        owed[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
        depositToken.safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Late fee = days late * daily fee, capped at the deposit. A started day counts as a full
     *      day (returning 25 hours late costs two days), which is how a physical lending library
     *      charges and keeps the arithmetic legible to members.
     *
     *      Unless the owner has flagged the tool missing, the fee stops growing UNFLAGGED_FEE_GRACE
     *      past the due date. An owner who quietly takes their drill back and then waits should not
     *      be able to collect a month of fees on a tool sitting in their own garage; if it really
     *      is still gone, saying so onchain costs them one transaction and lets the clock run again.
     *      Since a daily fee can be at most a seventh of the deposit, a week of unflagged fees can
     *      never exceed the escrow.
     */
    function _quote(Loan storage loan, uint64 returnedAt) internal view returns (uint32 lateDays, uint96 feeToOwner) {
        if (returnedAt == 0 || loan.dueAt == 0 || returnedAt <= loan.dueAt) return (0, 0);
        if (loan.missingFlaggedAt == 0 && returnedAt > loan.dueAt + UNFLAGGED_FEE_GRACE) {
            returnedAt = loan.dueAt + UNFLAGGED_FEE_GRACE;
        }
        uint256 overdue = returnedAt - loan.dueAt;
        uint256 daysLate = (overdue + 1 days - 1) / 1 days; // ceiling
        uint256 fee = daysLate * uint256(loan.dailyLateFee);
        if (fee > loan.deposit) fee = loan.deposit;
        // daysLate is bounded by the deposit/fee ratio in practice, but clamp the reported value.
        // casting to 'uint32' is safe because the ternary above clamps daysLate to uint32 range
        // forge-lint: disable-next-line(unsafe-typecast)
        lateDays = daysLate > type(uint32).max ? type(uint32).max : uint32(daysLate);
        // casting to 'uint96' is safe because fee is clamped to loan.deposit, itself a uint96
        // forge-lint: disable-next-line(unsafe-typecast)
        feeToOwner = uint96(fee);
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Timestamp at which an active loan's late fees reach the whole deposit — the earliest
     *         it could be written off, and only then if the owner has also flagged it missing.
     */
    function defaultTime(uint64 loanId) public view returns (uint64) {
        Loan storage loan = _loans[loanId];
        if (loan.dueAt == 0) return 0;
        uint256 daysToCap = (uint256(loan.deposit) + loan.dailyLateFee - 1) / loan.dailyLateFee; // ceiling
        // casting to 'uint64' is safe because daysToCap <= MAX_DEPOSIT (1e10), so the product is < 2^50
        // forge-lint: disable-next-line(unsafe-typecast)
        return loan.dueAt + uint64(daysToCap * 1 days);
    }

    /**
     * @notice What a loan would pay out if it settled at `at`. Drives the "you owe $12 in late
     *         fees" line in the UI.
     */
    function quoteSettlement(uint64 loanId, uint64 at)
        external
        view
        returns (uint32 lateDays, uint96 feeToOwner, uint96 refundToBorrower)
    {
        Loan storage loan = _loans[loanId];
        if (loan.state == LoanState.Closed) {
            return (0, loan.feeToOwner, loan.refundToBorrower);
        }
        (lateDays, feeToOwner) = _quote(loan, at);
        refundToBorrower = loan.deposit - feeToOwner;
    }

    function getTool(uint64 toolId) external view returns (Tool memory) {
        return _tools[toolId];
    }

    function getLoan(uint64 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    function getRecord(address member) external view returns (Record memory) {
        return _records[member];
    }

    /// @notice Batched read for the browse screen: one RPC call per page of tools.
    function getTools(uint64 offset, uint64 limit) external view returns (Tool[] memory tools, uint64[] memory ids) {
        uint256 end = uint256(offset) + limit; // uint256 so a huge limit clamps instead of wrapping
        if (end > toolCount) end = toolCount;
        // casting to 'uint64' is safe because end is clamped to toolCount, itself a uint64
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 n = end > offset ? uint64(end - offset) : 0;
        tools = new Tool[](n);
        ids = new uint64[](n);
        for (uint64 i = 0; i < n; i++) {
            uint64 id = offset + i + 1; // tool ids start at 1
            ids[i] = id;
            tools[i] = _tools[id];
        }
    }

    /// @notice Batched read for ranking: the track records of a page of members.
    function getRecords(address[] calldata members) external view returns (Record[] memory records) {
        records = new Record[](members.length);
        for (uint256 i = 0; i < members.length; i++) {
            records[i] = _records[members[i]];
        }
    }

    function getLoans(uint64[] calldata loanIds) external view returns (Loan[] memory loans) {
        loans = new Loan[](loanIds.length);
        for (uint256 i = 0; i < loanIds.length; i++) {
            loans[i] = _loans[loanIds[i]];
        }
    }

    /**
     * @notice The tools this member owns.
     * @dev The id lists below are paginated. Anyone can append to another member's loan list simply
     *      by requesting one of their tools, and nothing is ever removed, so returning a whole list
     *      would let one neighbor make another's dashboard unreadable for the price of some gas.
     *      Pass `limit = 0` for "everything from `offset`", which is what the app does at this size.
     */
    function getToolIdsByOwner(address owner, uint256 offset, uint256 limit)
        external
        view
        returns (uint64[] memory ids, uint256 total)
    {
        return (_page(_toolsByOwner[owner], offset, limit), _toolsByOwner[owner].length);
    }

    /// @notice Every loan ever requested on a tool, newest last.
    function getLoanIdsByTool(uint64 toolId, uint256 offset, uint256 limit)
        external
        view
        returns (uint64[] memory ids, uint256 total)
    {
        return (_page(_loansByTool[toolId], offset, limit), _loansByTool[toolId].length);
    }

    /// @notice Every loan this member has borrowed or asked to borrow.
    function getLoanIdsByBorrower(address borrower, uint256 offset, uint256 limit)
        external
        view
        returns (uint64[] memory ids, uint256 total)
    {
        return (_page(_loansByBorrower[borrower], offset, limit), _loansByBorrower[borrower].length);
    }

    /// @notice Every loan requested on the tools this member owns — the lender side of the dashboard.
    function getLoanIdsByOwner(address toolOwner, uint256 offset, uint256 limit)
        external
        view
        returns (uint64[] memory ids, uint256 total)
    {
        return (_page(_loansByOwner[toolOwner], offset, limit), _loansByOwner[toolOwner].length);
    }

    /// @dev A window onto a storage array, newest entries last. `limit == 0` means "to the end".
    function _page(uint64[] storage all, uint256 offset, uint256 limit) internal view returns (uint64[] memory ids) {
        uint256 end = limit == 0 ? all.length : offset + limit;
        if (end > all.length) end = all.length;
        if (offset >= end) return new uint64[](0);
        ids = new uint64[](end - offset);
        for (uint256 i = 0; i < ids.length; i++) {
            ids[i] = all[offset + i];
        }
    }

    function memberCount() external view returns (uint256) {
        return _memberRoll.length;
    }

    /// @notice Every address ever on the roll, with a flag for whether it is still a member.
    function getMembers() external view returns (address[] memory members, bool[] memory active) {
        members = _memberRoll;
        active = new bool[](members.length);
        for (uint256 i = 0; i < members.length; i++) {
            active[i] = hasRole(MEMBER_ROLE, members[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                 HELPERS
    //////////////////////////////////////////////////////////////*/

    function _requireLoan(uint64 loanId) internal view returns (Loan storage loan) {
        loan = _loans[loanId];
        if (loan.state == LoanState.None) revert NoSuchLoan(loanId);
    }

    function _requireToolOwner(uint64 toolId) internal view returns (Tool storage tool) {
        tool = _tools[toolId];
        if (tool.owner == address(0)) revert NoSuchTool(toolId);
        if (tool.owner != msg.sender) revert NotToolOwner(toolId, msg.sender);
    }
}
