// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20Metadata {
    function decimals() external view returns (uint8);
}

/// @notice Non-custodial escrow for one USD-stablecoin-denominated freelance job.
/// @dev Deploy one instance per job. This contract supports tokens with 6 decimals,
///      e.g. USDC, so the $2,000-$50,000 limits can be expressed on-chain.
contract FreelanceEscrow {
    uint256 public constant MIN_AMOUNT = 2_000 * 1e6;
    uint256 public constant MAX_AMOUNT = 50_000 * 1e6;

    enum Status { AwaitingFunding, Funded, Disputed, Released, Refunded, Resolved }

    IERC20 public immutable paymentToken;
    address public immutable client;
    address public immutable freelancer;
    address public immutable arbitrator;
    uint256 public immutable amount;
    Status public status;

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidTokenDecimals(uint8 decimals);
    error InvalidStatus(Status current);
    error TransferFailed();
    error IncorrectFundingAmount(uint256 received);
    error InvalidSplit();

    event Funded(address indexed client, uint256 amount);
    event Released(address indexed freelancer, uint256 amount);
    event Refunded(address indexed client, uint256 amount);
    event Disputed(address indexed raisedBy);
    event Resolved(uint256 freelancerAmount, uint256 clientAmount);

    constructor(address token_, address client_, address freelancer_, address arbitrator_, uint256 amount_) {
        if (token_ == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
            revert InvalidAddress();
        }
        if (IERC20Metadata(token_).decimals() != 6) revert InvalidTokenDecimals(IERC20Metadata(token_).decimals());
        if (client_ == freelancer_ || amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
        paymentToken = IERC20(token_);
        client = client_;
        freelancer = freelancer_;
        arbitrator = arbitrator_;
        amount = amount_;
    }

    /// @notice Client funds the job after approving exactly `amount` tokens.
    function fund() external {
        if (msg.sender != client) revert Unauthorized();
        if (status != Status.AwaitingFunding) revert InvalidStatus(status);

        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        _safeTransferFrom(client, address(this), amount);
        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert IncorrectFundingAmount(received);

        status = Status.Funded;
        emit Funded(client, amount);
    }

    /// @notice Client accepts delivered work and pays the freelancer.
    function release() external {
        if (msg.sender != client) revert Unauthorized();
        if (status != Status.Funded) revert InvalidStatus(status);
        status = Status.Released;
        _safeTransfer(freelancer, amount);
        emit Released(freelancer, amount);
    }

    /// @notice Freelancer or client can signal a disagreement while funds are held.
    function raiseDispute() external {
        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
        if (status != Status.Funded) revert InvalidStatus(status);
        status = Status.Disputed;
        emit Disputed(msg.sender);
    }

    /// @notice Arbitrator settles a dispute, optionally splitting the escrow.
    /// @param freelancerAmount Amount sent to freelancer; the remainder goes to client.
    function resolveDispute(uint256 freelancerAmount) external {
        if (msg.sender != arbitrator) revert Unauthorized();
        if (status != Status.Disputed) revert InvalidStatus(status);
        if (freelancerAmount > amount) revert InvalidSplit();

        status = Status.Resolved;
        uint256 clientAmount = amount - freelancerAmount;
        if (freelancerAmount != 0) _safeTransfer(freelancer, freelancerAmount);
        if (clientAmount != 0) _safeTransfer(client, clientAmount);
        emit Resolved(freelancerAmount, clientAmount);
    }

    /// @notice Client can cancel an unfunded job. No token movement occurs.
    function cancelUnfunded() external {
        if (msg.sender != client) revert Unauthorized();
        if (status != Status.AwaitingFunding) revert InvalidStatus(status);
        status = Status.Refunded;
        emit Refunded(client, 0);
    }

    function _safeTransfer(address to, uint256 value) private {
        if (!paymentToken.transfer(to, value)) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 value) private {
        if (!paymentToken.transferFrom(from, to, value)) revert TransferFailed();
    }
}
