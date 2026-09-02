// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title FreelanceEscrow
/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
contract FreelanceEscrow {
    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;

    enum Status {
        Created,
        Funded,
        Accepted,
        Delivered,
        Disputed,
        Released,
        Refunded,
        Cancelled
    }

    IERC20 public immutable usdc;
    address public immutable client;
    address public immutable contractor;
    address public immutable arbiter;
    uint256 public immutable amount;
    Status public status;

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidStatus(Status current);
    error InvalidAward();
    error TokenTransferFailed();
    error IncorrectFundingReceived();

    event Funded(address indexed client, uint256 amount);
    event Accepted(address indexed contractor);
    event DeliveryMarked(address indexed contractor);
    event Released(address indexed client, address indexed contractor, uint256 amount);
    event Cancelled(address indexed client);
    event Refunded(address indexed client, uint256 amount);
    event DisputeRaised(address indexed raisedBy);
    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);

    modifier onlyClient() {
        if (msg.sender != client) revert Unauthorized();
        _;
    }

    modifier onlyContractor() {
        if (msg.sender != contractor) revert Unauthorized();
        _;
    }

    modifier onlyParticipant() {
        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
        _;
    }

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert Unauthorized();
        _;
    }

    constructor(
        IERC20 usdc_,
        address client_,
        address contractor_,
        address arbiter_,
        uint256 amount_
    ) {
        if (
            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
                || arbiter_ == address(0) || client_ == contractor_ || arbiter_ == client_
                || arbiter_ == contractor_
        ) revert InvalidAddress();
        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();

        usdc = usdc_;
        client = client_;
        contractor = contractor_;
        arbiter = arbiter_;
        amount = amount_;
        status = Status.Created;
    }

    /// @notice Client deposits the complete agreed amount after approving this contract.
    function fund() external onlyClient {
        if (status != Status.Created) revert InvalidStatus(status);

        uint256 balanceBefore = usdc.balanceOf(address(this));
        _safeTransferFrom(client, address(this), amount);
        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
            revert IncorrectFundingReceived();
        }

        status = Status.Funded;
        emit Funded(client, amount);
    }

    /// @notice Contractor accepts the funded job before beginning work.
    function acceptJob() external onlyContractor {
        if (status != Status.Funded) revert InvalidStatus(status);
        status = Status.Accepted;
        emit Accepted(contractor);
    }

    /// @notice Contractor confirms that the agreed work has been delivered.
    function markDelivered() external onlyContractor {
        if (status != Status.Accepted) revert InvalidStatus(status);
        status = Status.Delivered;
        emit DeliveryMarked(contractor);
    }

    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
    function release() external onlyClient {
        if (status != Status.Delivered) revert InvalidStatus(status);
        status = Status.Released;
        _safeTransfer(contractor, amount);
        emit Released(client, contractor, amount);
    }

    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
    function cancel() external onlyClient {
        if (status != Status.Created) revert InvalidStatus(status);
        status = Status.Cancelled;
        emit Cancelled(client);
    }

    /// @notice Client recovers funds if the contractor has not yet accepted the funded job.
    function refundUnaccepted() external onlyClient {
        if (status != Status.Funded) revert InvalidStatus(status);
        status = Status.Refunded;
        _safeTransfer(client, amount);
        emit Refunded(client, amount);
    }

    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
    function raiseDispute() external onlyParticipant {
        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
            revert InvalidStatus(status);
        }
        status = Status.Disputed;
        emit DisputeRaised(msg.sender);
    }

    /// @notice Arbiter distributes the full escrow; either award may be zero.
    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
        if (status != Status.Disputed) revert InvalidStatus(status);
        if (clientAward + contractorAward != amount) revert InvalidAward();

        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
        status = clientAward == amount ? Status.Refunded : Status.Released;
        if (clientAward != 0) _safeTransfer(client, clientAward);
        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);

        emit DisputeResolved(arbiter, clientAward, contractorAward);
    }

    function _safeTransfer(address to, uint256 value) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed();
        }
    }

    function _safeTransferFrom(address from, address to, uint256 value) private {
        (bool success, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed();
        }
    }
}
