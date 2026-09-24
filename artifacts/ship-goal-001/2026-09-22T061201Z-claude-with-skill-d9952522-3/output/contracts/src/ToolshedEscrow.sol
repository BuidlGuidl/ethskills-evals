// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ToolshedEscrow
/// @notice Holds the borrower's USDC deposit for one tool loan and settles it when the tool
///         comes back: the owner is paid a daily late fee out of the deposit for every started
///         day past the due date, and the borrower gets whatever is left.
///
/// @dev Scope. This contract holds money and nothing else. Listings, photos, condition notes,
///      member profiles, borrow requests and the reputation ranking all live offchain; they are
///      rebuilt from the `LoanOpened` / `LoanClosed` events plus the association's own database.
///      The only offchain data referenced here is `listingId`, an opaque id the app assigns to a
///      listing, carried through so an indexer can join a loan back to the tool it was for.
contract ToolshedEscrow is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --------------------------------------------------------------------- types

    enum Status {
        None, // never opened
        Active, // deposit escrowed, tool is out
        Disputed, // one party escalated; only the arbiter can close it now
        Closed // settled, funds allocated
    }

    enum Outcome {
        OwnerConfirmed, // owner confirmed the return onchain
        BorrowerReceipt, // borrower closed it with a return receipt the owner signed
        Forfeited, // late fees reached the whole deposit; owner took it
        Arbitrated // the association's arbiter split a disputed deposit
    }

    /// @notice Loan terms the owner signs offchain when they approve a borrow request.
    /// @dev The whole struct is hashed into the loan id, so a signature can only ever open the
    ///      one loan it describes, and only once.
    struct Terms {
        address owner; // member who owns the tool and receives late fees
        address borrower; // member allowed to open this loan
        bytes32 listingId; // offchain listing this loan is for
        uint128 deposit; // USDC (6dp) the borrower escrows; also the cap on late fees
        uint128 dailyLateFee; // USDC (6dp) charged per started day past `dueAt`
        uint64 dueAt; // unix seconds the tool is due back
        uint64 offerExpiry; // unix seconds after which this approval can no longer be used
        uint256 salt; // owner-chosen nonce making otherwise identical terms distinct
    }

    struct Loan {
        address owner;
        address borrower;
        uint128 deposit;
        uint128 dailyLateFee;
        uint64 dueAt;
        uint64 startedAt;
        Status status;
    }

    bytes32 private constant TERMS_TYPEHASH = keccak256(
        "Terms(address owner,address borrower,bytes32 listingId,uint128 deposit,uint128 dailyLateFee,uint64 dueAt,uint64 offerExpiry,uint256 salt)"
    );

    bytes32 private constant RECEIPT_TYPEHASH = keccak256("Receipt(bytes32 loanId,uint64 returnedAt)");

    /// @notice A loan may not be opened for longer than this. Bounds how long a deposit can be
    ///         escrowed before the late-fee clock starts running and the forfeit path unlocks.
    uint64 public constant MAX_LOAN_DURATION = 180 days;

    // --------------------------------------------------------------------- storage

    /// @notice The USDC contract deposits are denominated in. Immutable; redeploy to change it.
    IERC20 public immutable token;

    /// @notice The association's multisig. Its only power is splitting the deposit of a loan that
    ///         one of the two parties has escalated — see `resolve`.
    address public arbiter;
    address public pendingArbiter;

    mapping(bytes32 loanId => Loan) public loans;

    /// @notice Funds owed to a member because a direct transfer to them failed (USDC can freeze
    ///         an address). Claim with `withdraw`. Keeps one frozen party from locking the other
    ///         party's money inside a settlement.
    mapping(address member => uint256) public credited;

    // --------------------------------------------------------------------- events

    event LoanOpened(
        bytes32 indexed loanId,
        address indexed owner,
        address indexed borrower,
        bytes32 listingId,
        uint128 deposit,
        uint128 dailyLateFee,
        uint64 dueAt,
        uint64 startedAt
    );

    event LoanDisputed(bytes32 indexed loanId, address indexed by);

    event LoanClosed(
        bytes32 indexed loanId,
        address indexed owner,
        address indexed borrower,
        Outcome outcome,
        uint64 returnedAt,
        uint256 lateDays,
        uint256 ownerAmount,
        uint256 borrowerAmount
    );

    event PaymentCredited(address indexed member, uint256 amount);
    event Withdrawn(address indexed member, address indexed to, uint256 amount);
    event ArbiterTransferStarted(address indexed from, address indexed to);
    event ArbiterTransferred(address indexed from, address indexed to);

    // --------------------------------------------------------------------- errors

    error ZeroAddress();
    error NotOwner();
    error NotBorrower();
    error NotParty();
    error NotArbiter();
    error BadStatus(Status actual);
    error OfferExpired();
    error DueDateInPast();
    error LoanTooLong();
    error ZeroDeposit();
    error ZeroLateFee();
    error LateFeeAboveDeposit();
    error BadSignature();
    error ReturnInFuture();
    error ReturnBeforeStart();
    error NotFullyForfeited();
    error AmountAboveDeposit();
    error NothingToWithdraw();

    // --------------------------------------------------------------------- setup

    constructor(IERC20 usdc, address arbiter_) EIP712("Toolshed", "1") {
        if (address(usdc) == address(0) || arbiter_ == address(0)) revert ZeroAddress();
        token = usdc;
        arbiter = arbiter_;
        emit ArbiterTransferred(address(0), arbiter_);
    }

    // --------------------------------------------------------------------- opening a loan

    /// @notice Open a loan and escrow the deposit. Called by the borrower, once the owner has
    ///         approved their request by signing `terms` offchain.
    /// @dev One transaction for the whole handover: the owner never pays gas to lend a tool.
    ///      The borrower must have approved this contract for `terms.deposit` USDC first.
    function openLoan(Terms calldata terms, bytes calldata ownerSignature)
        external
        nonReentrant
        returns (bytes32 loanId)
    {
        if (msg.sender != terms.borrower) revert NotBorrower();
        if (terms.owner == address(0)) revert ZeroAddress();
        if (block.timestamp > terms.offerExpiry) revert OfferExpired();
        if (terms.dueAt <= block.timestamp) revert DueDateInPast();
        if (terms.dueAt - block.timestamp > MAX_LOAN_DURATION) revert LoanTooLong();
        if (terms.deposit == 0) revert ZeroDeposit();
        // A zero fee would mean the forfeit path never unlocks, so a silent owner could strand
        // the deposit forever. A fee above the deposit would let one day take the whole thing.
        if (terms.dailyLateFee == 0) revert ZeroLateFee();
        if (terms.dailyLateFee > terms.deposit) revert LateFeeAboveDeposit();

        loanId = hashTerms(terms);
        // A given set of terms opens exactly once; `salt` is what makes a repeat loan distinct.
        if (loans[loanId].status != Status.None) revert BadStatus(loans[loanId].status);

        // SignatureChecker so an owner on a smart wallet (ERC-1271) can approve loans too.
        if (!SignatureChecker.isValidSignatureNow(terms.owner, loanId, ownerSignature)) {
            revert BadSignature();
        }

        loans[loanId] = Loan({
            owner: terms.owner,
            borrower: terms.borrower,
            deposit: terms.deposit,
            dailyLateFee: terms.dailyLateFee,
            dueAt: terms.dueAt,
            startedAt: uint64(block.timestamp),
            status: Status.Active
        });

        emit LoanOpened(
            loanId,
            terms.owner,
            terms.borrower,
            terms.listingId,
            terms.deposit,
            terms.dailyLateFee,
            terms.dueAt,
            uint64(block.timestamp)
        );

        token.safeTransferFrom(msg.sender, address(this), terms.deposit);
    }

    // --------------------------------------------------------------------- closing a loan

    /// @notice Owner confirms the tool is back. Settles at the current block time.
    function confirmReturn(bytes32 loanId) external nonReentrant {
        Loan storage loan = _active(loanId);
        if (msg.sender != loan.owner) revert NotOwner();
        _settle(loanId, loan, uint64(block.timestamp), Outcome.OwnerConfirmed);
    }

    /// @notice Borrower closes the loan using a return receipt the owner signed at handover.
    /// @dev The borrower's protection against an owner who takes the tool back and then goes
    ///      quiet, letting late fees eat the deposit. Ask for the receipt when you hand it over.
    function closeWithReceipt(bytes32 loanId, uint64 returnedAt, bytes calldata ownerSignature)
        external
        nonReentrant
    {
        Loan storage loan = _active(loanId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (returnedAt > block.timestamp) revert ReturnInFuture();
        if (returnedAt < loan.startedAt) revert ReturnBeforeStart();

        bytes32 digest = hashReceipt(loanId, returnedAt);
        if (!SignatureChecker.isValidSignatureNow(loan.owner, digest, ownerSignature)) {
            revert BadSignature();
        }
        _settle(loanId, loan, returnedAt, Outcome.BorrowerReceipt);
    }

    /// @notice Owner takes the whole deposit once late fees have accrued past it — the tool is
    ///         far enough overdue that the deposit is now the compensation.
    /// @dev Requiring a non-zero daily fee at open time guarantees this unlocks in bounded time
    ///      (`ceil(deposit / dailyLateFee)` days after the due date), so a deposit can never be
    ///      escrowed forever by a borrower who simply stops responding.
    function claimForfeit(bytes32 loanId) external nonReentrant {
        Loan storage loan = _active(loanId);
        if (msg.sender != loan.owner) revert NotOwner();
        (uint256 lateDays, uint256 fee) = _accrued(loan, uint64(block.timestamp));
        if (fee < loan.deposit) revert NotFullyForfeited();

        loan.status = Status.Closed;
        uint256 deposit = loan.deposit;
        emit LoanClosed(
            loanId, loan.owner, loan.borrower, Outcome.Forfeited, 0, lateDays, deposit, 0
        );
        _pay(loan.owner, deposit);
    }

    // --------------------------------------------------------------------- disputes

    /// @notice Either party freezes the loan and hands it to the association's arbiter.
    /// @dev Blocks `confirmReturn`, `closeWithReceipt` and `claimForfeit`. A borrower who
    ///      returned a tool to an owner who won't acknowledge it uses this to stop the forfeit
    ///      clock; an owner whose tool came back broken uses it to stop an automatic refund.
    function dispute(bytes32 loanId) external {
        Loan storage loan = _active(loanId);
        if (msg.sender != loan.owner && msg.sender != loan.borrower) revert NotParty();
        loan.status = Status.Disputed;
        emit LoanDisputed(loanId, msg.sender);
    }

    /// @notice Arbiter splits a disputed deposit. This is the contract's only trusted action.
    /// @param ownerAmount USDC paid to the owner; the remainder of the deposit goes back to the
    ///        borrower. The arbiter cannot pay itself, cannot exceed the deposit, and cannot
    ///        touch a loan nobody escalated.
    function resolve(bytes32 loanId, uint256 ownerAmount) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        Loan storage loan = loans[loanId];
        if (loan.status != Status.Disputed) revert BadStatus(loan.status);
        if (ownerAmount > loan.deposit) revert AmountAboveDeposit();

        loan.status = Status.Closed;
        uint256 borrowerAmount = loan.deposit - ownerAmount;
        address owner_ = loan.owner;
        address borrower_ = loan.borrower;

        emit LoanClosed(
            loanId, owner_, borrower_, Outcome.Arbitrated, 0, 0, ownerAmount, borrowerAmount
        );
        if (ownerAmount > 0) _pay(owner_, ownerAmount);
        if (borrowerAmount > 0) _pay(borrower_, borrowerAmount);
    }

    // --------------------------------------------------------------------- money movement

    /// @notice Claim funds that a direct transfer could not deliver.
    function withdraw(address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = credited[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        credited[msg.sender] = 0;
        emit Withdrawn(msg.sender, to, amount);
        token.safeTransfer(to, amount);
    }

    // --------------------------------------------------------------------- arbiter handover

    function transferArbiter(address to) external {
        if (msg.sender != arbiter) revert NotArbiter();
        if (to == address(0)) revert ZeroAddress();
        pendingArbiter = to;
        emit ArbiterTransferStarted(arbiter, to);
    }

    function acceptArbiter() external {
        if (msg.sender != pendingArbiter) revert NotArbiter();
        address previous = arbiter;
        arbiter = msg.sender;
        pendingArbiter = address(0);
        emit ArbiterTransferred(previous, msg.sender);
    }

    // --------------------------------------------------------------------- views

    /// @notice EIP-712 digest the owner signs to approve a borrow request.
    function hashTerms(Terms calldata terms) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TERMS_TYPEHASH,
                    terms.owner,
                    terms.borrower,
                    terms.listingId,
                    terms.deposit,
                    terms.dailyLateFee,
                    terms.dueAt,
                    terms.offerExpiry,
                    terms.salt
                )
            )
        );
    }

    /// @notice EIP-712 digest the owner signs as a return receipt.
    function hashReceipt(bytes32 loanId, uint64 returnedAt) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RECEIPT_TYPEHASH, loanId, returnedAt)));
    }

    /// @notice What the split would be if the tool came back at `returnedAt`.
    /// @dev The UI calls this with `block.timestamp` to show a live "late fees so far" figure.
    function quote(bytes32 loanId, uint64 returnedAt)
        external
        view
        returns (uint256 lateDays, uint256 ownerAmount, uint256 borrowerAmount)
    {
        Loan storage loan = loans[loanId];
        (lateDays, ownerAmount) = _accrued(loan, returnedAt);
        borrowerAmount = loan.deposit - ownerAmount;
    }

    /// @notice The earliest time `claimForfeit` can succeed for a loan.
    function forfeitableAt(bytes32 loanId) external view returns (uint64) {
        Loan storage loan = loans[loanId];
        if (loan.status == Status.None) return 0;
        // `daysNeeded` started days of lateness cover the deposit, and the day counter ticks over
        // one second into each day — so the first forfeitable instant is one second past
        // `daysNeeded - 1` whole days.
        uint256 daysNeeded = _ceilDiv(loan.deposit, loan.dailyLateFee);
        return loan.dueAt + uint64((daysNeeded - 1) * 1 days) + 1;
    }

    function getLoan(bytes32 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // --------------------------------------------------------------------- internals

    function _active(bytes32 loanId) private view returns (Loan storage loan) {
        loan = loans[loanId];
        if (loan.status != Status.Active) revert BadStatus(loan.status);
    }

    /// @dev Late fees accrue per *started* day: one second past the due date costs a full day.
    ///      That is what the association wanted — it is the rule that actually gets tools back.
    ///      Capped at the deposit, which is the borrower's entire exposure.
    function _accrued(Loan storage loan, uint64 returnedAt)
        private
        view
        returns (uint256 lateDays, uint256 fee)
    {
        if (returnedAt <= loan.dueAt) return (0, 0);
        lateDays = _ceilDiv(returnedAt - loan.dueAt, 1 days);
        fee = lateDays * loan.dailyLateFee;
        if (fee > loan.deposit) fee = loan.deposit;
    }

    function _settle(bytes32 loanId, Loan storage loan, uint64 returnedAt, Outcome outcome)
        private
    {
        (uint256 lateDays, uint256 ownerAmount) = _accrued(loan, returnedAt);
        uint256 borrowerAmount = loan.deposit - ownerAmount;
        address owner_ = loan.owner;
        address borrower_ = loan.borrower;

        loan.status = Status.Closed;

        emit LoanClosed(
            loanId, owner_, borrower_, outcome, returnedAt, lateDays, ownerAmount, borrowerAmount
        );
        if (ownerAmount > 0) _pay(owner_, ownerAmount);
        if (borrowerAmount > 0) _pay(borrower_, borrowerAmount);
    }

    /// @dev Pay directly if we can, otherwise credit it for later. USDC can freeze an address,
    ///      and a settlement pays two people — a frozen owner must not block the borrower's
    ///      refund (or vice versa).
    function _pay(address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (ok && (ret.length == 0 || abi.decode(ret, (bool)))) return;
        credited[to] += amount;
        emit PaymentCredited(to, amount);
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return (a + b - 1) / b;
    }
}
