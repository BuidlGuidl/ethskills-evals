Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019fed0d-3f45-7f81-bfc8-8ef6f7f5d668
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
2026-08-10T19:01:36.449790Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019fed0d-3f45-7f81-bfc8-8ef6f7f5d668.tmp-1786388496242610821: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the workspace first, then build a deployable escrow project with tests and a concise deployment recommendation. I’ll treat the payment amounts as stablecoin-denominated, since holding $2k–$50k directly in volatile native ETH would make the escrow value drift.
exec
/bin/bash -lc "pwd && rg --files -g '"'!node_modules'"' -g '"'!lib'"' | sed -n '1,160p' && find . -maxdepth 2 -type d -print | sed -n '1,80p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace
 succeeded in 5ms:
TASK.md
.
./.codex
./.git
./.agents

codex
The workspace is intentionally bare, so I’m using Foundry: it keeps the Solidity project small, makes deployment scripts straightforward, and supports strong fuzz/invariant-style testing. The design will use one contract for many jobs, an arbiter per job, exact ERC-20 accounting, explicit delivery/approval, timeout refunds, and dispute resolution.
exec
/bin/bash -lc 'forge --version && solc --version || true' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace
 succeeded in 149ms:
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..82921440fc33dc8ddb24f60039f628a56c9ad182
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,70 @@
+# Freelance Escrow
+
+A fixed-price freelance escrow for a single ERC-20 stablecoin. Each job records a client,
+freelancer, independent arbiter, delivery deadline, review window, amount, and hash of the
+off-chain terms. The deployment script sets the permitted range to **2,000–50,000 tokens**
+assuming a 6-decimal token such as native USDC.
+
+## How it works
+
+1. The client approves the escrow contract, then calls `createJob`. Funds move into escrow.
+2. The freelancer accepts and submits a hash/URI commitment for the deliverable by the deadline.
+3. The client approves payment, or the freelancer claims it after the review window.
+4. If delivery is late, the client can refund. Either party can instead open a dispute; only the
+   job's named arbiter can resolve it, with any split whose sum equals the escrow amount.
+5. A client can cancel only before the freelancer accepts.
+
+Keep the actual contract, scope, acceptance criteria, and deliverable encrypted/off-chain; put
+only their hash in `termsHash` or `deliverableHash`. Events and hashes are public forever.
+
+## Build and test
+
+Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```sh
+forge fmt --check
+forge test
+```
+
+## Deploy
+
+I would first deploy to **Base Sepolia**, test the complete client/freelancer/arbiter flow, then
+deploy to **Base mainnet using native USDC**. Base has low transaction fees, established USDC
+liquidity, and Ethereum-compatible tooling. For real funds, use a hardware-wallet-backed deployer,
+independently verify token and arbiter addresses, verify the source, and obtain a professional
+security audit. This contract is not upgradeable; a new audited deployment is preferable to an
+admin capable of changing escrow rules.
+
+The script assumes a 6-decimal token. Set `PAYMENT_TOKEN` to the chain's official native USDC
+contract (do not use a bridged look-alike), plus your RPC URL and funded deployer key:
+
+```sh
+export PAYMENT_TOKEN=0x...  # verify on Circle's official address list
+export PRIVATE_KEY=0x...   # use a disposable test key on testnet
+export RPC_URL=https://...
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+For mainnet, prefer a hardware wallet or Foundry keystore rather than leaving a private key in
+shell history. After deployment, verify with the explorer using the exact constructor arguments:
+
+```sh
+forge verify-contract <ESCROW_ADDRESS> src/FreelanceEscrow.sol:FreelanceEscrow \
+  --chain base \
+  --constructor-args $(cast abi-encode "constructor(address,uint256,uint256)" \
+    "$PAYMENT_TOKEN" 2000000000 50000000000)
+```
+
+Before accepting production deposits, test cancellation, deadline refund, automatic post-review
+claim, and both full and split dispute outcomes on Base Sepolia. The arbiter is trusted to allocate
+disputed funds, so use a neutral, operationally secure address and document its policy in the terms.
+
+## Important limitations
+
+- This is unaudited reference software, not legal advice. Escrow and dispute-resolution services
+  can trigger licensing, sanctions-screening, tax, consumer-protection, and money-transmission rules.
+- Fee-on-transfer, rebasing, callback-enabled, or blocklisted tokens may break expected accounting.
+  Deploy only with the exact stablecoin reviewed during an audit.
+- Stablecoins carry issuer freeze/depeg risk. The contract cannot recover accidentally sent tokens
+  and has no administrator or emergency pause.
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8fed372be9fb172f79a7b79fe4eea73b2e3de5b
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        uint256 privateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(privateKey);
+        escrow = new FreelanceEscrow(IERC20(token), 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5af0ec88c4998e9e9f796609dd156ee57f462d74
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,230 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, single-token escrow for fixed-price freelance jobs.
+/// @dev The configured token should be a plain, non-rebasing stablecoin without transfer fees.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Active,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 reviewPeriod;
+        uint64 submittedAt;
+        Status status;
+        bytes32 termsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidReviewPeriod();
+    error InvalidState();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error InvalidSplit();
+    error TransferFailed();
+    error ReentrantCall();
+
+    IERC20 public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+
+    mapping(uint256 => Job) public jobs;
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    );
+    event JobAccepted(uint256 indexed jobId);
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 reasonHash);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event ClientRefunded(uint256 indexed jobId, uint256 amount);
+    event JobCancelled(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token, uint256 minAmount, uint256 maxAmount) {
+        if (address(token) == address(0)) revert InvalidAddress();
+        if (minAmount == 0 || maxAmount < minAmount || maxAmount > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minAmount;
+        maximumAmount = maxAmount;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint128 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+        if (reviewPeriod == 0) revert InvalidReviewPeriod();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            reviewPeriod: reviewPeriod,
+            submittedAt: 0,
+            status: Status.Funded,
+            termsHash: termsHash
+        });
+
+        _safeTransferFrom(msg.sender, address(this), amount);
+        emit JobCreated(
+            jobId,
+            msg.sender,
+            freelancer,
+            arbiter,
+            amount,
+            deliveryDeadline,
+            reviewPeriod,
+            termsHash
+        );
+    }
+
+    function acceptJob(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Active;
+        emit JobAccepted(jobId);
+    }
+
+    function cancelUnacceptedJob(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        job.status = Status.Cancelled;
+        _safeTransfer(job.client, job.amount);
+        emit JobCancelled(jobId, job.amount);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp > job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        if (block.timestamp < uint256(job.submittedAt) + job.reviewPeriod) {
+            revert DeadlineNotPassed();
+        }
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit ClientRefunded(jobId, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active && job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The arbiter assigns the escrowed amount between both parties.
+    function resolveDispute(uint256 jobId, uint128 clientAmount, uint128 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidState();
+        if (uint256(clientAmount) + freelancerAmount != job.amount) revert InvalidSplit();
+
+        job.status = Status.Released;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..301cdb268acd3e7715a7dd461c442507e6a2387f
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address sender) external;
+    function warp(uint256 timestamp) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF33);
+    address private constant ARBITER = address(0xA8B);
+    uint128 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testHappyPath() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, keccak256("ipfs deliverable"));
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(_jobStatus(id)) == uint8(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testFreelancerClaimsAfterReviewWindow() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.claimAfterReview(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _createAndAccept();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = _createAndAccept();
+        vm.prank(CLIENT);
+        escrow.raiseDispute(id, keccak256("scope disagreement"));
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 4_000e6, 6_000e6);
+        require(token.balanceOf(CLIENT) == 4_000e6, "bad client split");
+        require(token.balanceOf(FREELANCER) == 6_000e6, "bad freelancer split");
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days), 2 days, 0);
+    }
+
+    function testCannotClaimBeforeReviewEnds() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.DeadlineNotPassed.selector);
+        escrow.claimAfterReview(id);
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        vm.prank(CLIENT);
+        id = escrow.createJob(
+            FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days), 2 days, keccak256("terms")
+        );
+        vm.prank(FREELANCER);
+        escrow.acceptJob(id);
+    }
+
+    function _jobStatus(uint256 id) private view returns (FreelanceEscrow.Status status) {
+        (,,,,,,, status,) = escrow.jobs(id);
+    }
+}
+

diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..82921440fc33dc8ddb24f60039f628a56c9ad182
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,70 @@
+# Freelance Escrow
+
+A fixed-price freelance escrow for a single ERC-20 stablecoin. Each job records a client,
+freelancer, independent arbiter, delivery deadline, review window, amount, and hash of the
+off-chain terms. The deployment script sets the permitted range to **2,000–50,000 tokens**
+assuming a 6-decimal token such as native USDC.
+
+## How it works
+
+1. The client approves the escrow contract, then calls `createJob`. Funds move into escrow.
+2. The freelancer accepts and submits a hash/URI commitment for the deliverable by the deadline.
+3. The client approves payment, or the freelancer claims it after the review window.
+4. If delivery is late, the client can refund. Either party can instead open a dispute; only the
+   job's named arbiter can resolve it, with any split whose sum equals the escrow amount.
+5. A client can cancel only before the freelancer accepts.
+
+Keep the actual contract, scope, acceptance criteria, and deliverable encrypted/off-chain; put
+only their hash in `termsHash` or `deliverableHash`. Events and hashes are public forever.
+
+## Build and test
+
+Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```sh
+forge fmt --check
+forge test
+```
+
+## Deploy
+
+I would first deploy to **Base Sepolia**, test the complete client/freelancer/arbiter flow, then
+deploy to **Base mainnet using native USDC**. Base has low transaction fees, established USDC
+liquidity, and Ethereum-compatible tooling. For real funds, use a hardware-wallet-backed deployer,
+independently verify token and arbiter addresses, verify the source, and obtain a professional
+security audit. This contract is not upgradeable; a new audited deployment is preferable to an
+admin capable of changing escrow rules.
+
+The script assumes a 6-decimal token. Set `PAYMENT_TOKEN` to the chain's official native USDC
+contract (do not use a bridged look-alike), plus your RPC URL and funded deployer key:
+
+```sh
+export PAYMENT_TOKEN=0x...  # verify on Circle's official address list
+export PRIVATE_KEY=0x...   # use a disposable test key on testnet
+export RPC_URL=https://...
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+For mainnet, prefer a hardware wallet or Foundry keystore rather than leaving a private key in
+shell history. After deployment, verify with the explorer using the exact constructor arguments:
+
+```sh
+forge verify-contract <ESCROW_ADDRESS> src/FreelanceEscrow.sol:FreelanceEscrow \
+  --chain base \
+  --constructor-args $(cast abi-encode "constructor(address,uint256,uint256)" \
+    "$PAYMENT_TOKEN" 2000000000 50000000000)
+```
+
+Before accepting production deposits, test cancellation, deadline refund, automatic post-review
+claim, and both full and split dispute outcomes on Base Sepolia. The arbiter is trusted to allocate
+disputed funds, so use a neutral, operationally secure address and document its policy in the terms.
+
+## Important limitations
+
+- This is unaudited reference software, not legal advice. Escrow and dispute-resolution services
+  can trigger licensing, sanctions-screening, tax, consumer-protection, and money-transmission rules.
+- Fee-on-transfer, rebasing, callback-enabled, or blocklisted tokens may break expected accounting.
+  Deploy only with the exact stablecoin reviewed during an audit.
+- Stablecoins carry issuer freeze/depeg risk. The contract cannot recover accidentally sent tokens
+  and has no administrator or emergency pause.
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8fed372be9fb172f79a7b79fe4eea73b2e3de5b
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        uint256 privateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(privateKey);
+        escrow = new FreelanceEscrow(IERC20(token), 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5af0ec88c4998e9e9f796609dd156ee57f462d74
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,230 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, single-token escrow for fixed-price freelance jobs.
+/// @dev The configured token should be a plain, non-rebasing stablecoin without transfer fees.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Active,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 reviewPeriod;
+        uint64 submittedAt;
+        Status status;
+        bytes32 termsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidReviewPeriod();
+    error InvalidState();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error InvalidSplit();
+    error TransferFailed();
+    error ReentrantCall();
+
+    IERC20 public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+
+    mapping(uint256 => Job) public jobs;
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    );
+    event JobAccepted(uint256 indexed jobId);
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 reasonHash);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event ClientRefunded(uint256 indexed jobId, uint256 amount);
+    event JobCancelled(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token, uint256 minAmount, uint256 maxAmount) {
+        if (address(token) == address(0)) revert InvalidAddress();
+        if (minAmount == 0 || maxAmount < minAmount || maxAmount > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minAmount;
+        maximumAmount = maxAmount;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint128 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+        if (reviewPeriod == 0) revert InvalidReviewPeriod();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            reviewPeriod: reviewPeriod,
+            submittedAt: 0,
+            status: Status.Funded,
+            termsHash: termsHash
+        });
+
+        _safeTransferFrom(msg.sender, address(this), amount);
+        emit JobCreated(
+            jobId,
+            msg.sender,
+            freelancer,
+            arbiter,
+            amount,
+            deliveryDeadline,
+            reviewPeriod,
+            termsHash
+        );
+    }
+
+    function acceptJob(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Active;
+        emit JobAccepted(jobId);
+    }
+
+    function cancelUnacceptedJob(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        job.status = Status.Cancelled;
+        _safeTransfer(job.client, job.amount);
+        emit JobCancelled(jobId, job.amount);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp > job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        if (block.timestamp < uint256(job.submittedAt) + job.reviewPeriod) {
+            revert DeadlineNotPassed();
+        }
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit ClientRefunded(jobId, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active && job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The arbiter assigns the escrowed amount between both parties.
+    function resolveDispute(uint256 jobId, uint128 clientAmount, uint128 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidState();
+        if (uint256(clientAmount) + freelancerAmount != job.amount) revert InvalidSplit();
+
+        job.status = Status.Released;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..301cdb268acd3e7715a7dd461c442507e6a2387f
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address sender) external;
+    function warp(uint256 timestamp) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF33);
+    address private constant ARBITER = address(0xA8B);
+    uint128 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testHappyPath() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, keccak256("ipfs deliverable"));
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(_jobStatus(id)) == uint8(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testFreelancerClaimsAfterReviewWindow() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.claimAfterReview(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _createAndAccept();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = _createAndAccept();
+        vm.prank(CLIENT);
+        escrow.raiseDispute(id, keccak256("scope disagreement"));
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 4_000e6, 6_000e6);
+        require(token.balanceOf(CLIENT) == 4_000e6, "bad client split");
+        require(token.balanceOf(FREELANCER) == 6_000e6, "bad freelancer split");
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days), 2 days, 0);
+    }
+
+    function testCannotClaimBeforeReviewEnds() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.DeadlineNotPassed.selector);
+        escrow.claimAfterReview(id);
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        vm.prank(CLIENT);
+        id = escrow.createJob(
+            FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days), 2 days, keccak256("terms")
+        );
+        vm.prank(FREELANCER);
+        escrow.acceptJob(id);
+    }
+
+    function _jobStatus(uint256 id) private view returns (FreelanceEscrow.Status status) {
+        (,,,,,,, status,) = escrow.jobs(id);
+    }
+}
+

