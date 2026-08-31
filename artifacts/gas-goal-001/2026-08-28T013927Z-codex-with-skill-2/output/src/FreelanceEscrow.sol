// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title FreelanceEscrow
/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
contract FreelanceEscrow {
    enum Status {
        Created,
        Funded,
        Delivered,
        Disputed,
        Released,
        Refunded,
        Cancelled
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidStatus(Status expected, Status actual);
    error TransferFailed();
    error UnsupportedToken();
    error ReentrantCall();

    IERC20 public immutable token;
    address public immutable client;
    address public immutable freelancer;
    address public immutable arbitrator;
    uint256 public immutable amount;
    uint256 public immutable fundingDeadline;
    bytes32 public immutable jobReference;

    Status public status;
    uint256 private locked = 1;

    event Funded(address indexed client, uint256 amount);
    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
    event Released(address indexed freelancer, uint256 amount);
    event Refunded(address indexed client, uint256 amount);
    event Disputed(address indexed raisedBy, bytes32 reasonReference);
    event Resolved(
        address indexed arbitrator,
        address indexed recipient,
        uint256 amount,
        bytes32 resolutionReference
    );
    event Cancelled(address indexed client);

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(
        IERC20 token_,
        address client_,
        address freelancer_,
        address arbitrator_,
        uint256 amount_,
        uint256 fundingDeadline_,
        bytes32 jobReference_
    ) {
        if (
            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
                || arbitrator_ == address(0)
        ) {
            revert InvalidAddress();
        }
        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) {
            revert InvalidAddress();
        }
        if (amount_ == 0) revert InvalidAmount();
        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();

        token = token_;
        client = client_;
        freelancer = freelancer_;
        arbitrator = arbitrator_;
        amount = amount_;
        fundingDeadline = fundingDeadline_;
        jobReference = jobReference_;
    }

    /// @notice Client deposits the agreed amount after approving this escrow.
    function fund() external nonReentrant {
        if (msg.sender != client) revert Unauthorized();
        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
        if (block.timestamp > fundingDeadline) revert InvalidDeadline();

        uint256 balanceBefore = token.balanceOf(address(this));
        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();

        status = Status.Funded;
        emit Funded(client, amount);
    }

    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
    function markDelivered(bytes32 deliverableReference) external {
        if (msg.sender != freelancer) revert Unauthorized();
        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);

        status = Status.Delivered;
        emit WorkDelivered(freelancer, deliverableReference);
    }

    /// @notice Client accepts the work and pays the freelancer.
    function release() external nonReentrant {
        if (msg.sender != client) revert Unauthorized();
        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);

        status = Status.Released;
        _pay(freelancer);
        emit Released(freelancer, amount);
    }

    /// @notice Either party escalates a funded engagement to the designated arbitrator.
    function dispute(bytes32 reasonReference) external {
        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
        if (status != Status.Funded && status != Status.Delivered) {
            revert InvalidStatus(Status.Funded, status);
        }

        status = Status.Disputed;
        emit Disputed(msg.sender, reasonReference);
    }

    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
        if (msg.sender != arbitrator) revert Unauthorized();
        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
        if (recipient != client && recipient != freelancer) revert Unauthorized();

        status = recipient == freelancer ? Status.Released : Status.Refunded;
        _pay(recipient);
        emit Resolved(arbitrator, recipient, amount, resolutionReference);
    }

    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
    function cancel() external {
        if (msg.sender != client) revert Unauthorized();
        if (status != Status.Created) revert InvalidStatus(Status.Created, status);

        status = Status.Cancelled;
        emit Cancelled(client);
    }

    function _pay(address recipient) private {
        if (!token.transfer(recipient, amount)) revert TransferFailed();
    }
}
