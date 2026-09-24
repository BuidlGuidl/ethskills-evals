// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Toolshed
 * @notice A lending library for a neighbourhood association. Members list tools they own,
 *         other members borrow them against a USDC deposit held in escrow by this contract.
 *         A daily late fee is taken out of the deposit and paid to the owner; the rest goes
 *         back to the borrower. Every settled loan updates both members' track records.
 *
 * @dev Money model: the deposit is the only pot of value in a loan. Whatever the owner is
 *      owed in late fees is capped at the deposit, so the contract can always pay both legs
 *      and never holds a claim it cannot honour. Token amounts are raw units of `token`
 *      (USDC has 6 decimals, so 25 USDC == 25_000_000).
 *
 *      What is deliberately NOT onchain: photos, descriptions and condition notes live in a
 *      JSON document behind `metadataURI` (IPFS), and reliability sorting is computed by the
 *      frontend from the counters in `Member`.
 *
 *      Trust boundary: nobody can prove onchain that a physical tool changed hands. The
 *      contract's job is to make sure the money never gets stuck — every state has a way out
 *      that some party is motivated to call — and to bound how much a stalling or dishonest
 *      counterparty can cost you.
 */
contract Toolshed is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice May admit and remove members, and arbitrate disputed returns.
    bytes32 public constant STEWARD_ROLE = keccak256("STEWARD_ROLE");

    /// @notice An unanswered borrow request can be swept back to the borrower after this long.
    uint256 public constant REQUEST_EXPIRY = 3 days;

    /// @notice After a borrower declares a return, the owner has this long to confirm or dispute.
    uint256 public constant RETURN_CONFIRM_WINDOW = 3 days;

    /// @notice A loan this far past due can be written off as a default even if late fees are small.
    uint256 public constant DEFAULT_GRACE = 30 days;

    /// @notice Upper bound on the loan length an owner can grant. "A few days", generously read.
    uint256 public constant MAX_LOAN_DAYS = 60;

    /// @notice How many requests + active loans one member can have open at once.
    uint256 public constant MAX_OPEN_BORROWS = 5;

    enum LoanStatus {
        None,
        Requested, // borrower's deposit is escrowed, waiting on the owner
        Active, // tool is out
        ReturnDeclared, // borrower says it's back, late-fee clock is frozen
        Completed, // settled, deposit split
        Cancelled, // borrower pulled the request
        Declined, // owner said no
        Expired, // nobody answered the request
        Defaulted // tool never came back, owner took the deposit
    }

    struct Tool {
        address owner;
        uint96 deposit; // required deposit, raw token units
        uint96 feePerDay; // late fee per started day, raw token units
        uint32 maxDays; // longest loan this owner will grant
        uint64 activeLoanId; // 0 when free
        bool available; // owner can shelve a tool without retiring it
        bool retired;
        string metadataURI; // ipfs://... -> { name, photo, condition, ... }
    }

    struct Loan {
        address borrower;
        uint64 toolId;
        LoanStatus status;
        bool disputed;
        uint96 deposit; // terms are copied from the tool at request time and frozen
        uint96 feePerDay;
        uint16 durationDays;
        uint40 requestedAt;
        uint40 startedAt;
        uint40 dueAt;
        uint40 returnedAt; // when the borrower declared the return, 0 if they never did
    }

    struct Member {
        bool active;
        uint40 joinedAt;
        uint32 loansBorrowed; // loans returned as a borrower (late or not)
        uint32 lateReturns; // how many of those came back late
        uint32 totalLateDays;
        uint32 defaults; // tools never returned
        uint32 loansLent; // loans completed as the owner
        uint32 openBorrows; // requests + active loans right now
    }

    IERC20 public immutable token;

    /// @notice Payouts that couldn't be pushed (a blocked USDC address, a paused token), waiting
    ///         to be pulled with `withdrawCredit`. Normally empty.
    mapping(address => uint256) public credits;

    mapping(address => Member) public members;
    address[] public memberList; // append-only roster, `Member.active` is the source of truth

    Tool[] public tools;
    Loan[] public loans; // loans[0] is a burnt sentinel so Tool.activeLoanId == 0 means "free"

    event MemberAdmitted(address indexed member);
    event MemberRemoved(address indexed member);
    event ToolListed(
        uint256 indexed toolId, address indexed owner, uint96 deposit, uint96 feePerDay, string metadataURI
    );
    event ToolUpdated(uint256 indexed toolId, uint96 deposit, uint96 feePerDay, uint32 maxDays, string metadataURI);
    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
    event ToolRetired(uint256 indexed toolId);
    event LoanRequested(
        uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays, uint96 deposit
    );
    event LoanApproved(uint256 indexed loanId, uint256 indexed toolId, uint40 dueAt);
    event LoanClosedBeforeStart(uint256 indexed loanId, LoanStatus status);
    event ReturnDeclared(uint256 indexed loanId, uint40 returnedAt);
    event ReturnDisputed(uint256 indexed loanId);
    event LoanSettled(
        uint256 indexed loanId,
        uint256 indexed toolId,
        address indexed borrower,
        uint32 lateDays,
        uint256 feeToOwner,
        uint256 refundToBorrower
    );
    event LoanDefaulted(
        uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 depositToOwner
    );
    event PayoutDeferred(address indexed to, uint256 amount);
    event CreditWithdrawn(address indexed to, uint256 amount);

    error NotAMember();
    error NotToolOwner();
    error NotBorrower();
    error ToolUnavailable();
    error BadTerms();
    error BadDuration();
    error WrongStatus();
    error TooSoon();
    error NotDisputed();
    error TooManyOpenBorrows();
    error CannotBorrowOwnTool();
    error AlreadyDisputed();
    error LoanDisputed();
    error NothingToWithdraw();

    modifier onlyMember() {
        _requireMember();
        _;
    }

    function _requireMember() private view {
        if (!members[msg.sender].active) revert NotAMember();
    }

    /**
     * @param token_ The deposit currency. USDC on the target chain.
     * @param steward The association account that keeps the roster and arbitrates disputes.
     *        Use a Safe multisig in production.
     */
    constructor(IERC20 token_, address steward) {
        if (address(token_) == address(0) || steward == address(0)) revert BadTerms();
        token = token_;
        _grantRole(DEFAULT_ADMIN_ROLE, steward);
        _grantRole(STEWARD_ROLE, steward);
        loans.push(); // burn index 0
    }

    // ---------------------------------------------------------------------
    // Roster
    // ---------------------------------------------------------------------

    /**
     * @notice Admit a neighbour. The association decides who is a member offchain; this just
     *         records it. Re-admitting a previously removed member keeps their track record.
     */
    function admitMember(address member) public onlyRole(STEWARD_ROLE) {
        if (member == address(0)) revert BadTerms();
        Member storage m = members[member];
        if (m.active) return;
        if (m.joinedAt == 0) {
            m.joinedAt = uint40(block.timestamp);
            memberList.push(member);
        }
        m.active = true;
        emit MemberAdmitted(member);
    }

    function admitMembers(address[] calldata newMembers) external onlyRole(STEWARD_ROLE) {
        for (uint256 i = 0; i < newMembers.length; i++) {
            admitMember(newMembers[i]);
        }
    }

    /**
     * @notice Remove a member. They can no longer list tools or request loans, but any loan
     *         already running settles normally — removal never traps anyone's deposit.
     */
    function removeMember(address member) external onlyRole(STEWARD_ROLE) {
        if (!members[member].active) revert NotAMember();
        members[member].active = false;
        emit MemberRemoved(member);
    }

    // ---------------------------------------------------------------------
    // Tools
    // ---------------------------------------------------------------------

    /**
     * @notice List a tool you own.
     * @param metadataURI IPFS URI of the listing JSON (name, photo, condition notes).
     * @param deposit What a borrower escrows. Should roughly cover replacing the tool.
     * @param feePerDay Late fee charged per started day overdue. Must be non-zero so that an
     *        unreturned tool eventually reaches the deposit cap and can be written off.
     * @param maxDays Longest loan you'll grant.
     */
    function listTool(string calldata metadataURI, uint96 deposit, uint96 feePerDay, uint32 maxDays)
        external
        onlyMember
        returns (uint256 toolId)
    {
        _validateTerms(deposit, feePerDay, maxDays, metadataURI);

        toolId = tools.length;
        tools.push(
            Tool({
                owner: msg.sender,
                deposit: deposit,
                feePerDay: feePerDay,
                maxDays: maxDays,
                activeLoanId: 0,
                available: true,
                retired: false,
                metadataURI: metadataURI
            })
        );

        emit ToolListed(toolId, msg.sender, deposit, feePerDay, metadataURI);
    }

    /**
     * @notice Change a listing. Loans already requested or running keep the terms they agreed to.
     */
    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 feePerDay, uint32 maxDays)
        external
    {
        Tool storage t = _ownedTool(toolId);
        _validateTerms(deposit, feePerDay, maxDays, metadataURI);

        t.metadataURI = metadataURI;
        t.deposit = deposit;
        t.feePerDay = feePerDay;
        t.maxDays = maxDays;

        emit ToolUpdated(toolId, deposit, feePerDay, maxDays, metadataURI);
    }

    /// @notice Temporarily take a tool off the browse screen (you're using it this weekend).
    function setToolAvailability(uint256 toolId, bool available) external {
        Tool storage t = _ownedTool(toolId);
        t.available = available;
        emit ToolAvailabilityChanged(toolId, available);
    }

    /// @notice Permanently delist a tool. Only possible when it isn't out on loan.
    function retireTool(uint256 toolId) external {
        Tool storage t = _ownedTool(toolId);
        if (t.activeLoanId != 0) revert ToolUnavailable();
        t.retired = true;
        t.available = false;
        emit ToolRetired(toolId);
    }

    // ---------------------------------------------------------------------
    // Borrowing
    // ---------------------------------------------------------------------

    /**
     * @notice Ask to borrow a tool for `durationDays`. The deposit is pulled from your wallet
     *         now and held in escrow, so the owner knows it is actually there. You get it back
     *         if they decline, if you cancel, or if nobody answers within REQUEST_EXPIRY.
     * @dev Requires an ERC-20 allowance of exactly the tool's current deposit.
     */
    function requestLoan(uint256 toolId, uint16 durationDays)
        external
        onlyMember
        nonReentrant
        returns (uint256 loanId)
    {
        Tool storage t = tools[toolId];
        if (t.retired || !t.available || t.activeLoanId != 0) revert ToolUnavailable();
        if (t.owner == msg.sender) revert CannotBorrowOwnTool();
        if (durationDays == 0 || durationDays > t.maxDays) revert BadDuration();

        Member storage borrower = members[msg.sender];
        if (borrower.openBorrows >= MAX_OPEN_BORROWS) revert TooManyOpenBorrows();

        loanId = loans.length;
        loans.push(
            Loan({
                borrower: msg.sender,
                // safe: tools[toolId] above reverts unless toolId < tools.length, and an array
                // that long cannot be built within the block gas limit of any real chain.
                // forge-lint: disable-next-line(unsafe-typecast)
                toolId: uint64(toolId),
                status: LoanStatus.Requested,
                disputed: false,
                deposit: t.deposit,
                feePerDay: t.feePerDay,
                durationDays: durationDays,
                requestedAt: uint40(block.timestamp),
                startedAt: 0,
                dueAt: 0,
                returnedAt: 0
            })
        );

        // safe: loanId is the length of an array we just pushed to; same bound as above.
        // forge-lint: disable-next-line(unsafe-typecast)
        t.activeLoanId = uint64(loanId);
        borrower.openBorrows += 1;

        emit LoanRequested(loanId, toolId, msg.sender, durationDays, t.deposit);

        token.safeTransferFrom(msg.sender, address(this), t.deposit);
    }

    /**
     * @notice Owner: hand the tool over and start the clock.
     * @dev Approving is the onchain record of a physical handover, so only the owner can do it.
     */
    function approveRequest(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Requested) revert WrongStatus();
        Tool storage t = tools[l.toolId];
        if (t.owner != msg.sender) revert NotToolOwner();

        l.status = LoanStatus.Active;
        l.startedAt = uint40(block.timestamp);
        l.dueAt = uint40(block.timestamp + uint256(l.durationDays) * 1 days);

        emit LoanApproved(loanId, l.toolId, l.dueAt);
    }

    /// @notice Owner: turn down a request and release the deposit.
    function declineRequest(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Requested) revert WrongStatus();
        if (tools[l.toolId].owner != msg.sender) revert NotToolOwner();
        _closeBeforeStart(loanId, LoanStatus.Declined);
    }

    /// @notice Borrower: withdraw a request that hasn't been approved yet.
    function cancelRequest(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Requested) revert WrongStatus();
        if (l.borrower != msg.sender) revert NotBorrower();
        _closeBeforeStart(loanId, LoanStatus.Cancelled);
    }

    /**
     * @notice Pull a payout that couldn't be pushed to you at settlement time. Only relevant if
     *         the token refused the transfer — normally nothing is ever waiting here.
     */
    function withdrawCredit() external nonReentrant {
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        credits[msg.sender] = 0;
        emit CreditWithdrawn(msg.sender, amount);
        token.safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Anyone: sweep a request the owner never answered, refunding the borrower and
     *         freeing the tool. Permissionless so an absent owner can't sit on someone's money.
     */
    function expireRequest(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Requested) revert WrongStatus();
        if (block.timestamp < uint256(l.requestedAt) + REQUEST_EXPIRY) revert TooSoon();
        _closeBeforeStart(loanId, LoanStatus.Expired);
    }

    // ---------------------------------------------------------------------
    // Returning
    // ---------------------------------------------------------------------

    /**
     * @notice Borrower: say you've brought the tool back. This freezes the late-fee clock at
     *         now, so an owner who takes their time confirming can't run up your bill.
     */
    function declareReturn(uint256 loanId) external {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Active) revert WrongStatus();
        if (l.borrower != msg.sender) revert NotBorrower();

        l.status = LoanStatus.ReturnDeclared;
        l.returnedAt = uint40(block.timestamp);

        emit ReturnDeclared(loanId, l.returnedAt);
    }

    /**
     * @notice Owner: confirm the tool is back and settle. Late fees are charged up to the
     *         moment the borrower declared the return, or up to now if they never did.
     */
    function confirmReturn(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Active && l.status != LoanStatus.ReturnDeclared) revert WrongStatus();
        if (tools[l.toolId].owner != msg.sender) revert NotToolOwner();

        uint256 endAt = l.returnedAt == 0 ? block.timestamp : l.returnedAt;
        _settle(loanId, _lateDays(l.dueAt, endAt));
    }

    /**
     * @notice Owner: reject a return claim — the tool is not actually back. The loan goes back
     *         to Active and the late-fee clock resumes. The steward can then arbitrate.
     */
    function disputeReturn(uint256 loanId) external {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.ReturnDeclared) revert WrongStatus();
        if (tools[l.toolId].owner != msg.sender) revert NotToolOwner();
        // Once per loan. An owner who could dispute over and over would restart the fee clock
        // faster than an honest borrower can re-declare and settle, run the fees up to the cap
        // and take the whole deposit off somebody who did nothing wrong. After one dispute the
        // ways out are: the owner confirms, the borrower declares again and settles once the
        // window passes, or the steward decides. Not claimDefault.
        if (l.disputed) revert AlreadyDisputed();

        l.status = LoanStatus.Active;
        l.returnedAt = 0;
        l.disputed = true;

        emit ReturnDisputed(loanId);
    }

    /**
     * @notice Anyone: settle a declared return the owner has neither confirmed nor disputed
     *         within RETURN_CONFIRM_WINDOW. Late fees are charged up to the declared return
     *         time, which the borrower could not backdate.
     */
    function finalizeReturn(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.ReturnDeclared) revert WrongStatus();
        // Two clocks have to run out, not one. The confirm window gives the owner time to react,
        // but settlement can't happen before the due date either — otherwise a borrower could
        // declare a return the moment they took the tool, wait three days and refund themselves
        // while the loan still had weeks to run. An honest early return loses nothing by waiting:
        // the fee is computed at the declared time either way.
        uint256 settleableAt = uint256(l.returnedAt) + RETURN_CONFIRM_WINDOW;
        if (settleableAt < l.dueAt) settleableAt = l.dueAt;
        if (block.timestamp < settleableAt) revert TooSoon();

        _settle(loanId, _lateDays(l.dueAt, l.returnedAt));
    }

    /**
     * @notice Owner: write off a tool that isn't coming back and take the whole deposit.
     *         Allowed once accrued late fees have reached the deposit cap, or DEFAULT_GRACE
     *         after the due date — whichever comes first. The borrower is marked as defaulted.
     */
    function claimDefault(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Active) revert WrongStatus();
        // A loan the owner has disputed belongs to the steward: letting the disputing party also
        // write it off would hand them both sides of the argument.
        if (l.disputed) revert LoanDisputed();
        Tool storage t = tools[l.toolId];
        if (t.owner != msg.sender) revert NotToolOwner();

        uint32 lateDays = _lateDays(l.dueAt, block.timestamp);
        bool feesAtCap = lateDays * uint256(l.feePerDay) >= uint256(l.deposit);
        bool graceElapsed = block.timestamp >= uint256(l.dueAt) + DEFAULT_GRACE;
        if (!feesAtCap && !graceElapsed) revert TooSoon();

        uint256 deposit = l.deposit;
        address borrower = l.borrower;

        l.status = LoanStatus.Defaulted;
        t.activeLoanId = 0;
        t.available = false; // the tool is gone; don't leave it on the browse screen
        t.retired = true;

        Member storage b = members[borrower];
        b.defaults += 1;
        b.totalLateDays += lateDays;
        b.openBorrows -= 1;

        emit LoanDefaulted(loanId, l.toolId, borrower, deposit);

        _payout(t.owner, deposit);
    }

    /**
     * @notice Steward: settle a disputed loan with an explicit number of late days, after the
     *         neighbours have talked it out. Bounded by the same deposit cap as everything else.
     */
    function resolveDispute(uint256 loanId, uint32 lateDays) external onlyRole(STEWARD_ROLE) nonReentrant {
        Loan storage l = loans[loanId];
        if (!l.disputed) revert NotDisputed();
        if (l.status != LoanStatus.Active && l.status != LoanStatus.ReturnDeclared) revert WrongStatus();
        _settle(loanId, lateDays);
    }

    // ---------------------------------------------------------------------
    // Views — the browse and profile screens read these
    // ---------------------------------------------------------------------

    function toolCount() external view returns (uint256) {
        return tools.length;
    }

    /// @dev loans[0] is a sentinel, so real loan ids start at 1.
    function loanCount() external view returns (uint256) {
        return loans.length;
    }

    function memberCount() external view returns (uint256) {
        return memberList.length;
    }

    function getTool(uint256 toolId) external view returns (Tool memory) {
        return tools[toolId];
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getMember(address member) external view returns (Member memory) {
        return members[member];
    }

    function getTools(uint256 offset, uint256 limit) external view returns (Tool[] memory page) {
        page = new Tool[](_pageSize(tools.length, offset, limit));
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = tools[offset + i];
        }
    }

    function getLoans(uint256 offset, uint256 limit) external view returns (Loan[] memory page) {
        page = new Loan[](_pageSize(loans.length, offset, limit));
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = loans[offset + i];
        }
    }

    function getMembers(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addresses, Member[] memory stats)
    {
        uint256 size = _pageSize(memberList.length, offset, limit);
        addresses = new address[](size);
        stats = new Member[](size);
        for (uint256 i = 0; i < size; i++) {
            addresses[i] = memberList[offset + i];
            stats[i] = members[addresses[i]];
        }
    }

    /**
     * @notice What this loan would pay out if it settled right now. The browse and loan screens
     *         use this to show "late fee so far" without duplicating the fee maths.
     */
    function quoteSettlement(uint256 loanId)
        public
        view
        returns (uint32 lateDays, uint256 feeToOwner, uint256 refundToBorrower)
    {
        Loan storage l = loans[loanId];
        if (l.status != LoanStatus.Active && l.status != LoanStatus.ReturnDeclared) {
            return (0, 0, 0);
        }
        uint256 endAt = l.returnedAt == 0 ? block.timestamp : l.returnedAt;
        lateDays = _lateDays(l.dueAt, endAt);
        feeToOwner = _cappedFee(lateDays, l.feePerDay, l.deposit);
        refundToBorrower = uint256(l.deposit) - feeToOwner;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _validateTerms(uint96 deposit, uint96 feePerDay, uint32 maxDays, string calldata metadataURI)
        private
        pure
    {
        // feePerDay > 0 guarantees an unreturned tool eventually hits the deposit cap, which is
        // what makes claimDefault reachable. feePerDay <= deposit stops a single late day from
        // charging *more* than the deposit — an owner who sets them equal really is saying "one
        // day late and you lose the lot", which is their call, and the browse screen spells out
        // the worst case before anybody commits to it.
        if (deposit == 0 || feePerDay == 0 || feePerDay > deposit) revert BadTerms();
        if (maxDays == 0 || maxDays > MAX_LOAN_DAYS) revert BadDuration();
        if (bytes(metadataURI).length == 0) revert BadTerms();
    }

    function _ownedTool(uint256 toolId) private view returns (Tool storage t) {
        t = tools[toolId];
        if (t.owner != msg.sender) revert NotToolOwner();
        if (t.retired) revert ToolUnavailable();
    }

    function _closeBeforeStart(uint256 loanId, LoanStatus status) private {
        Loan storage l = loans[loanId];
        uint256 deposit = l.deposit;
        address borrower = l.borrower;

        l.status = status;
        tools[l.toolId].activeLoanId = 0;
        members[borrower].openBorrows -= 1;

        emit LoanClosedBeforeStart(loanId, status);

        _payout(borrower, deposit);
    }

    /**
     * @dev Pay, or credit the payee if the token refuses. USDC can blacklist an address, and a
     *      push transfer to a blacklisted borrower would otherwise revert the whole settlement,
     *      freezing the other party's money and the tool along with it. The state machine always
     *      advances; only the money waits, and the payee pulls it with `withdrawCredit`.
     *
     *      Slither flags the credit write as happening after an external call. That's inherent
     *      to "try to pay, book it on failure", and it's safe here: `token` is immutable and is
     *      a real USDC deployment, and every public entry point into this function is
     *      `nonReentrant`.
     */
    function _payout(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, bytes memory ret) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (ok && (ret.length == 0 || abi.decode(ret, (bool)))) return;
        credits[to] += amount;
        emit PayoutDeferred(to, amount);
    }

    /// @dev Any started day counts: one hour late is one day of fee.
    function _lateDays(uint256 dueAt, uint256 endAt) private pure returns (uint32) {
        if (endAt <= dueAt) return 0;
        uint256 days_ = (endAt - dueAt + 1 days - 1) / 1 days;
        // safe: endAt is a timestamp that fits uint40 (callers pass block.timestamp or a
        // stored uint40), so days_ <= 2**40 / 86400 ~= 1.3e7, far below uint32 max.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(days_);
    }

    function _cappedFee(uint256 lateDays, uint256 feePerDay, uint256 deposit) private pure returns (uint256) {
        uint256 fee = lateDays * feePerDay;
        return fee > deposit ? deposit : fee;
    }

    function _settle(uint256 loanId, uint32 lateDays) private {
        Loan storage l = loans[loanId];
        Tool storage t = tools[l.toolId];

        uint256 feeToOwner = _cappedFee(lateDays, l.feePerDay, l.deposit);
        uint256 refund = uint256(l.deposit) - feeToOwner;
        address borrower = l.borrower;
        address owner = t.owner;

        l.status = LoanStatus.Completed;
        t.activeLoanId = 0;

        Member storage b = members[borrower];
        b.loansBorrowed += 1;
        b.openBorrows -= 1;
        if (lateDays > 0) {
            b.lateReturns += 1;
            b.totalLateDays += lateDays;
        }
        members[owner].loansLent += 1;

        emit LoanSettled(loanId, l.toolId, borrower, lateDays, feeToOwner, refund);

        _payout(owner, feeToOwner);
        _payout(borrower, refund);
    }

    function _pageSize(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (offset >= total) return 0;
        uint256 remaining = total - offset;
        return limit < remaining ? limit : remaining;
    }
}