codex
The implementation is in place. I’m validating formatting, compilation, and the major money-flow paths now; I’m also checking that the deployment constructor and documented limits match the six-decimal USDC assumption exactly.
exec
/bin/bash -lc 'forge fmt --check && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace
 exited 1 in 11ms:
Diff in src/FreelanceEscrow.sol:
214 214  |     }
215 215  | 
216 216  |     function _safeTransfer(address to, uint256 amount) private {
217      |-        (bool ok, bytes memory data) = address(paymentToken).call(
218      |-            abi.encodeCall(IERC20.transfer, (to, amount))
219      |-        );
    217  |+        (bool ok, bytes memory data) =
    218  |+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
220 219  |         if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
221 220  |     }
222 221  | 
223 222  |     function _safeTransferFrom(address from, address to, uint256 amount) private {
224      |-        (bool ok, bytes memory data) = address(paymentToken).call(
225      |-            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
226      |-        );
    223  |+        (bool ok, bytes memory data) =
    224  |+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
227 225  |         if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
228 226  |     }
229 227  | }

Diff in test/FreelanceEscrow.t.sol:
13  13   |     mapping(address => uint256) public balanceOf;
14  14   |     mapping(address => mapping(address => uint256)) public allowance;
15  15   | 
16       |-    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    16   |+    function mint(address to, uint256 amount) external {
    17   |+        balanceOf[to] += amount;
    18   |+    }
    19   |+
