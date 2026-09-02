// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title FreelanceEscrow
/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
contract FreelanceEscrow {
    uint256 public constant MIN_ESCROW = 2_000e6;
    uint256 public constant MAX_ESCROW = 50_000e6;

    enum Status {
        Funded,
        Delivered,
        Disputed,
        Resolved
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidState(Status expected, Status actual);
    error TransferFailed();
    error Reentrancy();

    IERC20 public immutable token;
    address public immutable client;
    address public immutable freelancer;
    address public immutable arbitrator;
    uint256 public immutable amount;
    bytes32 public immutable jobId;
    Status public status;
    bool private locked;

    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
    event DisputeResolved(bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI);

    modifier onlyClient() {
        if (msg.sender != client) revert Unauthorized();
        _;
    }

    modifier onlyParty() {
        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    constructor(
        IERC20 token_,
        address client_,
        address freelancer_,
        address arbitrator_,
        uint256 amount_,
        bytes32 jobId_
    ) {
        if (
            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
                || arbitrator_ == address(0) || client_ == freelancer_
        ) revert InvalidAddress();
        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();

        token = token_;
        client = client_;
        freelancer = freelancer_;
        arbitrator = arbitrator_;
        amount = amount_;
        jobId = jobId_;
        status = Status.Funded;
    }

    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
    function markDelivered(string calldata deliverableURI) external {
        if (msg.sender != freelancer) revert Unauthorized();
        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
        status = Status.Delivered;
        emit WorkDelivered(jobId, deliverableURI);
    }

    /// @notice Releases the entire escrow to the freelancer after delivery.
    function releaseToFreelancer() external onlyClient nonReentrant {
        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
        status = Status.Resolved;
        _send(freelancer, amount);
        emit PaymentReleased(jobId, freelancer, amount);
    }

    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
    function refundClient() external onlyClient nonReentrant {
        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
        status = Status.Resolved;
        _send(client, amount);
        emit PaymentRefunded(jobId, client, amount);
    }

    /// @notice Escalates the engagement to the agreed independent arbitrator.
    function openDispute(string calldata evidenceURI) external onlyParty {
        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
        status = Status.Disputed;
        emit DisputeOpened(jobId, msg.sender, evidenceURI);
    }

    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
        external
        nonReentrant
    {
        if (msg.sender != arbitrator) revert Unauthorized();
        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();

        status = Status.Resolved;
        if (clientAmount != 0) _send(client, clientAmount);
        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
    }

    function _send(address recipient, uint256 value) private {
        if (!token.transfer(recipient, value)) revert TransferFailed();
    }
}
