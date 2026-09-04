// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FreelanceEscrow
/// @notice Non-custodial-style job escrow for a 6-decimal USD stablecoin (for example native USDC).
/// @dev The owner can pause new activity but has no function to withdraw or resolve job funds.
contract FreelanceEscrow is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant TOKEN_DECIMALS = 6;
    uint256 public constant MIN_JOB_AMOUNT = 2_000 * 10 ** TOKEN_DECIMALS;
    uint256 public constant MAX_JOB_AMOUNT = 50_000 * 10 ** TOKEN_DECIMALS;

    enum Status {
        Created,
        AwaitingFunding,
        Funded,
        Disputed,
        Released,
        Refunded,
        Cancelled
    }

    struct Escrow {
        address client;
        address freelancer;
        address arbitrator;
        uint64 deadline;
        uint96 amount;
        Status status;
        address proposalRecipient;
        address proposalMaker;
    }

    IERC20 public immutable PAYMENT_TOKEN;
    address public immutable PAUSE_GUARDIAN;
    uint256 public nextEscrowId;
    mapping(uint256 escrowId => Escrow) private escrows;

    error AmountOutOfRange();
    error InvalidAddress();
    error InvalidDeadline();
    error EscrowNotFound();
    error InvalidStatus(Status expected, Status actual);
    error NotClient();
    error NotFreelancer();
    error NotParty();
    error NotArbitrator();
    error FundingDeadlinePassed();
    error NoProposal();
    error ProposerCannotAccept();
    error InvalidRecipient();
    error TransferAmountMismatch();
    error OnlyGuardianOrOwner();
    error UnsupportedTokenDecimals(uint8 decimals);

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed client,
        address indexed freelancer,
        address arbitrator,
        uint256 amount,
        uint64 deadline
    );
    event JobAccepted(uint256 indexed escrowId);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event PayoutProposed(uint256 indexed escrowId, address indexed proposer, address indexed recipient);
    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
    event EscrowSettled(uint256 indexed escrowId, uint256 clientAmount, uint256 freelancerAmount, Status status);
    event EscrowCancelled(uint256 indexed escrowId);

    constructor(IERC20 paymentToken_, address pauseGuardian_) Ownable(msg.sender) {
        if (address(paymentToken_) == address(0) || pauseGuardian_ == address(0)) revert InvalidAddress();
        uint8 decimals = IERC20Metadata(address(paymentToken_)).decimals();
        if (decimals != TOKEN_DECIMALS) revert UnsupportedTokenDecimals(decimals);
        PAYMENT_TOKEN = paymentToken_;
        PAUSE_GUARDIAN = pauseGuardian_;
    }

    function createEscrow(address freelancer, address arbitrator, uint256 amount, uint64 deadline)
        external
        whenNotPaused
        returns (uint256 escrowId)
    {
        if (
            freelancer == address(0) || arbitrator == address(0) || freelancer == msg.sender || arbitrator == msg.sender
                || arbitrator == freelancer
        ) {
            revert InvalidAddress();
        }
        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert AmountOutOfRange();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            client: msg.sender,
            freelancer: freelancer,
            arbitrator: arbitrator,
            deadline: deadline,
            // Safe: `amount` is capped at 50,000e6, far below type(uint96).max.
            // forge-lint: disable-next-line(unsafe-typecast)
            amount: uint96(amount),
            status: Status.Created,
            proposalRecipient: address(0),
            proposalMaker: address(0)
        });
        emit EscrowCreated(escrowId, msg.sender, freelancer, arbitrator, amount, deadline);
    }

    /// @notice Freelancer agrees to the named job terms. The client may fund only after this step.
    function acceptJob(uint256 escrowId) external whenNotPaused {
        Escrow storage escrow = _escrow(escrowId);
        if (msg.sender != escrow.freelancer) revert NotFreelancer();
        _requireStatus(escrow, Status.Created);
        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();
        escrow.status = Status.AwaitingFunding;
        emit JobAccepted(escrowId);
    }

    function fundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage escrow = _escrow(escrowId);
        if (msg.sender != escrow.client) revert NotClient();
        _requireStatus(escrow, Status.AwaitingFunding);
        if (block.timestamp >= escrow.deadline) revert FundingDeadlinePassed();

        uint256 balanceBefore = PAYMENT_TOKEN.balanceOf(address(this));
        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), escrow.amount);
        if (PAYMENT_TOKEN.balanceOf(address(this)) != balanceBefore + escrow.amount) revert TransferAmountMismatch();
        escrow.status = Status.Funded;
        emit EscrowFunded(escrowId, escrow.amount);
    }

    /// @notice The client releases the entire escrow after satisfactory delivery.
    function releaseToFreelancer(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage escrow = _escrow(escrowId);
        if (msg.sender != escrow.client) revert NotClient();
        _requireStatus(escrow, Status.Funded);
        _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
    }

    /// @notice Either party can propose paying the full amount to either party; the other party accepts it.
    function proposePayout(uint256 escrowId, address recipient) external whenNotPaused {
        Escrow storage escrow = _escrow(escrowId);
        _requireStatus(escrow, Status.Funded);
        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
        if (recipient != escrow.client && recipient != escrow.freelancer) revert InvalidRecipient();
        escrow.proposalMaker = msg.sender;
        escrow.proposalRecipient = recipient;
        emit PayoutProposed(escrowId, msg.sender, recipient);
    }

    function acceptPayout(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage escrow = _escrow(escrowId);
        _requireStatus(escrow, Status.Funded);
        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
        if (escrow.proposalMaker == address(0)) revert NoProposal();
        if (msg.sender == escrow.proposalMaker) revert ProposerCannotAccept();

        if (escrow.proposalRecipient == escrow.client) {
            _settle(escrowId, escrow, escrow.amount, 0, Status.Refunded);
        } else {
            _settle(escrowId, escrow, 0, escrow.amount, Status.Released);
        }
    }

    function raiseDispute(uint256 escrowId) external whenNotPaused {
        Escrow storage escrow = _escrow(escrowId);
        _requireStatus(escrow, Status.Funded);
        if (msg.sender != escrow.client && msg.sender != escrow.freelancer) revert NotParty();
        escrow.status = Status.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }

    /// @notice The job's pre-selected arbitrator may award a full or split payout after a dispute.
    function resolveDispute(uint256 escrowId, uint256 clientAmount, uint256 freelancerAmount)
        external
        whenNotPaused
        nonReentrant
    {
        Escrow storage escrow = _escrow(escrowId);
        if (msg.sender != escrow.arbitrator) revert NotArbitrator();
        _requireStatus(escrow, Status.Disputed);
        if (clientAmount + freelancerAmount != escrow.amount) revert TransferAmountMismatch();
        Status finalStatus = freelancerAmount == 0 ? Status.Refunded : Status.Released;
        _settle(escrowId, escrow, clientAmount, freelancerAmount, finalStatus);
    }

    /// @notice Client can cancel only before funds are deposited.
    function cancelUnfunded(uint256 escrowId) external whenNotPaused {
        Escrow storage escrow = _escrow(escrowId);
        if (msg.sender != escrow.client) revert NotClient();
        if (escrow.status != Status.Created && escrow.status != Status.AwaitingFunding) {
            revert InvalidStatus(Status.Created, escrow.status);
        }
        escrow.status = Status.Cancelled;
        emit EscrowCancelled(escrowId);
    }

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return _escrow(escrowId);
    }

    function pause() external {
        if (msg.sender != owner() && msg.sender != PAUSE_GUARDIAN) revert OnlyGuardianOrOwner();
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _settle(
        uint256 escrowId,
        Escrow storage escrow,
        uint256 clientAmount,
        uint256 freelancerAmount,
        Status status
    ) private {
        escrow.status = status;
        escrow.proposalMaker = address(0);
        escrow.proposalRecipient = address(0);
        if (clientAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.client, clientAmount);
        if (freelancerAmount != 0) PAYMENT_TOKEN.safeTransfer(escrow.freelancer, freelancerAmount);
        emit EscrowSettled(escrowId, clientAmount, freelancerAmount, status);
    }

    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
        if (escrowId >= nextEscrowId) revert EscrowNotFound();
        return escrows[escrowId];
    }

    function _requireStatus(Escrow storage escrow, Status expected) private view {
        if (escrow.status != expected) revert InvalidStatus(expected, escrow.status);
    }
}