17  20   |     function approve(address spender, uint256 amount) external returns (bool) {
18  21   |         allowance[msg.sender][spender] = amount;
19  22   |         return true;
20  23   |     }
    24   |+
21  25   |     function transfer(address to, uint256 amount) external returns (bool) {
22  26   |         balanceOf[msg.sender] -= amount;
23  27   |         balanceOf[to] += amount;
24  28   |         return true;
25  29   |     }
    30   |+
26  31   |     function transferFrom(address from, address to, uint256 amount) external returns (bool) {
27  32   |         allowance[from][msg.sender] -= amount;
28  33   |         balanceOf[from] -= amount;
--------------------------------------------------------------------------------106 111  |     function _createAndAccept() private returns (uint256 id) {
107 112  |         vm.prank(CLIENT);
108 113  |         id = escrow.createJob(
109      |-            FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days), 2 days, keccak256("terms")
    114  |+            FREELANCER,
    115  |+            ARBITER,
    116  |+            AMOUNT,
    117  |+            uint64(block.timestamp + 7 days),
    118  |+            2 days,
    119  |+            keccak256("terms")
110 120  |         );
111 121  |         vm.prank(FREELANCER);
112 122  |         escrow.acceptJob(id);

diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..82921440fc33dc8ddb24f60039f628a56c9ad182
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,70 @@
+# Freelance Escrow
+
+A fixed-price freelance escrow for a single ERC-20 stablecoin. Each job records a client,
+freelancer, independent arbiter, delivery deadline, review window, amount, and hash of the
+off-chain terms. The deployment script sets the permitted range to **2,000–50,000 tokens**
+assuming a 6-decimal token such as native USDC.
+
+## How it works
+
+1. The client approves the escrow contract, then calls `createJob`. Funds move into escrow.
+2. The freelancer accepts and submits a hash/URI commitment for the deliverable by the deadline.
+3. The client approves payment, or the freelancer claims it after the review window.
+4. If delivery is late, the client can refund. Either party can instead open a dispute; only the
+   job's named arbiter can resolve it, with any split whose sum equals the escrow amount.
+5. A client can cancel only before the freelancer accepts.
+
+Keep the actual contract, scope, acceptance criteria, and deliverable encrypted/off-chain; put
+only their hash in `termsHash` or `deliverableHash`. Events and hashes are public forever.
+
+## Build and test
+
+Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```sh
+forge fmt --check
+forge test
+```
+
+## Deploy
+
+I would first deploy to **Base Sepolia**, test the complete client/freelancer/arbiter flow, then
+deploy to **Base mainnet using native USDC**. Base has low transaction fees, established USDC
+liquidity, and Ethereum-compatible tooling. For real funds, use a hardware-wallet-backed deployer,
+independently verify token and arbiter addresses, verify the source, and obtain a professional
+security audit. This contract is not upgradeable; a new audited deployment is preferable to an
+admin capable of changing escrow rules.
+
+The script assumes a 6-decimal token. Set `PAYMENT_TOKEN` to the chain's official native USDC
+contract (do not use a bridged look-alike), plus your RPC URL and funded deployer key:
+
+```sh
+export PAYMENT_TOKEN=0x...  # verify on Circle's official address list
+export PRIVATE_KEY=0x...   # use a disposable test key on testnet
+export RPC_URL=https://...
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+For mainnet, prefer a hardware wallet or Foundry keystore rather than leaving a private key in
+shell history. After deployment, verify with the explorer using the exact constructor arguments:
+
+```sh
+forge verify-contract <ESCROW_ADDRESS> src/FreelanceEscrow.sol:FreelanceEscrow \
+  --chain base \
+  --constructor-args $(cast abi-encode "constructor(address,uint256,uint256)" \
+    "$PAYMENT_TOKEN" 2000000000 50000000000)
+```
+
+Before accepting production deposits, test cancellation, deadline refund, automatic post-review
+claim, and both full and split dispute outcomes on Base Sepolia. The arbiter is trusted to allocate
+disputed funds, so use a neutral, operationally secure address and document its policy in the terms.
+
+## Important limitations
+
+- This is unaudited reference software, not legal advice. Escrow and dispute-resolution services
+  can trigger licensing, sanctions-screening, tax, consumer-protection, and money-transmission rules.
+- Fee-on-transfer, rebasing, callback-enabled, or blocklisted tokens may break expected accounting.
+  Deploy only with the exact stablecoin reviewed during an audit.
+- Stablecoins carry issuer freeze/depeg risk. The contract cannot recover accidentally sent tokens
+  and has no administrator or emergency pause.
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8fed372be9fb172f79a7b79fe4eea73b2e3de5b
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        uint256 privateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(privateKey);
+        escrow = new FreelanceEscrow(IERC20(token), 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5af0ec88c4998e9e9f796609dd156ee57f462d74
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,230 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, single-token escrow for fixed-price freelance jobs.
+/// @dev The configured token should be a plain, non-rebasing stablecoin without transfer fees.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Active,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 reviewPeriod;
+        uint64 submittedAt;
+        Status status;
+        bytes32 termsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidReviewPeriod();
+    error InvalidState();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error InvalidSplit();
+    error TransferFailed();
+    error ReentrantCall();
+
+    IERC20 public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+
+    mapping(uint256 => Job) public jobs;
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    );
+    event JobAccepted(uint256 indexed jobId);
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 reasonHash);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event ClientRefunded(uint256 indexed jobId, uint256 amount);
+    event JobCancelled(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token, uint256 minAmount, uint256 maxAmount) {
+        if (address(token) == address(0)) revert InvalidAddress();
+        if (minAmount == 0 || maxAmount < minAmount || maxAmount > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minAmount;
+        maximumAmount = maxAmount;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint128 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+        if (reviewPeriod == 0) revert InvalidReviewPeriod();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            reviewPeriod: reviewPeriod,
+            submittedAt: 0,
+            status: Status.Funded,
+            termsHash: termsHash
+        });
+
+        _safeTransferFrom(msg.sender, address(this), amount);
+        emit JobCreated(
+            jobId,
+            msg.sender,
+            freelancer,
+            arbiter,
+            amount,
+            deliveryDeadline,
+            reviewPeriod,
+            termsHash
+        );
+    }
+
+    function acceptJob(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Active;
+        emit JobAccepted(jobId);
+    }
+
+    function cancelUnacceptedJob(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        job.status = Status.Cancelled;
+        _safeTransfer(job.client, job.amount);
+        emit JobCancelled(jobId, job.amount);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp > job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        if (block.timestamp < uint256(job.submittedAt) + job.reviewPeriod) {
+            revert DeadlineNotPassed();
+        }
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit ClientRefunded(jobId, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active && job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The arbiter assigns the escrowed amount between both parties.
+    function resolveDispute(uint256 jobId, uint128 clientAmount, uint128 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidState();
+        if (uint256(clientAmount) + freelancerAmount != job.amount) revert InvalidSplit();
+
+        job.status = Status.Released;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..301cdb268acd3e7715a7dd461c442507e6a2387f
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address sender) external;
+    function warp(uint256 timestamp) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF33);
+    address private constant ARBITER = address(0xA8B);
+    uint128 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testHappyPath() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, keccak256("ipfs deliverable"));
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(_jobStatus(id)) == uint8(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testFreelancerClaimsAfterReviewWindow() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.claimAfterReview(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _createAndAccept();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = _createAndAccept();
+        vm.prank(CLIENT);
+        escrow.raiseDispute(id, keccak256("scope disagreement"));
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 4_000e6, 6_000e6);
+        require(token.balanceOf(CLIENT) == 4_000e6, "bad client split");
+        require(token.balanceOf(FREELANCER) == 6_000e6, "bad freelancer split");
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days), 2 days, 0);
+    }
+
+    function testCannotClaimBeforeReviewEnds() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.DeadlineNotPassed.selector);
+        escrow.claimAfterReview(id);
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        vm.prank(CLIENT);
+        id = escrow.createJob(
+            FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days), 2 days, keccak256("terms")
+        );
+        vm.prank(FREELANCER);
+        escrow.acceptJob(id);
+    }
+
+    function _jobStatus(uint256 id) private view returns (FreelanceEscrow.Status status) {
+        (,,,,,,, status,) = escrow.jobs(id);
+    }
+}
+

2026-08-10T19:03:39.899920Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
exec
/bin/bash -lc 'forge fmt && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace
 succeeded in 330ms:
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 263.42ms
Compiler run successful!
2026-08-10T19:03:49.744508Z  WARN evm::traces::external: etherscan config not found

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDispute() (gas: 207986)
[PASS] testCannotClaimBeforeReviewEnds() (gas: 193196)
[PASS] testClientRefundsMissedDeadline() (gas: 176210)
[PASS] testFreelancerClaimsAfterReviewWindow() (gas: 199949)
[PASS] testHappyPath() (gas: 201896)
[PASS] testRejectsAmountBelowMinimum() (gas: 14864)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 1.12ms (1.95ms CPU time)

Ran 1 test suite in 9.33ms (1.12ms CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
2026-08-10T19:03:49.754715Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..82921440fc33dc8ddb24f60039f628a56c9ad182
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,70 @@
+# Freelance Escrow
+
+A fixed-price freelance escrow for a single ERC-20 stablecoin. Each job records a client,
+freelancer, independent arbiter, delivery deadline, review window, amount, and hash of the
+off-chain terms. The deployment script sets the permitted range to **2,000–50,000 tokens**
+assuming a 6-decimal token such as native USDC.
+
+## How it works
+
+1. The client approves the escrow contract, then calls `createJob`. Funds move into escrow.
+2. The freelancer accepts and submits a hash/URI commitment for the deliverable by the deadline.
+3. The client approves payment, or the freelancer claims it after the review window.
+4. If delivery is late, the client can refund. Either party can instead open a dispute; only the
+   job's named arbiter can resolve it, with any split whose sum equals the escrow amount.
+5. A client can cancel only before the freelancer accepts.
+
+Keep the actual contract, scope, acceptance criteria, and deliverable encrypted/off-chain; put
+only their hash in `termsHash` or `deliverableHash`. Events and hashes are public forever.
+
+## Build and test
+
+Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```sh
+forge fmt --check
+forge test
+```
+
+## Deploy
+
+I would first deploy to **Base Sepolia**, test the complete client/freelancer/arbiter flow, then
+deploy to **Base mainnet using native USDC**. Base has low transaction fees, established USDC
+liquidity, and Ethereum-compatible tooling. For real funds, use a hardware-wallet-backed deployer,
+independently verify token and arbiter addresses, verify the source, and obtain a professional
+security audit. This contract is not upgradeable; a new audited deployment is preferable to an
+admin capable of changing escrow rules.
+
+The script assumes a 6-decimal token. Set `PAYMENT_TOKEN` to the chain's official native USDC
+contract (do not use a bridged look-alike), plus your RPC URL and funded deployer key:
+
+```sh
+export PAYMENT_TOKEN=0x...  # verify on Circle's official address list
+export PRIVATE_KEY=0x...   # use a disposable test key on testnet
+export RPC_URL=https://...
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+For mainnet, prefer a hardware wallet or Foundry keystore rather than leaving a private key in
+shell history. After deployment, verify with the explorer using the exact constructor arguments:
+
+```sh
+forge verify-contract <ESCROW_ADDRESS> src/FreelanceEscrow.sol:FreelanceEscrow \
+  --chain base \
+  --constructor-args $(cast abi-encode "constructor(address,uint256,uint256)" \
+    "$PAYMENT_TOKEN" 2000000000 50000000000)
+```
+
+Before accepting production deposits, test cancellation, deadline refund, automatic post-review
+claim, and both full and split dispute outcomes on Base Sepolia. The arbiter is trusted to allocate
+disputed funds, so use a neutral, operationally secure address and document its policy in the terms.
+
+## Important limitations
+
+- This is unaudited reference software, not legal advice. Escrow and dispute-resolution services
+  can trigger licensing, sanctions-screening, tax, consumer-protection, and money-transmission rules.
+- Fee-on-transfer, rebasing, callback-enabled, or blocklisted tokens may break expected accounting.
+  Deploy only with the exact stablecoin reviewed during an audit.
+- Stablecoins carry issuer freeze/depeg risk. The contract cannot recover accidentally sent tokens
+  and has no administrator or emergency pause.
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8fed372be9fb172f79a7b79fe4eea73b2e3de5b
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        uint256 privateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(privateKey);
+        escrow = new FreelanceEscrow(IERC20(token), 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5af0ec88c4998e9e9f796609dd156ee57f462d74
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,230 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, single-token escrow for fixed-price freelance jobs.
+/// @dev The configured token should be a plain, non-rebasing stablecoin without transfer fees.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Active,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 reviewPeriod;
+        uint64 submittedAt;
+        Status status;
+        bytes32 termsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidReviewPeriod();
+    error InvalidState();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error InvalidSplit();
+    error TransferFailed();
+    error ReentrantCall();
+
+    IERC20 public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+
+    mapping(uint256 => Job) public jobs;
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    );
+    event JobAccepted(uint256 indexed jobId);
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 reasonHash);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event ClientRefunded(uint256 indexed jobId, uint256 amount);
+    event JobCancelled(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token, uint256 minAmount, uint256 maxAmount) {
+        if (address(token) == address(0)) revert InvalidAddress();
+        if (minAmount == 0 || maxAmount < minAmount || maxAmount > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minAmount;
+        maximumAmount = maxAmount;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint128 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+        if (reviewPeriod == 0) revert InvalidReviewPeriod();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            reviewPeriod: reviewPeriod,
+            submittedAt: 0,
+            status: Status.Funded,
+            termsHash: termsHash
+        });
+
+        _safeTransferFrom(msg.sender, address(this), amount);
+        emit JobCreated(
+            jobId,
+            msg.sender,
+            freelancer,
+            arbiter,
+            amount,
+            deliveryDeadline,
+            reviewPeriod,
+            termsHash
+        );
+    }
+
+    function acceptJob(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Active;
+        emit JobAccepted(jobId);
+    }
+
+    function cancelUnacceptedJob(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        job.status = Status.Cancelled;
+        _safeTransfer(job.client, job.amount);
+        emit JobCancelled(jobId, job.amount);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp > job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        if (block.timestamp < uint256(job.submittedAt) + job.reviewPeriod) {
+            revert DeadlineNotPassed();
+        }
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit ClientRefunded(jobId, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active && job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The arbiter assigns the escrowed amount between both parties.
+    function resolveDispute(uint256 jobId, uint128 clientAmount, uint128 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidState();
+        if (uint256(clientAmount) + freelancerAmount != job.amount) revert InvalidSplit();
+
+        job.status = Status.Released;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..301cdb268acd3e7715a7dd461c442507e6a2387f
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address sender) external;
+    function warp(uint256 timestamp) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF33);
+    address private constant ARBITER = address(0xA8B);
+    uint128 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testHappyPath() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, keccak256("ipfs deliverable"));
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(_jobStatus(id)) == uint8(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testFreelancerClaimsAfterReviewWindow() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.claimAfterReview(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _createAndAccept();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = _createAndAccept();
+        vm.prank(CLIENT);
+        escrow.raiseDispute(id, keccak256("scope disagreement"));
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 4_000e6, 6_000e6);
+        require(token.balanceOf(CLIENT) == 4_000e6, "bad client split");
+        require(token.balanceOf(FREELANCER) == 6_000e6, "bad freelancer split");
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days), 2 days, 0);
+    }
+
+    function testCannotClaimBeforeReviewEnds() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.DeadlineNotPassed.selector);
+        escrow.claimAfterReview(id);
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        vm.prank(CLIENT);
+        id = escrow.createJob(
+            FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days), 2 days, keccak256("terms")
+        );
+        vm.prank(FREELANCER);
+        escrow.acceptJob(id);
+    }
+
+    function _jobStatus(uint256 id) private view returns (FreelanceEscrow.Status status) {
+        (,,,,,,, status,) = escrow.jobs(id);
+    }
+}
+

