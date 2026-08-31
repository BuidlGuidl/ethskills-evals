// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20Metadata is IERC20 {
    function decimals() external view returns (uint8);
}

/// @title FreelanceEscrow
/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
contract FreelanceEscrow {
    enum Status {
        None,
        Funded,
        Delivered,
        Disputed,
        Released,
        Refunded
    }

    struct Job {
        address client;
        address freelancer;
        uint96 amount;
        Status status;
    }

    error ZeroAddress();
    error UnsupportedTokenDecimals();
    error InvalidAmount();
    error JobAlreadyExists();
    error JobNotFound();
    error NotClient();
    error NotFreelancer();
    error NotParty();
    error NotArbitrator();
    error InvalidStatus();
    error TokenTransferFailed();
    error FeeOnTransferTokenNotSupported();
    error InvalidAward();
    error Reentrancy();

    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
    uint256 public constant MAX_ESCROW = 50_000 * 1e6;

    IERC20 public immutable token;
    address public immutable arbitrator;
    uint256 private _locked = 1;

    mapping(bytes32 => Job) public jobs;

    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event WorkDelivered(bytes32 indexed jobId);
    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(IERC20Metadata token_, address arbitrator_) {
        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
        if (token_.decimals() != 6) revert UnsupportedTokenDecimals();
        token = token_;
        arbitrator = arbitrator_;
    }

    /// @notice Funds a new job. The client must first approve this contract for `amount`.
    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
        if (freelancer == address(0)) revert ZeroAddress();
        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();

        uint256 beforeBalance = token.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();

        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
        emit JobFunded(jobId, msg.sender, freelancer, amount);
    }

    function markDelivered(bytes32 jobId) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.freelancer) revert NotFreelancer();
        if (job.status != Status.Funded) revert InvalidStatus();
        job.status = Status.Delivered;
        emit WorkDelivered(jobId);
    }

    /// @notice Client releases the full escrow after accepting delivery.
    function release(bytes32 jobId) external nonReentrant {
        Job storage job = _job(jobId);
        if (msg.sender != job.client) revert NotClient();
        if (job.status != Status.Delivered) revert InvalidStatus();
        job.status = Status.Released;
        _safeTransfer(job.freelancer, job.amount);
        emit FundsReleased(jobId, job.freelancer, job.amount);
    }

    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
    function raiseDispute(bytes32 jobId) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
        job.status = Status.Disputed;
        emit DisputeRaised(jobId, msg.sender);
    }

    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
        if (msg.sender != arbitrator) revert NotArbitrator();
        Job storage job = _job(jobId);
        if (job.status != Status.Disputed) revert InvalidStatus();
        uint256 amount = job.amount;
        if (clientAward > amount) revert InvalidAward();

        job.status = clientAward == amount ? Status.Refunded : Status.Released;
        uint256 freelancerAward = amount - clientAward;
        if (clientAward != 0) _safeTransfer(job.client, clientAward);
        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
        emit DisputeResolved(jobId, clientAward, freelancerAward);
    }

    function _job(bytes32 jobId) private view returns (Job storage job) {
        job = jobs[jobId];
        if (job.status == Status.None) revert JobNotFound();
    }

    function _safeTransfer(address to, uint256 amount) private {
        if (!token.transfer(to, amount)) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
    }
}
