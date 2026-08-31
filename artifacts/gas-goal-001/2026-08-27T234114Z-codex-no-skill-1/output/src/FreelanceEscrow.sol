// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";

/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
contract FreelanceEscrow {
    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)

    enum Status {
        AwaitingFunding,
        Funded,
        Delivered,
        Resolved,
        Cancelled
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidStatus(Status expected, Status actual);
    error DeadlineNotReached();
    error InvalidResolution();
    error Reentrancy();
    error TokenTransferFailed();
    error UnsupportedToken();

    event Funded(address indexed client, uint256 amount);
    event WorkDelivered(address indexed freelancer, string deliveryReference);
    event Released(address indexed freelancer, uint256 amount);
    event Refunded(address indexed client, uint256 amount);
    event DisputeResolved(
        uint256 clientAmount, uint256 freelancerAmount, string resolutionReference
    );
    event Cancelled(address indexed client);

    IERC20 public immutable usdc;
    address public immutable client;
    address public immutable freelancer;
    address public immutable arbiter;
    uint256 public immutable amount;
    uint256 public immutable refundDeadline;

    Status public status;
    uint256 private locked = 1;

    modifier onlyClient() {
        if (msg.sender != client) revert Unauthorized();
        _;
    }

    modifier onlyFreelancer() {
        if (msg.sender != freelancer) revert Unauthorized();
        _;
    }

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(
        IERC20 usdc_,
        address client_,
        address freelancer_,
        address arbiter_,
        uint256 amount_,
        uint256 refundDeadline_
    ) {
        if (
            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
                || freelancer_ == arbiter_
        ) revert InvalidAddress();
        if (usdc_.decimals() != 6) revert UnsupportedToken();
        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();

        usdc = usdc_;
        client = client_;
        freelancer = freelancer_;
        arbiter = arbiter_;
        amount = amount_;
        refundDeadline = refundDeadline_;
        status = Status.AwaitingFunding;
    }

    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
    function fund() external onlyClient nonReentrant {
        _requireStatus(Status.AwaitingFunding);
        uint256 beforeBalance = usdc.balanceOf(address(this));
        _safeTransferFrom(client, address(this), amount);
        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
        status = Status.Funded;
        emit Funded(client, amount);
    }

    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
        _requireStatus(Status.Funded);
        status = Status.Delivered;
        emit WorkDelivered(freelancer, deliveryReference);
    }

    /// @notice Client accepts the delivered work and releases the entire balance.
    function release() external onlyClient nonReentrant {
        _requireStatus(Status.Delivered);
        status = Status.Resolved;
        _payout(freelancer, amount);
        emit Released(freelancer, amount);
    }

    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
    function refundAfterDeadline() external onlyClient nonReentrant {
        Status current = status;
        if (current != Status.Funded && current != Status.Delivered) {
            revert InvalidStatus(Status.Funded, current);
        }
        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
        status = Status.Resolved;
        _payout(client, amount);
        emit Refunded(client, amount);
    }

    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
        external
        onlyArbiter
        nonReentrant
    {
        Status current = status;
        if (current != Status.Funded && current != Status.Delivered) {
            revert InvalidStatus(Status.Funded, current);
        }
        if (clientAmount > amount) revert InvalidResolution();

        uint256 freelancerAmount = amount - clientAmount;
        status = Status.Resolved;
        if (clientAmount != 0) _payout(client, clientAmount);
        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
    }

    /// @notice Cancels an unfunded job. No party can change its terms after creation.
    function cancelUnfunded() external onlyClient {
        _requireStatus(Status.AwaitingFunding);
        status = Status.Cancelled;
        emit Cancelled(client);
    }

    function _payout(address recipient, uint256 payoutAmount) private {
        _safeTransfer(recipient, payoutAmount);
    }

    function _safeTransfer(address recipient, uint256 payoutAmount) private {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transfer, (recipient, payoutAmount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
        (bool ok, bytes memory data) = address(usdc)
            .call(abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _requireStatus(Status expected) private view {
        if (status != expected) revert InvalidStatus(expected, status);
    }
}