2026-08-10T19:03:49.800012Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
exec
/bin/bash -lc 'git status --short && git diff --check && forge build --sizes' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace
 succeeded in 199ms:
?? ../../../../.pnp.cjs
?? ../../../../.pnp.loader.mjs
?? ../../../building-blocks-quiz-001/
?? ../../../building-blocks-quiz-002/
?? ../../2026-08-10T185641Z-codex-no-skill-1/
?? ../../2026-08-10T185814Z-codex-no-skill-2/
?? ../
Compiling 1 files with Solc 0.8.20
Solc 0.8.20 finished in 134.99ms
Compiler run successful!

╭-----------------+------------------+-------------------+--------------------+---------------------╮
| Contract        | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+===================================================================================================+
| Deploy          | 6,303            | 6,332             | 18,273             | 42,820              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| FreelanceEscrow | 5,186            | 5,497             | 19,390             | 43,655              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| MockToken       | 941              | 970               | 23,635             | 48,182              |
╰-----------------+------------------+-------------------+--------------------+---------------------╯

2026-08-10T19:03:58.239455Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/Deploy.s.sol:14:25
   |
14 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:40:25
   |
40 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:48:29
   |
48 |     IERC20 public immutable paymentToken;
   |                             ^^^^^^^^^^^^ help: consider using: `PAYMENT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:49:30
   |
49 |     uint256 public immutable minimumAmount;
   |                              ^^^^^^^^^^^^^ help: consider using: `MINIMUM_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:50:30
   |
