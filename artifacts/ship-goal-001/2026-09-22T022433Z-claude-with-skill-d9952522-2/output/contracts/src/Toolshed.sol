// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Toolshed
/// @notice Deposit escrow for a neighbourhood association's tool lending library.
///
/// The contract holds exactly one kind of thing: a borrower's USDC deposit for one
/// loan of one tool, and the rule that splits it between borrower and owner when the
/// tool comes back. Listings, photos, condition notes, browse ordering and the
/// reputation numbers all live offchain; they are derived from the events below.
///
/// A loan starts when the borrower funds a deposit against an offer the owner signed
/// offchain (EIP-712), so owners never pay gas to advertise or approve a loan, and
/// declined requests cost nothing. A loan ends in exactly one of four ways, each with
/// a caller who benefits from calling — see the transition table in the README.
contract Toolshed is EIP712 {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                  TYPES
    //////////////////////////////////////////////////////////////*/

    enum Status {
        None,
        Active,
        Settled
    }

    /// @notice Terms the tool's owner signs offchain. The borrower submits it with the deposit.
    /// @param toolId Hash of the offchain listing this loan is for (see README: `toolId`).
    /// @param owner Tool owner, and the signer of this offer.
    /// @param borrower The only address allowed to accept this offer.
    /// @param deposit USDC held in escrow for the duration of the loan (6 decimals).
    /// @param lateFeePerDay USDC charged to the borrower for each started day past `dueAt`.
    /// @param dueAt Unix timestamp the tool is due back.
    /// @param maxLateDays Cap on billable late days; `lateFeePerDay * maxLateDays <= deposit`.
    /// @param offerExpiry Unix timestamp after which the offer can no longer be accepted.
    /// @param nonce Owner-scoped offer nonce, single use, cancellable via `cancelOffer`.
    struct LoanOffer {
        bytes32 toolId;
        address owner;
        address borrower;
        uint256 deposit;
        uint256 lateFeePerDay;
        uint64 dueAt;
        uint32 maxLateDays;
        uint64 offerExpiry;
        uint256 nonce;
    }

    struct Loan {
        bytes32 toolId;
        address owner;
        address borrower;
        uint128 deposit;
        uint128 lateFeePerDay;
        uint64 startedAt;
        uint64 dueAt;
        uint32 maxLateDays;
        uint64 returnedAt;
        Status status;
    }

    /// @notice How a settled loan was closed. Recorded in `LoanSettled` for the record book.
    enum SettlementRoute {
        OwnerConfirmed,
        BorrowerReceipt,
        BorrowerMaxLate,
        StewardResolved
    }

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 private constant LOAN_OFFER_TYPEHASH = keccak256(
        "LoanOffer(bytes32 toolId,address owner,address borrower,uint256 deposit,uint256 lateFeePerDay,uint64 dueAt,uint32 maxLateDays,uint64 offerExpiry,uint256 nonce)"
    );

    bytes32 private constant RETURN_RECEIPT_TYPEHASH =
        keccak256("ReturnReceipt(uint256 loanId,uint64 returnedAt)");

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit token. Immutable: a loan's escrow must settle in the token it was funded in.
    IERC20 public immutable usdc;

    /// @notice The association's steward (a multisig). Manages the roster and arbitrates disputes.
    address public steward;

    /// @notice When paused, no new loans start. In-flight loans always remain settleable.
    bool public newLoansPaused;

    /// @notice Association roster. Checked when a loan starts, never when one settles.
    mapping(address member => bool) public isMember;

    /// @notice Loans by id. Ids start at 1 so that 0 can mean "none".
    mapping(uint256 loanId => Loan) private _loans;

    /// @notice Number of loans ever started, and the highest loan id.
    uint256 public loanCount;

    /// @notice Open loan for a tool, or 0. Stops the same tool being lent out twice at once.
    mapping(bytes32 toolId => uint256 loanId) public activeLoanOf;

    /// @notice Offer nonces already accepted or cancelled, per owner.
    mapping(address owner => mapping(uint256 nonce => bool)) public offerNonceUsed;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event StewardTransferred(address indexed previousSteward, address indexed newSteward);
    event NewLoansPausedSet(bool paused);
    event MemberSet(address indexed member, bool isMember);
    event OfferCancelled(address indexed owner, uint256 nonce);

    event LoanStarted(
        uint256 indexed loanId,
        bytes32 indexed toolId,
        address indexed owner,
        address borrower,
        uint256 deposit,
        uint256 lateFeePerDay,
        uint64 startedAt,
        uint64 dueAt,
        uint32 maxLateDays
    );

    /// @dev The whole offchain record book is derived from this event: loans completed per
    ///      member, late returns per member, days late, and fees paid.
    event LoanSettled(
        uint256 indexed loanId,
        bytes32 indexed toolId,
        address indexed owner,
        address borrower,
        uint64 returnedAt,
        uint32 lateDays,
        uint256 lateFee,
        uint256 refund,
        SettlementRoute route,
        address settledBy
    );

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotSteward();
    error NotOwner();
    error NotBorrower();
    error NewLoansArePaused();
    error NotAMember(address who);
    error OwnerIsBorrower();
    error OfferExpired();
    error OfferNonceUsed();
    error BadSignature();
    error DueDateInPast();
    error ZeroDeposit();
    error DepositTooLarge();
    error NoLateFee();
    error LateFeeExceedsDeposit();
    error ToolAlreadyOnLoan(uint256 loanId);
    error LoanNotActive(uint256 loanId);
    error ReturnInFuture();
    error ReturnBeforeStart();
    error LateDaysAboveCap();
    error TooEarly(uint64 availableAt);
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param usdc_ The USDC contract for the target chain (see README for verified addresses).
    /// @param steward_ The association's steward multisig.
    /// @param initialMembers Founding roster; may be empty and filled in with `setMembers`.
    constructor(IERC20 usdc_, address steward_, address[] memory initialMembers) EIP712("Toolshed", "1") {
        if (address(usdc_) == address(0) || steward_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        steward = steward_;
        emit StewardTransferred(address(0), steward_);
        for (uint256 i; i < initialMembers.length; ++i) {
            _setMember(initialMembers[i], true);
        }
    }

    modifier onlySteward() {
        if (msg.sender != steward) revert NotSteward();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              ADMINISTRATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Hand the steward role to a new address (e.g. after a committee election).
    function transferSteward(address newSteward) external onlySteward {
        if (newSteward == address(0)) revert ZeroAddress();
        emit StewardTransferred(steward, newSteward);
        steward = newSteward;
    }

    /// @notice Add or remove members. Removing a member never touches their in-flight loans.
    function setMembers(address[] calldata members, bool included) external onlySteward {
        for (uint256 i; i < members.length; ++i) {
            _setMember(members[i], included);
        }
    }

    /// @notice Stop new loans from starting. Does not block any settlement path.
    function setNewLoansPaused(bool paused) external onlySteward {
        newLoansPaused = paused;
        emit NewLoansPausedSet(paused);
    }

    function _setMember(address member, bool included) private {
        if (member == address(0)) revert ZeroAddress();
        isMember[member] = included;
        emit MemberSet(member, included);
    }

    /*//////////////////////////////////////////////////////////////
                                  LOANS
    //////////////////////////////////////////////////////////////*/

    /// @notice Invalidate one of your own signed offers before anybody accepts it.
    /// @dev The owner pays this gas to protect themselves; offers also expire on their own.
    function cancelOffer(uint256 nonce) external {
        if (offerNonceUsed[msg.sender][nonce]) revert OfferNonceUsed();
        offerNonceUsed[msg.sender][nonce] = true;
        emit OfferCancelled(msg.sender, nonce);
    }

    /// @notice Borrower accepts an owner-signed offer and funds the deposit. Starts the loan.
    /// @dev Requires the borrower to have approved this contract for `offer.deposit` USDC.
    /// @param offer The terms, exactly as the owner signed them.
    /// @param ownerSignature EIP-712 signature by `offer.owner` (EOA or ERC-1271 smart wallet).
    /// @return loanId The new loan's id.
    function startLoan(LoanOffer calldata offer, bytes calldata ownerSignature)
        external
        returns (uint256 loanId)
    {
        if (newLoansPaused) revert NewLoansArePaused();
        if (msg.sender != offer.borrower) revert NotBorrower();
        if (offer.owner == offer.borrower) revert OwnerIsBorrower();
        if (!isMember[offer.owner]) revert NotAMember(offer.owner);
        if (!isMember[offer.borrower]) revert NotAMember(offer.borrower);
        if (block.timestamp > offer.offerExpiry) revert OfferExpired();
        if (offer.dueAt <= block.timestamp) revert DueDateInPast();
        if (offer.deposit == 0) revert ZeroDeposit();
        if (offer.deposit > type(uint128).max) revert DepositTooLarge();
        if (offer.lateFeePerDay == 0 || offer.maxLateDays == 0) revert NoLateFee();
        // Bounds the worst case for the borrower and guarantees the split below never underflows.
        if (offer.lateFeePerDay * offer.maxLateDays > offer.deposit) revert LateFeeExceedsDeposit();

        uint256 openLoan = activeLoanOf[offer.toolId];
        if (openLoan != 0) revert ToolAlreadyOnLoan(openLoan);

        if (offerNonceUsed[offer.owner][offer.nonce]) revert OfferNonceUsed();
        offerNonceUsed[offer.owner][offer.nonce] = true;

        if (!SignatureChecker.isValidSignatureNow(offer.owner, hashOffer(offer), ownerSignature)) {
            revert BadSignature();
        }

        loanId = ++loanCount;
        _loans[loanId] = Loan({
            toolId: offer.toolId,
            owner: offer.owner,
            borrower: offer.borrower,
            deposit: uint128(offer.deposit),
            lateFeePerDay: uint128(offer.lateFeePerDay),
            startedAt: uint64(block.timestamp),
            dueAt: offer.dueAt,
            maxLateDays: offer.maxLateDays,
            returnedAt: 0,
            status: Status.Active
        });
        activeLoanOf[offer.toolId] = loanId;

        emit LoanStarted(
            loanId,
            offer.toolId,
            offer.owner,
            offer.borrower,
            offer.deposit,
            offer.lateFeePerDay,
            uint64(block.timestamp),
            offer.dueAt,
            offer.maxLateDays
        );

        usdc.safeTransferFrom(offer.borrower, address(this), offer.deposit);
    }

    /// @notice Owner confirms the tool is back. Settles at today's late-day count.
    /// @dev The owner calls this because it pays them any late fee and frees the tool to relist.
    function confirmReturn(uint256 loanId) external {
        Loan storage loan = _requireActive(loanId);
        if (msg.sender != loan.owner) revert NotOwner();
        uint64 returnedAt = uint64(block.timestamp);
        _settle(loanId, loan, returnedAt, lateDaysFor(loan, returnedAt), SettlementRoute.OwnerConfirmed);
    }

    /// @notice Borrower closes the loan with a return receipt the owner signed at handover.
    /// @dev Lets a borrower who returned the tool on time get their deposit back immediately
    ///      without waiting on the owner to send a transaction.
    /// @param returnedAt The handover time the owner signed for; must be in the past.
    function closeWithReceipt(uint256 loanId, uint64 returnedAt, bytes calldata ownerSignature) external {
        Loan storage loan = _requireActive(loanId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (returnedAt > block.timestamp) revert ReturnInFuture();
        if (returnedAt < loan.startedAt) revert ReturnBeforeStart();
        if (!SignatureChecker.isValidSignatureNow(
                loan.owner, hashReturnReceipt(loanId, returnedAt), ownerSignature
            )) revert BadSignature();
        _settle(loanId, loan, returnedAt, lateDaysFor(loan, returnedAt), SettlementRoute.BorrowerReceipt);
    }

    /// @notice Borrower closes an overdue loan once the late fee has hit its cap.
    /// @dev Liveness escape hatch for "the owner stopped answering". Past `dueAt + maxLateDays`
    ///      the split can no longer change, so the owner receives the full capped fee either way
    ///      and the borrower pays gas to recover whatever is left of their deposit. Borrower-only
    ///      on purpose: an owner must not be able to sit on a timely return and then bill the cap.
    function closeAtMaxLateFee(uint256 loanId) external {
        Loan storage loan = _requireActive(loanId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        uint64 availableAt = loan.dueAt + uint64(loan.maxLateDays) * 1 days;
        if (block.timestamp < availableAt) revert TooEarly(availableAt);
        _settle(loanId, loan, uint64(block.timestamp), loan.maxLateDays, SettlementRoute.BorrowerMaxLate);
    }

    /// @notice Steward arbitrates an overdue loan: damaged tool, lost tool, disputed return date.
    /// @dev Deliberately bounded. The steward can only choose how many billable late days to
    ///      charge, between 0 and the cap the owner and borrower already agreed to. It cannot
    ///      redirect the deposit to itself, move funds on a loan that is not yet overdue, or
    ///      charge more than `lateFeePerDay * maxLateDays`.
    function resolve(uint256 loanId, uint32 lateDaysCharged) external onlySteward {
        Loan storage loan = _requireActive(loanId);
        if (block.timestamp <= loan.dueAt) revert TooEarly(loan.dueAt + 1);
        if (lateDaysCharged > loan.maxLateDays) revert LateDaysAboveCap();
        _settle(loanId, loan, uint64(block.timestamp), lateDaysCharged, SettlementRoute.StewardResolved);
    }

    function _settle(
        uint256 loanId,
        Loan storage loan,
        uint64 returnedAt,
        uint32 lateDays,
        SettlementRoute route
    ) private {
        uint256 lateFee = uint256(loan.lateFeePerDay) * lateDays;
        uint256 deposit = loan.deposit;
        // Held by the `LateFeeExceedsDeposit` check in `startLoan` plus the cap on `lateDays`.
        if (lateFee > deposit) lateFee = deposit;
        uint256 refund = deposit - lateFee;

        loan.status = Status.Settled;
        loan.returnedAt = returnedAt;
        activeLoanOf[loan.toolId] = 0;

        address owner_ = loan.owner;
        address borrower_ = loan.borrower;

        emit LoanSettled(
            loanId, loan.toolId, owner_, borrower_, returnedAt, lateDays, lateFee, refund, route, msg.sender
        );

        if (lateFee != 0) usdc.safeTransfer(owner_, lateFee);
        if (refund != 0) usdc.safeTransfer(borrower_, refund);
    }

    function _requireActive(uint256 loanId) private view returns (Loan storage loan) {
        loan = _loans[loanId];
        if (loan.status != Status.Active) revert LoanNotActive(loanId);
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    /// @notice Billable late days if the tool comes back at `returnedAt`.
    /// @dev Any started day counts as a whole day, capped at `maxLateDays`.
    function lateDaysFor(Loan memory loan, uint64 returnedAt) public pure returns (uint32) {
        if (returnedAt <= loan.dueAt) return 0;
        uint256 days_ = Math.ceilDiv(uint256(returnedAt - loan.dueAt), 1 days);
        // forge-lint: disable-next-line(unsafe-typecast) — the branch bounds days_ below maxLateDays.
        return days_ >= loan.maxLateDays ? loan.maxLateDays : uint32(days_);
    }

    /// @notice What an active loan pays out if it settles at `returnedAt`. For the UI.
    function quoteSettlement(uint256 loanId, uint64 returnedAt)
        external
        view
        returns (uint32 lateDays, uint256 lateFee, uint256 refund)
    {
        Loan memory loan = _loans[loanId];
        lateDays = lateDaysFor(loan, returnedAt);
        lateFee = uint256(loan.lateFeePerDay) * lateDays;
        if (lateFee > loan.deposit) lateFee = loan.deposit;
        refund = loan.deposit - lateFee;
    }

    /// @notice EIP-712 digest a tool owner signs to offer a loan.
    function hashOffer(LoanOffer calldata offer) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    LOAN_OFFER_TYPEHASH,
                    offer.toolId,
                    offer.owner,
                    offer.borrower,
                    offer.deposit,
                    offer.lateFeePerDay,
                    offer.dueAt,
                    offer.maxLateDays,
                    offer.offerExpiry,
                    offer.nonce
                )
            )
        );
    }

    /// @notice EIP-712 digest a tool owner signs to acknowledge a return.
    function hashReturnReceipt(uint256 loanId, uint64 returnedAt) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RETURN_RECEIPT_TYPEHASH, loanId, returnedAt)));
    }

    /// @notice EIP-712 domain separator, for offchain signers.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
