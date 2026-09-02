// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
contract FreelanceEscrow {
    enum Status {
        None,
        Funded,
        Submitted,
        Disputed,
        Released,
        Refunded
    }

    struct Job {
        address client;
        address freelancer;
        address arbiter;
        uint96 amount;
        Status status;
        bytes32 detailsHash;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidStatus();
    error TransferFailed();
    error ReentrantCall();
    error InvalidResolution();

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed freelancer,
        address arbiter,
        uint256 amount,
        bytes32 detailsHash
    );
    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
    event DisputeRaised(
        uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash
    );
    event JobResolved(
        uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount
    );

    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
    uint256 public immutable minAmount;
    uint256 public immutable maxAmount;
    IERC20 public immutable paymentToken;
    uint256 public nextJobId = 1;
    uint256 public totalEscrowed;

    mapping(uint256 jobId => Job job) public jobs;
    uint256 private unlocked = 1;

    modifier nonReentrant() {
        if (unlocked != 1) revert ReentrantCall();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) {
            revert InvalidAddress();
        }
        paymentToken = IERC20(paymentToken_);
        minAmount = minAmount_;
        maxAmount = maxAmount_;
    }

    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
        external
        nonReentrant
        returns (uint256 jobId)
    {
        if (
            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
                || arbiter == msg.sender || arbiter == freelancer
        ) {
            revert InvalidAddress();
        }
        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) {
            revert InvalidAmount();
        }

        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
        uint256 balanceBefore = paymentToken.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) {
            revert TransferFailed();
        }

        jobId = nextJobId++;
        jobs[jobId] = Job({
            client: msg.sender,
            freelancer: freelancer,
            arbiter: arbiter,
            amount: uint96(amount),
            status: Status.Funded,
            detailsHash: detailsHash
        });
        totalEscrowed += amount;
        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
    }

    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
        Job storage job = jobs[jobId];
        if (msg.sender != job.freelancer) revert Unauthorized();
        if (job.status != Status.Funded) revert InvalidStatus();
        job.status = Status.Submitted;
        emit WorkSubmitted(jobId, deliverableHash);
    }

    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
    function release(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (msg.sender != job.client) revert Unauthorized();
        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
        _resolve(jobId, job, Status.Released, job.amount, 0);
    }

    /// @notice Client may cancel only before the freelancer submits work.
    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (msg.sender != job.client) revert Unauthorized();
        if (job.status != Status.Funded) revert InvalidStatus();
        _resolve(jobId, job, Status.Refunded, 0, job.amount);
    }

    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
        Job storage job = jobs[jobId];
        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
        job.status = Status.Disputed;
        emit DisputeRaised(jobId, msg.sender, reasonHash);
    }

    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
        Job storage job = jobs[jobId];
        if (msg.sender != job.arbiter) revert Unauthorized();
        if (job.status != Status.Disputed) revert InvalidStatus();
        if (freelancerAmount > job.amount) revert InvalidResolution();
        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
    }

    function _resolve(
        uint256 jobId,
        Job storage job,
        Status outcome,
        uint256 freelancerAmount,
        uint256 clientAmount
    ) private {
        job.status = outcome;
        totalEscrowed -= job.amount;
        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, bytes memory result) =
            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool ok, bytes memory result) =
            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
    }
}