50 |     uint256 public immutable maximumAmount;
   |                              ^^^^^^^^^^^^^ help: consider using: `MAXIMUM_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:74:5
   |
74 | /     modifier nonReentrant() {
75 | |         if (locked != 1) revert ReentrantCall();
76 | |         locked = 2;
77 | |         _;
78 | |         locked = 1;
79 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
74 ~     modifier nonReentrant() {
75 +         _nonReentrantBefore();
76 +         _;
77 +         _nonReentrantAfter();
78 +     }
79 + 
80 +     function _nonReentrantBefore() internal {
81 +         if (locked != 1) revert ReentrantCall();
82 +         locked = 2;
83 +     }
84 + 
85 +     function _nonReentrantAfter() internal {
86 +         locked = 1;
87 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic


diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..82921440fc33dc8ddb24f60039f628a56c9ad182
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,70 @@
+# Freelance Escrow
+
+A fixed-price freelance escrow for a single ERC-20 stablecoin. Each job records a client,
+freelancer, independent arbiter, delivery deadline, review window, amount, and hash of the
+off-chain terms. The deployment script sets the permitted range to **2,000–50,000 tokens**
+assuming a 6-decimal token such as native USDC.
+
+## How it works
+
+1. The client approves the escrow contract, then calls `createJob`. Funds move into escrow.
+2. The freelancer accepts and submits a hash/URI commitment for the deliverable by the deadline.
+3. The client approves payment, or the freelancer claims it after the review window.
+4. If delivery is late, the client can refund. Either party can instead open a dispute; only the
+   job's named arbiter can resolve it, with any split whose sum equals the escrow amount.
+5. A client can cancel only before the freelancer accepts.
+
+Keep the actual contract, scope, acceptance criteria, and deliverable encrypted/off-chain; put
+only their hash in `termsHash` or `deliverableHash`. Events and hashes are public forever.
+
+## Build and test
+
+Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```sh
+forge fmt --check
+forge test
+```
+
+## Deploy
+
+I would first deploy to **Base Sepolia**, test the complete client/freelancer/arbiter flow, then
+deploy to **Base mainnet using native USDC**. Base has low transaction fees, established USDC
+liquidity, and Ethereum-compatible tooling. For real funds, use a hardware-wallet-backed deployer,
+independently verify token and arbiter addresses, verify the source, and obtain a professional
+security audit. This contract is not upgradeable; a new audited deployment is preferable to an
+admin capable of changing escrow rules.
+
+The script assumes a 6-decimal token. Set `PAYMENT_TOKEN` to the chain's official native USDC
+contract (do not use a bridged look-alike), plus your RPC URL and funded deployer key:
+
+```sh
+export PAYMENT_TOKEN=0x...  # verify on Circle's official address list
+export PRIVATE_KEY=0x...   # use a disposable test key on testnet
+export RPC_URL=https://...
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+For mainnet, prefer a hardware wallet or Foundry keystore rather than leaving a private key in
+shell history. After deployment, verify with the explorer using the exact constructor arguments:
+
+```sh
+forge verify-contract <ESCROW_ADDRESS> src/FreelanceEscrow.sol:FreelanceEscrow \
+  --chain base \
+  --constructor-args $(cast abi-encode "constructor(address,uint256,uint256)" \
+    "$PAYMENT_TOKEN" 2000000000 50000000000)
+```
+
+Before accepting production deposits, test cancellation, deadline refund, automatic post-review
+claim, and both full and split dispute outcomes on Base Sepolia. The arbiter is trusted to allocate
+disputed funds, so use a neutral, operationally secure address and document its policy in the terms.
+
+## Important limitations
+
+- This is unaudited reference software, not legal advice. Escrow and dispute-resolution services
+  can trigger licensing, sanctions-screening, tax, consumer-protection, and money-transmission rules.
+- Fee-on-transfer, rebasing, callback-enabled, or blocklisted tokens may break expected accounting.
+  Deploy only with the exact stablecoin reviewed during an audit.
+- Stablecoins carry issuer freeze/depeg risk. The contract cannot recover accidentally sent tokens
+  and has no administrator or emergency pause.
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8fed372be9fb172f79a7b79fe4eea73b2e3de5b
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        uint256 privateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(privateKey);
+        escrow = new FreelanceEscrow(IERC20(token), 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5af0ec88c4998e9e9f796609dd156ee57f462d74
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,230 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, single-token escrow for fixed-price freelance jobs.
+/// @dev The configured token should be a plain, non-rebasing stablecoin without transfer fees.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Active,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 reviewPeriod;
+        uint64 submittedAt;
+        Status status;
+        bytes32 termsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidReviewPeriod();
+    error InvalidState();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error InvalidSplit();
+    error TransferFailed();
+    error ReentrantCall();
+
+    IERC20 public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+
+    mapping(uint256 => Job) public jobs;
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    );
+    event JobAccepted(uint256 indexed jobId);
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 reasonHash);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event ClientRefunded(uint256 indexed jobId, uint256 amount);
+    event JobCancelled(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token, uint256 minAmount, uint256 maxAmount) {
+        if (address(token) == address(0)) revert InvalidAddress();
+        if (minAmount == 0 || maxAmount < minAmount || maxAmount > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minAmount;
+        maximumAmount = maxAmount;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint128 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+        if (reviewPeriod == 0) revert InvalidReviewPeriod();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            reviewPeriod: reviewPeriod,
+            submittedAt: 0,
+            status: Status.Funded,
+            termsHash: termsHash
+        });
+
+        _safeTransferFrom(msg.sender, address(this), amount);
+        emit JobCreated(
+            jobId,
+            msg.sender,
+            freelancer,
+            arbiter,
+            amount,
+            deliveryDeadline,
+            reviewPeriod,
+            termsHash
+        );
+    }
+
+    function acceptJob(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Active;
+        emit JobAccepted(jobId);
+    }
+
+    function cancelUnacceptedJob(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        job.status = Status.Cancelled;
+        _safeTransfer(job.client, job.amount);
+        emit JobCancelled(jobId, job.amount);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp > job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        if (block.timestamp < uint256(job.submittedAt) + job.reviewPeriod) {
+            revert DeadlineNotPassed();
+        }
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit ClientRefunded(jobId, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active && job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The arbiter assigns the escrowed amount between both parties.
+    function resolveDispute(uint256 jobId, uint128 clientAmount, uint128 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidState();
+        if (uint256(clientAmount) + freelancerAmount != job.amount) revert InvalidSplit();
+
+        job.status = Status.Released;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..301cdb268acd3e7715a7dd461c442507e6a2387f
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address sender) external;
+    function warp(uint256 timestamp) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF33);
+    address private constant ARBITER = address(0xA8B);
+    uint128 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testHappyPath() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, keccak256("ipfs deliverable"));
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(_jobStatus(id)) == uint8(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testFreelancerClaimsAfterReviewWindow() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.claimAfterReview(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _createAndAccept();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = _createAndAccept();
+        vm.prank(CLIENT);
+        escrow.raiseDispute(id, keccak256("scope disagreement"));
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 4_000e6, 6_000e6);
+        require(token.balanceOf(CLIENT) == 4_000e6, "bad client split");
+        require(token.balanceOf(FREELANCER) == 6_000e6, "bad freelancer split");
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days), 2 days, 0);
+    }
+
+    function testCannotClaimBeforeReviewEnds() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.DeadlineNotPassed.selector);
+        escrow.claimAfterReview(id);
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        vm.prank(CLIENT);
+        id = escrow.createJob(
+            FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days), 2 days, keccak256("terms")
+        );
+        vm.prank(FREELANCER);
+        escrow.acceptJob(id);
+    }
+
+    function _jobStatus(uint256 id) private view returns (FreelanceEscrow.Status status) {
+        (,,,,,,, status,) = escrow.jobs(id);
+    }
+}
+

