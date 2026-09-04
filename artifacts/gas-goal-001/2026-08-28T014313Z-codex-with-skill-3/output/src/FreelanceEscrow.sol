// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";

/// @title FreelanceEscrow
/// @notice One funded freelance job, settled by client approval or a neutral arbitrator.
/// @dev The factory creates an instance per job. Amounts are token base units.
contract FreelanceEscrow {
    using SafeERC20 for IERC20;

    enum Status {
        AwaitingFunding,
        Funded,
        Submitted,
        Disputed,
        Released,
        Refunded,
        Resolved
    }

    error NotClient();
    error NotFreelancer();
    error NotArbitrator();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidStatus(Status expected, Status actual);
    error Reentrancy();

    IERC20 public immutable paymentToken;
    address public immutable client;
    address public immutable freelancer;
    address public immutable arbitrator;
    uint256 public immutable amount;
    bytes32 public immutable jobReference;

    Status public status;
    bool private locked;

    event Funded(address indexed client, uint256 amount);
    event WorkSubmitted(bytes32 indexed deliverableReference);
    event Released(address indexed freelancer, uint256 amount);
    event Refunded(address indexed client, uint256 amount);
    event Disputed(address indexed raisedBy);
    event DisputeResolved(uint256 freelancerAmount, uint256 clientAmount);

    modifier onlyClient() {
        if (msg.sender != client) revert NotClient();
        _;
    }

    modifier onlyFreelancer() {
        if (msg.sender != freelancer) revert NotFreelancer();
        _;
    }

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert NotArbitrator();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    constructor(
        IERC20 paymentToken_,
        address client_,
        address freelancer_,
        address arbitrator_,
        uint256 amount_,
        bytes32 jobReference_
    ) {
        if (
            address(paymentToken_) == address(0) || client_ == address(0) || freelancer_ == address(0)
                || arbitrator_ == address(0) || client_ == freelancer_
        ) revert InvalidAddress();
        if (amount_ == 0) revert InvalidAmount();

        paymentToken = paymentToken_;
        client = client_;
        freelancer = freelancer_;
        arbitrator = arbitrator_;
        amount = amount_;
        jobReference = jobReference_;
        status = Status.AwaitingFunding;
    }

    /// @notice Client transfers the exact agreed amount after approving this contract.
    function fund() external onlyClient nonReentrant {
        _requireStatus(Status.AwaitingFunding);
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        // Reject fee-on-transfer tokens: an escrow must be fully collateralized.
        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InvalidAmount();
        status = Status.Funded;
        emit Funded(msg.sender, amount);
    }

    /// @notice Freelancer marks delivery complete; client can now approve or dispute.
    function submitWork(bytes32 deliverableReference) external onlyFreelancer {
        _requireStatus(Status.Funded);
        status = Status.Submitted;
        emit WorkSubmitted(deliverableReference);
    }

    /// @notice Client accepts the delivery and pays the freelancer in full.
    function release() external onlyClient nonReentrant {
        _requireStatus(Status.Submitted);
        status = Status.Released;
        paymentToken.safeTransfer(freelancer, amount);
        emit Released(freelancer, amount);
    }

    /// @notice Client cancels before a delivery is submitted.
    function refundBeforeSubmission() external onlyClient nonReentrant {
        _requireStatus(Status.Funded);
        status = Status.Refunded;
        paymentToken.safeTransfer(client, amount);
        emit Refunded(client, amount);
    }

    /// @notice Either party sends a submitted job to arbitration.
    function raiseDispute() external {
        if (msg.sender != client && msg.sender != freelancer) revert NotClient();
        _requireStatus(Status.Submitted);
        status = Status.Disputed;
        emit Disputed(msg.sender);
    }

    /// @notice Arbitrator splits the held funds; the split must total the escrow amount.
    function resolveDispute(uint256 freelancerAmount) external onlyArbitrator nonReentrant {
        _requireStatus(Status.Disputed);
        if (freelancerAmount > amount) revert InvalidAmount();

        uint256 clientAmount = amount - freelancerAmount;
        status = Status.Resolved;
        if (freelancerAmount != 0) paymentToken.safeTransfer(freelancer, freelancerAmount);
        if (clientAmount != 0) paymentToken.safeTransfer(client, clientAmount);
        emit DisputeResolved(freelancerAmount, clientAmount);
    }

    function _requireStatus(Status expected) private view {
        if (status != expected) revert InvalidStatus(expected, status);
    }
}