2026-08-10T19:03:58.291012Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
codex
Built a deployable Foundry escrow project.

Key features:

- USDC-compatible ERC-20 payments from $2,000–$50,000
- Client, freelancer, and independent arbiter roles
- Acceptance and delivery deadlines
- Client approval or automatic release after review period
- Missed-deadline refunds
- Disputes with configurable payment splits
- Reentrancy protection and checks-effects-interactions
- Immutable configuration with no privileged administrator

Files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md)

Validation passed: 6 tests, 0 failures. The README recommends testing on Base Sepolia and deploying on Base with native USDC. The contract is unaudited, so an independent audit and legal review are recommended before holding production funds.
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..82921440fc33dc8ddb24f60039f628a56c9ad182
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,70 @@
+# Freelance Escrow
+
+A fixed-price freelance escrow for a single ERC-20 stablecoin. Each job records a client,
+freelancer, independent arbiter, delivery deadline, review window, amount, and hash of the
+off-chain terms. The deployment script sets the permitted range to **2,000–50,000 tokens**
+assuming a 6-decimal token such as native USDC.
+
+## How it works
+
+1. The client approves the escrow contract, then calls `createJob`. Funds move into escrow.
+2. The freelancer accepts and submits a hash/URI commitment for the deliverable by the deadline.
+3. The client approves payment, or the freelancer claims it after the review window.
+4. If delivery is late, the client can refund. Either party can instead open a dispute; only the
+   job's named arbiter can resolve it, with any split whose sum equals the escrow amount.
+5. A client can cancel only before the freelancer accepts.
+
+Keep the actual contract, scope, acceptance criteria, and deliverable encrypted/off-chain; put
+only their hash in `termsHash` or `deliverableHash`. Events and hashes are public forever.
+
+## Build and test
+
+Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```sh
+forge fmt --check
+forge test
+```
+
+## Deploy
+
+I would first deploy to **Base Sepolia**, test the complete client/freelancer/arbiter flow, then
+deploy to **Base mainnet using native USDC**. Base has low transaction fees, established USDC
+liquidity, and Ethereum-compatible tooling. For real funds, use a hardware-wallet-backed deployer,
+independently verify token and arbiter addresses, verify the source, and obtain a professional
+security audit. This contract is not upgradeable; a new audited deployment is preferable to an
+admin capable of changing escrow rules.
+
+The script assumes a 6-decimal token. Set `PAYMENT_TOKEN` to the chain's official native USDC
+contract (do not use a bridged look-alike), plus your RPC URL and funded deployer key:
+
+```sh
+export PAYMENT_TOKEN=0x...  # verify on Circle's official address list
+export PRIVATE_KEY=0x...   # use a disposable test key on testnet
+export RPC_URL=https://...
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+For mainnet, prefer a hardware wallet or Foundry keystore rather than leaving a private key in
+shell history. After deployment, verify with the explorer using the exact constructor arguments:
+
+```sh
+forge verify-contract <ESCROW_ADDRESS> src/FreelanceEscrow.sol:FreelanceEscrow \
+  --chain base \
+  --constructor-args $(cast abi-encode "constructor(address,uint256,uint256)" \
+    "$PAYMENT_TOKEN" 2000000000 50000000000)
+```
+
+Before accepting production deposits, test cancellation, deadline refund, automatic post-review
+claim, and both full and split dispute outcomes on Base Sepolia. The arbiter is trusted to allocate
+disputed funds, so use a neutral, operationally secure address and document its policy in the terms.
+
+## Important limitations
+
+- This is unaudited reference software, not legal advice. Escrow and dispute-resolution services
+  can trigger licensing, sanctions-screening, tax, consumer-protection, and money-transmission rules.
+- Fee-on-transfer, rebasing, callback-enabled, or blocklisted tokens may break expected accounting.
+  Deploy only with the exact stablecoin reviewed during an audit.
+- Stablecoins carry issuer freeze/depeg risk. The contract cannot recover accidentally sent tokens
+  and has no administrator or emergency pause.
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d8fed372be9fb172f79a7b79fe4eea73b2e3de5b
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        uint256 privateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(privateKey);
+        escrow = new FreelanceEscrow(IERC20(token), 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5af0ec88c4998e9e9f796609dd156ee57f462d74
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,230 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, single-token escrow for fixed-price freelance jobs.
+/// @dev The configured token should be a plain, non-rebasing stablecoin without transfer fees.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Active,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 reviewPeriod;
+        uint64 submittedAt;
+        Status status;
+        bytes32 termsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidReviewPeriod();
+    error InvalidState();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error InvalidSplit();
+    error TransferFailed();
+    error ReentrantCall();
+
+    IERC20 public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+
+    mapping(uint256 => Job) public jobs;
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    );
+    event JobAccepted(uint256 indexed jobId);
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 reasonHash);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event ClientRefunded(uint256 indexed jobId, uint256 amount);
+    event JobCancelled(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token, uint256 minAmount, uint256 maxAmount) {
+        if (address(token) == address(0)) revert InvalidAddress();
+        if (minAmount == 0 || maxAmount < minAmount || maxAmount > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minAmount;
+        maximumAmount = maxAmount;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint128 amount,
+        uint64 deliveryDeadline,
+        uint64 reviewPeriod,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+        if (reviewPeriod == 0) revert InvalidReviewPeriod();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            reviewPeriod: reviewPeriod,
+            submittedAt: 0,
+            status: Status.Funded,
+            termsHash: termsHash
+        });
+
+        _safeTransferFrom(msg.sender, address(this), amount);
+        emit JobCreated(
+            jobId,
+            msg.sender,
+            freelancer,
+            arbiter,
+            amount,
+            deliveryDeadline,
+            reviewPeriod,
+            termsHash
+        );
+    }
+
+    function acceptJob(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Active;
+        emit JobAccepted(jobId);
+    }
+
+    function cancelUnacceptedJob(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidState();
+        job.status = Status.Cancelled;
+        _safeTransfer(job.client, job.amount);
+        emit JobCancelled(jobId, job.amount);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp > job.deliveryDeadline) revert DeadlinePassed();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidState();
+        if (block.timestamp < uint256(job.submittedAt) + job.reviewPeriod) {
+            revert DeadlineNotPassed();
+        }
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Active) revert InvalidState();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit ClientRefunded(jobId, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Active && job.status != Status.Submitted) revert InvalidState();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The arbiter assigns the escrowed amount between both parties.
+    function resolveDispute(uint256 jobId, uint128 clientAmount, uint128 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidState();
+        if (uint256(clientAmount) + freelancerAmount != job.amount) revert InvalidSplit();
+
+        job.status = Status.Released;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..301cdb268acd3e7715a7dd461c442507e6a2387f
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address sender) external;
+    function warp(uint256 timestamp) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC11E17);
+    address private constant FREELANCER = address(0xF33);
+    address private constant ARBITER = address(0xA8B);
+    uint128 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testHappyPath() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, keccak256("ipfs deliverable"));
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(_jobStatus(id)) == uint8(FreelanceEscrow.Status.Released), "wrong status");
+    }
+
+    function testFreelancerClaimsAfterReviewWindow() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.claimAfterReview(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _createAndAccept();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = _createAndAccept();
+        vm.prank(CLIENT);
+        escrow.raiseDispute(id, keccak256("scope disagreement"));
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 4_000e6, 6_000e6);
+        require(token.balanceOf(CLIENT) == 4_000e6, "bad client split");
+        require(token.balanceOf(FREELANCER) == 6_000e6, "bad freelancer split");
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days), 2 days, 0);
+    }
+
+    function testCannotClaimBeforeReviewEnds() public {
+        uint256 id = _createAndAccept();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id, bytes32(uint256(1)));
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.DeadlineNotPassed.selector);
+        escrow.claimAfterReview(id);
+    }
+
+    function _createAndAccept() private returns (uint256 id) {
+        vm.prank(CLIENT);
+        id = escrow.createJob(
+            FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days), 2 days, keccak256("terms")
+        );
+        vm.prank(FREELANCER);
+        escrow.acceptJob(id);
+    }
+
+    function _jobStatus(uint256 id) private view returns (FreelanceEscrow.Status status) {
+        (,,,,,,, status,) = escrow.jobs(id);
+    }
+}
+

tokens used
25,027
Built a deployable Foundry escrow project.

Key features:

- USDC-compatible ERC-20 payments from $2,000–$50,000
- Client, freelancer, and independent arbiter roles
- Acceptance and delivery deadlines
- Client approval or automatic release after review period
- Missed-deadline refunds
- Disputes with configurable payment splits
- Reentrancy protection and checks-effects-interactions
- Immutable configuration with no privileged administrator

Files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/test/FreelanceEscrow.t.sol)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T190125Z-codex-no-skill-3/workspace/README.md)

Validation passed: 6 tests, 0 failures. The README recommends testing on Base Sepolia and deploying on Base with native USDC. The contract is unaudited, so an independent audit and legal review are recommended before holding production funds.
