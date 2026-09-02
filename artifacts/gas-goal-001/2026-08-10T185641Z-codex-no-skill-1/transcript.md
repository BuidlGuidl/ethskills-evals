Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019fed08-feb2-7e30-8804-2320bf72889c
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
2026-08-10T18:56:57.780748Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019fed08-feb2-7e30-8804-2320bf72889c.tmp-1786388217577190738: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the workspace, then implement a production-minded escrow with tests and deployment configuration. I’ll also document the recommended network and the operational assumptions that matter for holding real client funds.
exec
/bin/bash -lc "pwd && rg --files -uu | sed -n '1,160p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace
 succeeded in 12ms:
TASK.md

exec
/bin/bash -lc 'forge --version && solc --version || true' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace
 succeeded in 212ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

codex
The directory is empty, so I’m using Foundry and a USDC-denominated design. That avoids volatile ETH amounts for $2,000–$50,000 jobs; the contract will enforce those bounds in token base units, support delivery/review, disputes, refunds, and prevent either party from unilaterally taking funds during the normal workflow.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9da50088c62c3d4340c5ad3f0cf57c1076172242
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,53 @@
+# Freelance Escrow
+
+A non-custodial USDC escrow for jobs worth **$2,000–$50,000**. The client funds a
+job up front; the client can release payment, the freelancer can refund it, and
+either party can open a dispute for an agreed independent arbiter. After submitting
+delivery, the freelancer can claim payment when the selected 1–30 day review window
+expires unless the client disputes it.
+
+`termsHash` and `deliveryHash` should be hashes of documents stored off-chain (for
+example, an IPFS CID or a signed agreement). Do not put private work product on-chain.
+
+## Test
+
+Install [Foundry](https://getfoundry.sh/), then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy first to **Base Sepolia**, then—after an independent audit and a full
+end-to-end trial—to **Base mainnet**. Base has low transaction fees and native USDC,
+which is a better fit than volatile ETH for dollar-priced freelance work. The deploy
+script assumes USDC's 6 decimals and configures limits of `2_000e6` and `50_000e6`.
+
+```sh
+export BASE_SEPOLIA_RPC_URL="https://..."
+export PRIVATE_KEY="0x..." # use a dedicated test deployer; never commit this
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e" # Base Sepolia USDC
+
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+For Base mainnet, use its RPC URL and verify the current official native USDC address
+before deploying. Verify the contract with `--verify` and an explorer API key. Clients
+must call USDC `approve(escrowAddress, amount)` before `createJob`.
+
+## Important production notes
+
+- The arbiter is selected per job and can split funds only after a dispute. Use a
+  reputable arbitration service or a well-secured multisig, never a personal hot key.
+- This contract is intentionally not upgradeable and charges no platform fee.
+- Use only standard, non-rebasing USDC; fee-on-transfer or rebasing tokens break the
+  accounting assumption.
+- Smart-contract review is not a substitute for legal advice. Escrow, arbitration,
+  sanctions, tax, and money-transmission obligations vary by jurisdiction.
+- Before mainnet: commission an audit, add frontend/legal terms, monitor events, and
+  test operational recovery procedures. Deployed contracts cannot be patched.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
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
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..05c6c0c39f57ef3c319908e7f689ebbd9b1131cc
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(usdc, 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..865cd34485e55eaec39df90d5d46a7137dc2eeab
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,193 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @title FreelanceEscrow
+/// @notice Holds a configured USD stablecoin for freelance jobs until release or refund.
+/// @dev The configured token must be a conventional, non-rebasing ERC-20 (for example USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 reviewDeadline;
+        Status status;
+        bytes32 termsHash;
+        bytes32 deliveryHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidReviewPeriod();
+    error InvalidStatus();
+    error ReviewPeriodActive();
+    error TransferFailed();
+    error ReentrantCall();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    );
+    event DeliverySubmitted(uint256 indexed jobId, bytes32 deliveryHash, uint256 reviewDeadline);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    uint256 public constant MIN_REVIEW_PERIOD = 1 days;
+    uint256 public constant MAX_REVIEW_PERIOD = 30 days;
+
+    address public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+    mapping(uint256 => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    constructor(address token, uint256 minimum, uint256 maximum) {
+        if (token == address(0)) revert InvalidAddress();
+        if (minimum == 0 || maximum < minimum || maximum > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minimum;
+        maximumAmount = maximum;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || arbiter == freelancer) {
+            revert InvalidAddress();
+        }
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint128(amount),
+            reviewDeadline: 0,
+            status: Status.Funded,
+            termsHash: termsHash,
+            deliveryHash: bytes32(0)
+        });
+
+        _safeTransferFrom(paymentToken, msg.sender, address(this), amount);
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, termsHash);
+    }
+
+    function submitDelivery(uint256 jobId, bytes32 deliveryHash, uint256 reviewPeriod) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (deliveryHash == bytes32(0)) revert InvalidAmount();
+        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) {
+            revert InvalidReviewPeriod();
+        }
+
+        job.deliveryHash = deliveryHash;
+        job.reviewDeadline = uint64(block.timestamp + reviewPeriod);
+        job.status = Status.Delivered;
+        emit DeliverySubmitted(jobId, deliveryHash, job.reviewDeadline);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        _payFreelancer(jobId, job);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        if (block.timestamp <= job.reviewDeadline) revert ReviewPeriodActive();
+        _payFreelancer(jobId, job);
+    }
+
+    /// @notice The freelancer may agree to cancel and return all funds before a dispute.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        uint256 amount = job.amount;
+        job.status = Status.Refunded;
+        _safeTransfer(paymentToken, job.client, amount);
+        emit PaymentRefunded(jobId, amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (freelancerAmount > amount) revert InvalidAmount();
+        uint256 clientAmount = amount - freelancerAmount;
+        job.status = Status.Resolved;
+
+        if (freelancerAmount != 0) _safeTransfer(paymentToken, job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(paymentToken, job.client, clientAmount);
+        emit DisputeResolved(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _payFreelancer(uint256 jobId, Job storage job) private {
+        uint256 amount = job.amount;
+        job.status = Status.Released;
+        _safeTransfer(paymentToken, job.freelancer, amount);
+        emit PaymentReleased(jobId, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(
+                bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount
+            )
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a80a0fb23a54df311e8d21675a8cc8a74c1afee
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,87 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount; return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+        token.mint(CLIENT, 50_000e6);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesPayment() public {
+        uint256 id = _create(10_000e6);
+        vm.prank(CLIENT); escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == 10_000e6);
+        (, , , , , FreelanceEscrow.Status status, ,) = escrow.jobs(id);
+        assert(status == FreelanceEscrow.Status.Released);
+    }
+
+    function testFreelancerClaimsAfterReview() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(FREELANCER); escrow.claimAfterReview(id);
+        assert(token.balanceOf(FREELANCER) == 2_000e6);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(50_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.prank(CLIENT); escrow.openDispute(id);
+        vm.prank(ARBITER); escrow.resolveDispute(id, 30_000e6);
+        assert(token.balanceOf(FREELANCER) == 30_000e6);
+        assert(token.balanceOf(CLIENT) == 20_000e6);
+    }
+
+    function testRejectsOutOfRangeJob() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, keccak256("terms"));
+    }
+
+    function testClientCannotRefundItself() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.refund(id);
+    }
+
+    function _create(uint256 amount) private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, amount, keccak256("signed terms v1"));
+    }
+}
+

diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9da50088c62c3d4340c5ad3f0cf57c1076172242
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,53 @@
+# Freelance Escrow
+
+A non-custodial USDC escrow for jobs worth **$2,000–$50,000**. The client funds a
+job up front; the client can release payment, the freelancer can refund it, and
+either party can open a dispute for an agreed independent arbiter. After submitting
+delivery, the freelancer can claim payment when the selected 1–30 day review window
+expires unless the client disputes it.
+
+`termsHash` and `deliveryHash` should be hashes of documents stored off-chain (for
+example, an IPFS CID or a signed agreement). Do not put private work product on-chain.
+
+## Test
+
+Install [Foundry](https://getfoundry.sh/), then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy first to **Base Sepolia**, then—after an independent audit and a full
+end-to-end trial—to **Base mainnet**. Base has low transaction fees and native USDC,
+which is a better fit than volatile ETH for dollar-priced freelance work. The deploy
+script assumes USDC's 6 decimals and configures limits of `2_000e6` and `50_000e6`.
+
+```sh
+export BASE_SEPOLIA_RPC_URL="https://..."
+export PRIVATE_KEY="0x..." # use a dedicated test deployer; never commit this
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e" # Base Sepolia USDC
+
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+For Base mainnet, use its RPC URL and verify the current official native USDC address
+before deploying. Verify the contract with `--verify` and an explorer API key. Clients
+must call USDC `approve(escrowAddress, amount)` before `createJob`.
+
+## Important production notes
+
+- The arbiter is selected per job and can split funds only after a dispute. Use a
+  reputable arbitration service or a well-secured multisig, never a personal hot key.
+- This contract is intentionally not upgradeable and charges no platform fee.
+- Use only standard, non-rebasing USDC; fee-on-transfer or rebasing tokens break the
+  accounting assumption.
+- Smart-contract review is not a substitute for legal advice. Escrow, arbitration,
+  sanctions, tax, and money-transmission obligations vary by jurisdiction.
+- Before mainnet: commission an audit, add frontend/legal terms, monitor events, and
+  test operational recovery procedures. Deployed contracts cannot be patched.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
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
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..05c6c0c39f57ef3c319908e7f689ebbd9b1131cc
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(usdc, 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..865cd34485e55eaec39df90d5d46a7137dc2eeab
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,193 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @title FreelanceEscrow
+/// @notice Holds a configured USD stablecoin for freelance jobs until release or refund.
+/// @dev The configured token must be a conventional, non-rebasing ERC-20 (for example USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 reviewDeadline;
+        Status status;
+        bytes32 termsHash;
+        bytes32 deliveryHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidReviewPeriod();
+    error InvalidStatus();
+    error ReviewPeriodActive();
+    error TransferFailed();
+    error ReentrantCall();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    );
+    event DeliverySubmitted(uint256 indexed jobId, bytes32 deliveryHash, uint256 reviewDeadline);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    uint256 public constant MIN_REVIEW_PERIOD = 1 days;
+    uint256 public constant MAX_REVIEW_PERIOD = 30 days;
+
+    address public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+    mapping(uint256 => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    constructor(address token, uint256 minimum, uint256 maximum) {
+        if (token == address(0)) revert InvalidAddress();
+        if (minimum == 0 || maximum < minimum || maximum > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minimum;
+        maximumAmount = maximum;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || arbiter == freelancer) {
+            revert InvalidAddress();
+        }
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint128(amount),
+            reviewDeadline: 0,
+            status: Status.Funded,
+            termsHash: termsHash,
+            deliveryHash: bytes32(0)
+        });
+
+        _safeTransferFrom(paymentToken, msg.sender, address(this), amount);
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, termsHash);
+    }
+
+    function submitDelivery(uint256 jobId, bytes32 deliveryHash, uint256 reviewPeriod) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (deliveryHash == bytes32(0)) revert InvalidAmount();
+        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) {
+            revert InvalidReviewPeriod();
+        }
+
+        job.deliveryHash = deliveryHash;
+        job.reviewDeadline = uint64(block.timestamp + reviewPeriod);
+        job.status = Status.Delivered;
+        emit DeliverySubmitted(jobId, deliveryHash, job.reviewDeadline);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        _payFreelancer(jobId, job);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        if (block.timestamp <= job.reviewDeadline) revert ReviewPeriodActive();
+        _payFreelancer(jobId, job);
+    }
+
+    /// @notice The freelancer may agree to cancel and return all funds before a dispute.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        uint256 amount = job.amount;
+        job.status = Status.Refunded;
+        _safeTransfer(paymentToken, job.client, amount);
+        emit PaymentRefunded(jobId, amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (freelancerAmount > amount) revert InvalidAmount();
+        uint256 clientAmount = amount - freelancerAmount;
+        job.status = Status.Resolved;
+
+        if (freelancerAmount != 0) _safeTransfer(paymentToken, job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(paymentToken, job.client, clientAmount);
+        emit DisputeResolved(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _payFreelancer(uint256 jobId, Job storage job) private {
+        uint256 amount = job.amount;
+        job.status = Status.Released;
+        _safeTransfer(paymentToken, job.freelancer, amount);
+        emit PaymentReleased(jobId, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(
+                bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount
+            )
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a80a0fb23a54df311e8d21675a8cc8a74c1afee
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,87 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount; return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+        token.mint(CLIENT, 50_000e6);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesPayment() public {
+        uint256 id = _create(10_000e6);
+        vm.prank(CLIENT); escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == 10_000e6);
+        (, , , , , FreelanceEscrow.Status status, ,) = escrow.jobs(id);
+        assert(status == FreelanceEscrow.Status.Released);
+    }
+
+    function testFreelancerClaimsAfterReview() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(FREELANCER); escrow.claimAfterReview(id);
+        assert(token.balanceOf(FREELANCER) == 2_000e6);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(50_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.prank(CLIENT); escrow.openDispute(id);
+        vm.prank(ARBITER); escrow.resolveDispute(id, 30_000e6);
+        assert(token.balanceOf(FREELANCER) == 30_000e6);
+        assert(token.balanceOf(CLIENT) == 20_000e6);
+    }
+
+    function testRejectsOutOfRangeJob() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, keccak256("terms"));
+    }
+
+    function testClientCannotRefundItself() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.refund(id);
+    }
+
+    function _create(uint256 amount) private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, amount, keccak256("signed terms v1"));
+    }
+}
+

exec
/bin/bash -lc 'forge fmt --check && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace
 exited 1 in 9ms:
Diff in src/FreelanceEscrow.sol:
77  77   |         locked = 1;
78  78   |     }
79  79   | 
80       |-    function createJob(
81       |-        address freelancer,
82       |-        address arbiter,
83       |-        uint256 amount,
84       |-        bytes32 termsHash
85       |-    ) external nonReentrant returns (uint256 jobId) {
    80   |+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 termsHash)
    81   |+        external
    82   |+        nonReentrant
    83   |+        returns (uint256 jobId)
    84   |+    {
86  85   |         if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
87  86   |         if (freelancer == msg.sender || arbiter == msg.sender || arbiter == freelancer) {
88  87   |             revert InvalidAddress();
--------------------------------------------------------------------------------176 175  |     }
177 176  | 
178 177  |     function _safeTransfer(address token, address to, uint256 amount) private {
179      |-        (bool success, bytes memory data) =
180      |-            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
    178  |+        (bool success, bytes memory data) = token.call(
    179  |+            abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount)
    180  |+        );
181 181  |         if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
182 182  |     }
183 183  | 

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
18       |-        allowance[msg.sender][spender] = amount; return true;
    21   |+        allowance[msg.sender][spender] = amount;
    22   |+        return true;
19  23   |     }
    24   |+
20  25   |     function transfer(address to, uint256 amount) external returns (bool) {
21       |-        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    26   |+        balanceOf[msg.sender] -= amount;
    27   |+        balanceOf[to] += amount;
    28   |+        return true;
22  29   |     }
    30   |+
23  31   |     function transferFrom(address from, address to, uint256 amount) external returns (bool) {
24  32   |         allowance[from][msg.sender] -= amount;
25       |-        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    33   |+        balanceOf[from] -= amount;
    34   |+        balanceOf[to] += amount;
    35   |+        return true;
26  36   |     }
27  37   | }
28  38   | 
--------------------------------------------------------------------------------38  48   |         token = new MockUSDC();
39  49   |         escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
40  50   |         token.mint(CLIENT, 50_000e6);
41       |-        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
    51   |+        vm.prank(CLIENT);
    52   |+        token.approve(address(escrow), type(uint256).max);
42  53   |     }
43  54   | 
44  55   |     function testClientReleasesPayment() public {
45  56   |         uint256 id = _create(10_000e6);
46       |-        vm.prank(CLIENT); escrow.release(id);
    57   |+        vm.prank(CLIENT);
    58   |+        escrow.release(id);
47  59   |         assert(token.balanceOf(FREELANCER) == 10_000e6);
48       |-        (, , , , , FreelanceEscrow.Status status, ,) = escrow.jobs(id);
    60   |+        (,,,,, FreelanceEscrow.Status status,,) = escrow.jobs(id);
49  61   |         assert(status == FreelanceEscrow.Status.Released);
50  62   |     }
51  63   | 
52  64   |     function testFreelancerClaimsAfterReview() public {
53  65   |         uint256 id = _create(2_000e6);
54       |-        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
    66   |+        vm.prank(FREELANCER);
    67   |+        escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
55  68   |         vm.warp(block.timestamp + 3 days + 1);
56       |-        vm.prank(FREELANCER); escrow.claimAfterReview(id);
    69   |+        vm.prank(FREELANCER);
    70   |+        escrow.claimAfterReview(id);
57  71   |         assert(token.balanceOf(FREELANCER) == 2_000e6);
58  72   |     }
59  73   | 
60  74   |     function testArbiterSplitsDispute() public {
61  75   |         uint256 id = _create(50_000e6);
62       |-        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
63       |-        vm.prank(CLIENT); escrow.openDispute(id);
64       |-        vm.prank(ARBITER); escrow.resolveDispute(id, 30_000e6);
    76   |+        vm.prank(FREELANCER);
    77   |+        escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
    78   |+        vm.prank(CLIENT);
    79   |+        escrow.openDispute(id);
    80   |+        vm.prank(ARBITER);
    81   |+        escrow.resolveDispute(id, 30_000e6);
65  82   |         assert(token.balanceOf(FREELANCER) == 30_000e6);
66  83   |         assert(token.balanceOf(CLIENT) == 20_000e6);
67  84   |     }

diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9da50088c62c3d4340c5ad3f0cf57c1076172242
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,53 @@
+# Freelance Escrow
+
+A non-custodial USDC escrow for jobs worth **$2,000–$50,000**. The client funds a
+job up front; the client can release payment, the freelancer can refund it, and
+either party can open a dispute for an agreed independent arbiter. After submitting
+delivery, the freelancer can claim payment when the selected 1–30 day review window
+expires unless the client disputes it.
+
+`termsHash` and `deliveryHash` should be hashes of documents stored off-chain (for
+example, an IPFS CID or a signed agreement). Do not put private work product on-chain.
+
+## Test
+
+Install [Foundry](https://getfoundry.sh/), then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy first to **Base Sepolia**, then—after an independent audit and a full
+end-to-end trial—to **Base mainnet**. Base has low transaction fees and native USDC,
+which is a better fit than volatile ETH for dollar-priced freelance work. The deploy
+script assumes USDC's 6 decimals and configures limits of `2_000e6` and `50_000e6`.
+
+```sh
+export BASE_SEPOLIA_RPC_URL="https://..."
+export PRIVATE_KEY="0x..." # use a dedicated test deployer; never commit this
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e" # Base Sepolia USDC
+
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+For Base mainnet, use its RPC URL and verify the current official native USDC address
+before deploying. Verify the contract with `--verify` and an explorer API key. Clients
+must call USDC `approve(escrowAddress, amount)` before `createJob`.
+
+## Important production notes
+
+- The arbiter is selected per job and can split funds only after a dispute. Use a
+  reputable arbitration service or a well-secured multisig, never a personal hot key.
+- This contract is intentionally not upgradeable and charges no platform fee.
+- Use only standard, non-rebasing USDC; fee-on-transfer or rebasing tokens break the
+  accounting assumption.
+- Smart-contract review is not a substitute for legal advice. Escrow, arbitration,
+  sanctions, tax, and money-transmission obligations vary by jurisdiction.
+- Before mainnet: commission an audit, add frontend/legal terms, monitor events, and
+  test operational recovery procedures. Deployed contracts cannot be patched.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
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
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..05c6c0c39f57ef3c319908e7f689ebbd9b1131cc
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(usdc, 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..865cd34485e55eaec39df90d5d46a7137dc2eeab
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,193 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @title FreelanceEscrow
+/// @notice Holds a configured USD stablecoin for freelance jobs until release or refund.
+/// @dev The configured token must be a conventional, non-rebasing ERC-20 (for example USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 reviewDeadline;
+        Status status;
+        bytes32 termsHash;
+        bytes32 deliveryHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidReviewPeriod();
+    error InvalidStatus();
+    error ReviewPeriodActive();
+    error TransferFailed();
+    error ReentrantCall();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    );
+    event DeliverySubmitted(uint256 indexed jobId, bytes32 deliveryHash, uint256 reviewDeadline);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    uint256 public constant MIN_REVIEW_PERIOD = 1 days;
+    uint256 public constant MAX_REVIEW_PERIOD = 30 days;
+
+    address public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+    mapping(uint256 => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    constructor(address token, uint256 minimum, uint256 maximum) {
+        if (token == address(0)) revert InvalidAddress();
+        if (minimum == 0 || maximum < minimum || maximum > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minimum;
+        maximumAmount = maximum;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || arbiter == freelancer) {
+            revert InvalidAddress();
+        }
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint128(amount),
+            reviewDeadline: 0,
+            status: Status.Funded,
+            termsHash: termsHash,
+            deliveryHash: bytes32(0)
+        });
+
+        _safeTransferFrom(paymentToken, msg.sender, address(this), amount);
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, termsHash);
+    }
+
+    function submitDelivery(uint256 jobId, bytes32 deliveryHash, uint256 reviewPeriod) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (deliveryHash == bytes32(0)) revert InvalidAmount();
+        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) {
+            revert InvalidReviewPeriod();
+        }
+
+        job.deliveryHash = deliveryHash;
+        job.reviewDeadline = uint64(block.timestamp + reviewPeriod);
+        job.status = Status.Delivered;
+        emit DeliverySubmitted(jobId, deliveryHash, job.reviewDeadline);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        _payFreelancer(jobId, job);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        if (block.timestamp <= job.reviewDeadline) revert ReviewPeriodActive();
+        _payFreelancer(jobId, job);
+    }
+
+    /// @notice The freelancer may agree to cancel and return all funds before a dispute.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        uint256 amount = job.amount;
+        job.status = Status.Refunded;
+        _safeTransfer(paymentToken, job.client, amount);
+        emit PaymentRefunded(jobId, amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (freelancerAmount > amount) revert InvalidAmount();
+        uint256 clientAmount = amount - freelancerAmount;
+        job.status = Status.Resolved;
+
+        if (freelancerAmount != 0) _safeTransfer(paymentToken, job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(paymentToken, job.client, clientAmount);
+        emit DisputeResolved(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _payFreelancer(uint256 jobId, Job storage job) private {
+        uint256 amount = job.amount;
+        job.status = Status.Released;
+        _safeTransfer(paymentToken, job.freelancer, amount);
+        emit PaymentReleased(jobId, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(
+                bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount
+            )
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a80a0fb23a54df311e8d21675a8cc8a74c1afee
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,87 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount; return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+        token.mint(CLIENT, 50_000e6);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesPayment() public {
+        uint256 id = _create(10_000e6);
+        vm.prank(CLIENT); escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == 10_000e6);
+        (, , , , , FreelanceEscrow.Status status, ,) = escrow.jobs(id);
+        assert(status == FreelanceEscrow.Status.Released);
+    }
+
+    function testFreelancerClaimsAfterReview() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(FREELANCER); escrow.claimAfterReview(id);
+        assert(token.balanceOf(FREELANCER) == 2_000e6);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(50_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.prank(CLIENT); escrow.openDispute(id);
+        vm.prank(ARBITER); escrow.resolveDispute(id, 30_000e6);
+        assert(token.balanceOf(FREELANCER) == 30_000e6);
+        assert(token.balanceOf(CLIENT) == 20_000e6);
+    }
+
+    function testRejectsOutOfRangeJob() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, keccak256("terms"));
+    }
+
+    function testClientCannotRefundItself() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.refund(id);
+    }
+
+    function _create(uint256 amount) private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, amount, keccak256("signed terms v1"));
+    }
+}
+

codex
The first verification pass found only formatting differences. I’m applying the repository formatter and then running the full test suite and deployment-script compilation.
exec
/bin/bash -lc 'forge fmt && forge test -vv && forge build --sizes' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace
 succeeded in 476ms:
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 224.30ms
Compiler run successful!
2026-08-10T18:58:44.777448Z  WARN evm::traces::external: etherscan config not found

Ran 5 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterSplitsDispute() (gas: 211857)
[PASS] testClientCannotRefundItself() (gas: 174375)
[PASS] testClientReleasesPayment() (gas: 183081)
[PASS] testFreelancerClaimsAfterReview() (gas: 205220)
[PASS] testRejectsOutOfRangeJob() (gas: 14365)
Suite result: ok. 5 passed; 0 failed; 0 skipped; finished in 3.92ms (3.62ms CPU time)

Ran 1 test suite in 10.86ms (3.92ms CPU time): 5 tests passed, 0 failed, 0 skipped (5 total tests)
2026-08-10T18:58:44.789717Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
Compiling 1 files with Solc 0.8.20
Solc 0.8.20 finished in 113.85ms
Compiler run successful!

╭-----------------+------------------+-------------------+--------------------+---------------------╮
| Contract        | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+===================================================================================================+
| Deploy          | 5,460            | 5,489             | 19,116             | 43,663              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| FreelanceEscrow | 4,477            | 4,809             | 20,099             | 44,343              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| MockUSDC        | 941              | 970               | 23,635             | 48,182              |
╰-----------------+------------------+-------------------+--------------------+---------------------╯

2026-08-10T18:58:44.950411Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/Deploy.s.sol:13:25
   |
13 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:55:30
   |
55 |     address public immutable paymentToken;
   |                              ^^^^^^^^^^^^ help: consider using: `PAYMENT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:56:30
   |
56 |     uint256 public immutable minimumAmount;
   |                              ^^^^^^^^^^^^^ help: consider using: `MINIMUM_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:57:30
   |
57 |     uint256 public immutable maximumAmount;
   |                              ^^^^^^^^^^^^^ help: consider using: `MAXIMUM_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:40:25
   |
40 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:73:5
   |
73 | /     modifier nonReentrant() {
74 | |         if (locked != 1) revert ReentrantCall();
75 | |         locked = 2;
76 | |         _;
77 | |         locked = 1;
78 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
73 ~     modifier nonReentrant() {
74 +         _nonReentrantBefore();
75 +         _;
76 +         _nonReentrantAfter();
77 +     }
78 + 
79 +     function _nonReentrantBefore() internal {
80 +         if (locked != 1) revert ReentrantCall();
81 +         locked = 2;
82 +     }
83 + 
84 +     function _nonReentrantAfter() internal {
85 +         locked = 1;
86 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/FreelanceEscrow.sol:96:21
   |
96 |             amount: uint128(amount),
   |                     ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint128' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/FreelanceEscrow.sol:117:30
    |
117 |         job.reviewDeadline = uint64(block.timestamp + reviewPeriod);
    |                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint64' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast


diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9da50088c62c3d4340c5ad3f0cf57c1076172242
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,53 @@
+# Freelance Escrow
+
+A non-custodial USDC escrow for jobs worth **$2,000–$50,000**. The client funds a
+job up front; the client can release payment, the freelancer can refund it, and
+either party can open a dispute for an agreed independent arbiter. After submitting
+delivery, the freelancer can claim payment when the selected 1–30 day review window
+expires unless the client disputes it.
+
+`termsHash` and `deliveryHash` should be hashes of documents stored off-chain (for
+example, an IPFS CID or a signed agreement). Do not put private work product on-chain.
+
+## Test
+
+Install [Foundry](https://getfoundry.sh/), then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy first to **Base Sepolia**, then—after an independent audit and a full
+end-to-end trial—to **Base mainnet**. Base has low transaction fees and native USDC,
+which is a better fit than volatile ETH for dollar-priced freelance work. The deploy
+script assumes USDC's 6 decimals and configures limits of `2_000e6` and `50_000e6`.
+
+```sh
+export BASE_SEPOLIA_RPC_URL="https://..."
+export PRIVATE_KEY="0x..." # use a dedicated test deployer; never commit this
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e" # Base Sepolia USDC
+
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+For Base mainnet, use its RPC URL and verify the current official native USDC address
+before deploying. Verify the contract with `--verify` and an explorer API key. Clients
+must call USDC `approve(escrowAddress, amount)` before `createJob`.
+
+## Important production notes
+
+- The arbiter is selected per job and can split funds only after a dispute. Use a
+  reputable arbitration service or a well-secured multisig, never a personal hot key.
+- This contract is intentionally not upgradeable and charges no platform fee.
+- Use only standard, non-rebasing USDC; fee-on-transfer or rebasing tokens break the
+  accounting assumption.
+- Smart-contract review is not a substitute for legal advice. Escrow, arbitration,
+  sanctions, tax, and money-transmission obligations vary by jurisdiction.
+- Before mainnet: commission an audit, add frontend/legal terms, monitor events, and
+  test operational recovery procedures. Deployed contracts cannot be patched.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
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
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..05c6c0c39f57ef3c319908e7f689ebbd9b1131cc
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(usdc, 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..865cd34485e55eaec39df90d5d46a7137dc2eeab
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,193 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @title FreelanceEscrow
+/// @notice Holds a configured USD stablecoin for freelance jobs until release or refund.
+/// @dev The configured token must be a conventional, non-rebasing ERC-20 (for example USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 reviewDeadline;
+        Status status;
+        bytes32 termsHash;
+        bytes32 deliveryHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidReviewPeriod();
+    error InvalidStatus();
+    error ReviewPeriodActive();
+    error TransferFailed();
+    error ReentrantCall();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    );
+    event DeliverySubmitted(uint256 indexed jobId, bytes32 deliveryHash, uint256 reviewDeadline);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    uint256 public constant MIN_REVIEW_PERIOD = 1 days;
+    uint256 public constant MAX_REVIEW_PERIOD = 30 days;
+
+    address public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+    mapping(uint256 => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    constructor(address token, uint256 minimum, uint256 maximum) {
+        if (token == address(0)) revert InvalidAddress();
+        if (minimum == 0 || maximum < minimum || maximum > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minimum;
+        maximumAmount = maximum;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || arbiter == freelancer) {
+            revert InvalidAddress();
+        }
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint128(amount),
+            reviewDeadline: 0,
+            status: Status.Funded,
+            termsHash: termsHash,
+            deliveryHash: bytes32(0)
+        });
+
+        _safeTransferFrom(paymentToken, msg.sender, address(this), amount);
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, termsHash);
+    }
+
+    function submitDelivery(uint256 jobId, bytes32 deliveryHash, uint256 reviewPeriod) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (deliveryHash == bytes32(0)) revert InvalidAmount();
+        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) {
+            revert InvalidReviewPeriod();
+        }
+
+        job.deliveryHash = deliveryHash;
+        job.reviewDeadline = uint64(block.timestamp + reviewPeriod);
+        job.status = Status.Delivered;
+        emit DeliverySubmitted(jobId, deliveryHash, job.reviewDeadline);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        _payFreelancer(jobId, job);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        if (block.timestamp <= job.reviewDeadline) revert ReviewPeriodActive();
+        _payFreelancer(jobId, job);
+    }
+
+    /// @notice The freelancer may agree to cancel and return all funds before a dispute.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        uint256 amount = job.amount;
+        job.status = Status.Refunded;
+        _safeTransfer(paymentToken, job.client, amount);
+        emit PaymentRefunded(jobId, amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (freelancerAmount > amount) revert InvalidAmount();
+        uint256 clientAmount = amount - freelancerAmount;
+        job.status = Status.Resolved;
+
+        if (freelancerAmount != 0) _safeTransfer(paymentToken, job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(paymentToken, job.client, clientAmount);
+        emit DisputeResolved(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _payFreelancer(uint256 jobId, Job storage job) private {
+        uint256 amount = job.amount;
+        job.status = Status.Released;
+        _safeTransfer(paymentToken, job.freelancer, amount);
+        emit PaymentReleased(jobId, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(
+                bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount
+            )
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a80a0fb23a54df311e8d21675a8cc8a74c1afee
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,87 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount; return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+        token.mint(CLIENT, 50_000e6);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesPayment() public {
+        uint256 id = _create(10_000e6);
+        vm.prank(CLIENT); escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == 10_000e6);
+        (, , , , , FreelanceEscrow.Status status, ,) = escrow.jobs(id);
+        assert(status == FreelanceEscrow.Status.Released);
+    }
+
+    function testFreelancerClaimsAfterReview() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(FREELANCER); escrow.claimAfterReview(id);
+        assert(token.balanceOf(FREELANCER) == 2_000e6);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(50_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.prank(CLIENT); escrow.openDispute(id);
+        vm.prank(ARBITER); escrow.resolveDispute(id, 30_000e6);
+        assert(token.balanceOf(FREELANCER) == 30_000e6);
+        assert(token.balanceOf(CLIENT) == 20_000e6);
+    }
+
+    function testRejectsOutOfRangeJob() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, keccak256("terms"));
+    }
+
+    function testClientCannotRefundItself() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.refund(id);
+    }
+
+    function _create(uint256 amount) private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, amount, keccak256("signed terms v1"));
+    }
+}
+

exec
/bin/bash -lc 'git status --short && forge fmt --check' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace
 succeeded in 19ms:
?? ../../../../.pnp.cjs
?? ../../../../.pnp.loader.mjs
?? ../../../building-blocks-quiz-001/
?? ../../../building-blocks-quiz-002/
?? ../
?? ../../2026-08-10T185814Z-codex-no-skill-2/

diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9da50088c62c3d4340c5ad3f0cf57c1076172242
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,53 @@
+# Freelance Escrow
+
+A non-custodial USDC escrow for jobs worth **$2,000–$50,000**. The client funds a
+job up front; the client can release payment, the freelancer can refund it, and
+either party can open a dispute for an agreed independent arbiter. After submitting
+delivery, the freelancer can claim payment when the selected 1–30 day review window
+expires unless the client disputes it.
+
+`termsHash` and `deliveryHash` should be hashes of documents stored off-chain (for
+example, an IPFS CID or a signed agreement). Do not put private work product on-chain.
+
+## Test
+
+Install [Foundry](https://getfoundry.sh/), then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy first to **Base Sepolia**, then—after an independent audit and a full
+end-to-end trial—to **Base mainnet**. Base has low transaction fees and native USDC,
+which is a better fit than volatile ETH for dollar-priced freelance work. The deploy
+script assumes USDC's 6 decimals and configures limits of `2_000e6` and `50_000e6`.
+
+```sh
+export BASE_SEPOLIA_RPC_URL="https://..."
+export PRIVATE_KEY="0x..." # use a dedicated test deployer; never commit this
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e" # Base Sepolia USDC
+
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+For Base mainnet, use its RPC URL and verify the current official native USDC address
+before deploying. Verify the contract with `--verify` and an explorer API key. Clients
+must call USDC `approve(escrowAddress, amount)` before `createJob`.
+
+## Important production notes
+
+- The arbiter is selected per job and can split funds only after a dispute. Use a
+  reputable arbitration service or a well-secured multisig, never a personal hot key.
+- This contract is intentionally not upgradeable and charges no platform fee.
+- Use only standard, non-rebasing USDC; fee-on-transfer or rebasing tokens break the
+  accounting assumption.
+- Smart-contract review is not a substitute for legal advice. Escrow, arbitration,
+  sanctions, tax, and money-transmission obligations vary by jurisdiction.
+- Before mainnet: commission an audit, add frontend/legal terms, monitor events, and
+  test operational recovery procedures. Deployed contracts cannot be patched.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
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
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..05c6c0c39f57ef3c319908e7f689ebbd9b1131cc
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(usdc, 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..865cd34485e55eaec39df90d5d46a7137dc2eeab
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,193 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @title FreelanceEscrow
+/// @notice Holds a configured USD stablecoin for freelance jobs until release or refund.
+/// @dev The configured token must be a conventional, non-rebasing ERC-20 (for example USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 reviewDeadline;
+        Status status;
+        bytes32 termsHash;
+        bytes32 deliveryHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidReviewPeriod();
+    error InvalidStatus();
+    error ReviewPeriodActive();
+    error TransferFailed();
+    error ReentrantCall();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    );
+    event DeliverySubmitted(uint256 indexed jobId, bytes32 deliveryHash, uint256 reviewDeadline);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    uint256 public constant MIN_REVIEW_PERIOD = 1 days;
+    uint256 public constant MAX_REVIEW_PERIOD = 30 days;
+
+    address public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+    mapping(uint256 => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    constructor(address token, uint256 minimum, uint256 maximum) {
+        if (token == address(0)) revert InvalidAddress();
+        if (minimum == 0 || maximum < minimum || maximum > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minimum;
+        maximumAmount = maximum;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || arbiter == freelancer) {
+            revert InvalidAddress();
+        }
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint128(amount),
+            reviewDeadline: 0,
+            status: Status.Funded,
+            termsHash: termsHash,
+            deliveryHash: bytes32(0)
+        });
+
+        _safeTransferFrom(paymentToken, msg.sender, address(this), amount);
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, termsHash);
+    }
+
+    function submitDelivery(uint256 jobId, bytes32 deliveryHash, uint256 reviewPeriod) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (deliveryHash == bytes32(0)) revert InvalidAmount();
+        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) {
+            revert InvalidReviewPeriod();
+        }
+
+        job.deliveryHash = deliveryHash;
+        job.reviewDeadline = uint64(block.timestamp + reviewPeriod);
+        job.status = Status.Delivered;
+        emit DeliverySubmitted(jobId, deliveryHash, job.reviewDeadline);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        _payFreelancer(jobId, job);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        if (block.timestamp <= job.reviewDeadline) revert ReviewPeriodActive();
+        _payFreelancer(jobId, job);
+    }
+
+    /// @notice The freelancer may agree to cancel and return all funds before a dispute.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        uint256 amount = job.amount;
+        job.status = Status.Refunded;
+        _safeTransfer(paymentToken, job.client, amount);
+        emit PaymentRefunded(jobId, amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (freelancerAmount > amount) revert InvalidAmount();
+        uint256 clientAmount = amount - freelancerAmount;
+        job.status = Status.Resolved;
+
+        if (freelancerAmount != 0) _safeTransfer(paymentToken, job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(paymentToken, job.client, clientAmount);
+        emit DisputeResolved(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _payFreelancer(uint256 jobId, Job storage job) private {
+        uint256 amount = job.amount;
+        job.status = Status.Released;
+        _safeTransfer(paymentToken, job.freelancer, amount);
+        emit PaymentReleased(jobId, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(
+                bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount
+            )
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a80a0fb23a54df311e8d21675a8cc8a74c1afee
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,87 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount; return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+        token.mint(CLIENT, 50_000e6);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesPayment() public {
+        uint256 id = _create(10_000e6);
+        vm.prank(CLIENT); escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == 10_000e6);
+        (, , , , , FreelanceEscrow.Status status, ,) = escrow.jobs(id);
+        assert(status == FreelanceEscrow.Status.Released);
+    }
+
+    function testFreelancerClaimsAfterReview() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(FREELANCER); escrow.claimAfterReview(id);
+        assert(token.balanceOf(FREELANCER) == 2_000e6);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(50_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.prank(CLIENT); escrow.openDispute(id);
+        vm.prank(ARBITER); escrow.resolveDispute(id, 30_000e6);
+        assert(token.balanceOf(FREELANCER) == 30_000e6);
+        assert(token.balanceOf(CLIENT) == 20_000e6);
+    }
+
+    function testRejectsOutOfRangeJob() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, keccak256("terms"));
+    }
+
+    function testClientCannotRefundItself() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.refund(id);
+    }
+
+    function _create(uint256 amount) private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, amount, keccak256("signed terms v1"));
+    }
+}
+

codex
Implemented a deployable Foundry-based USDC escrow.

Key features:

- Enforces $2,000–$50,000 USDC deposits
- Client payment release
- Freelancer-approved refunds
- Delivery submission with a 1–30 day review window
- Freelancer claim after review expiry
- Independent arbiter dispute resolution and split payments
- Reentrancy protection and safe ERC-20 transfers
- Deployment script configured through environment variables

Files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md)

Verification: `forge test` passes all 5 tests, and the deployment script compiles successfully.

The README recommends testing on Base Sepolia and deploying to Base mainnet after an independent security audit.
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9da50088c62c3d4340c5ad3f0cf57c1076172242
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,53 @@
+# Freelance Escrow
+
+A non-custodial USDC escrow for jobs worth **$2,000–$50,000**. The client funds a
+job up front; the client can release payment, the freelancer can refund it, and
+either party can open a dispute for an agreed independent arbiter. After submitting
+delivery, the freelancer can claim payment when the selected 1–30 day review window
+expires unless the client disputes it.
+
+`termsHash` and `deliveryHash` should be hashes of documents stored off-chain (for
+example, an IPFS CID or a signed agreement). Do not put private work product on-chain.
+
+## Test
+
+Install [Foundry](https://getfoundry.sh/), then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy first to **Base Sepolia**, then—after an independent audit and a full
+end-to-end trial—to **Base mainnet**. Base has low transaction fees and native USDC,
+which is a better fit than volatile ETH for dollar-priced freelance work. The deploy
+script assumes USDC's 6 decimals and configures limits of `2_000e6` and `50_000e6`.
+
+```sh
+export BASE_SEPOLIA_RPC_URL="https://..."
+export PRIVATE_KEY="0x..." # use a dedicated test deployer; never commit this
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e" # Base Sepolia USDC
+
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+For Base mainnet, use its RPC URL and verify the current official native USDC address
+before deploying. Verify the contract with `--verify` and an explorer API key. Clients
+must call USDC `approve(escrowAddress, amount)` before `createJob`.
+
+## Important production notes
+
+- The arbiter is selected per job and can split funds only after a dispute. Use a
+  reputable arbitration service or a well-secured multisig, never a personal hot key.
+- This contract is intentionally not upgradeable and charges no platform fee.
+- Use only standard, non-rebasing USDC; fee-on-transfer or rebasing tokens break the
+  accounting assumption.
+- Smart-contract review is not a substitute for legal advice. Escrow, arbitration,
+  sanctions, tax, and money-transmission obligations vary by jurisdiction.
+- Before mainnet: commission an audit, add frontend/legal terms, monitor events, and
+  test operational recovery procedures. Deployed contracts cannot be patched.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64b3d8dffe93a6870fd97503b43012cca451e477
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/foundry.toml
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
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..05c6c0c39f57ef3c319908e7f689ebbd9b1131cc
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(usdc, 2_000e6, 50_000e6);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..865cd34485e55eaec39df90d5d46a7137dc2eeab
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,193 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @title FreelanceEscrow
+/// @notice Holds a configured USD stablecoin for freelance jobs until release or refund.
+/// @dev The configured token must be a conventional, non-rebasing ERC-20 (for example USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 reviewDeadline;
+        Status status;
+        bytes32 termsHash;
+        bytes32 deliveryHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidReviewPeriod();
+    error InvalidStatus();
+    error ReviewPeriodActive();
+    error TransferFailed();
+    error ReentrantCall();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    );
+    event DeliverySubmitted(uint256 indexed jobId, bytes32 deliveryHash, uint256 reviewDeadline);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    uint256 public constant MIN_REVIEW_PERIOD = 1 days;
+    uint256 public constant MAX_REVIEW_PERIOD = 30 days;
+
+    address public immutable paymentToken;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint256 public nextJobId = 1;
+    mapping(uint256 => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    constructor(address token, uint256 minimum, uint256 maximum) {
+        if (token == address(0)) revert InvalidAddress();
+        if (minimum == 0 || maximum < minimum || maximum > type(uint128).max) {
+            revert InvalidAmount();
+        }
+        paymentToken = token;
+        minimumAmount = minimum;
+        maximumAmount = maximum;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(
+        address freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 termsHash
+    ) external nonReentrant returns (uint256 jobId) {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || arbiter == freelancer) {
+            revert InvalidAddress();
+        }
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint128(amount),
+            reviewDeadline: 0,
+            status: Status.Funded,
+            termsHash: termsHash,
+            deliveryHash: bytes32(0)
+        });
+
+        _safeTransferFrom(paymentToken, msg.sender, address(this), amount);
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, termsHash);
+    }
+
+    function submitDelivery(uint256 jobId, bytes32 deliveryHash, uint256 reviewPeriod) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (deliveryHash == bytes32(0)) revert InvalidAmount();
+        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) {
+            revert InvalidReviewPeriod();
+        }
+
+        job.deliveryHash = deliveryHash;
+        job.reviewDeadline = uint64(block.timestamp + reviewPeriod);
+        job.status = Status.Delivered;
+        emit DeliverySubmitted(jobId, deliveryHash, job.reviewDeadline);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        _payFreelancer(jobId, job);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        if (block.timestamp <= job.reviewDeadline) revert ReviewPeriodActive();
+        _payFreelancer(jobId, job);
+    }
+
+    /// @notice The freelancer may agree to cancel and return all funds before a dispute.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        uint256 amount = job.amount;
+        job.status = Status.Refunded;
+        _safeTransfer(paymentToken, job.client, amount);
+        emit PaymentRefunded(jobId, amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (freelancerAmount > amount) revert InvalidAmount();
+        uint256 clientAmount = amount - freelancerAmount;
+        job.status = Status.Resolved;
+
+        if (freelancerAmount != 0) _safeTransfer(paymentToken, job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(paymentToken, job.client, clientAmount);
+        emit DisputeResolved(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _payFreelancer(uint256 jobId, Job storage job) private {
+        uint256 amount = job.amount;
+        job.status = Status.Released;
+        _safeTransfer(paymentToken, job.freelancer, amount);
+        emit PaymentReleased(jobId, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(
+                bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount
+            )
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a80a0fb23a54df311e8d21675a8cc8a74c1afee
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,87 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount; return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+        token.mint(CLIENT, 50_000e6);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesPayment() public {
+        uint256 id = _create(10_000e6);
+        vm.prank(CLIENT); escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == 10_000e6);
+        (, , , , , FreelanceEscrow.Status status, ,) = escrow.jobs(id);
+        assert(status == FreelanceEscrow.Status.Released);
+    }
+
+    function testFreelancerClaimsAfterReview() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(FREELANCER); escrow.claimAfterReview(id);
+        assert(token.balanceOf(FREELANCER) == 2_000e6);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(50_000e6);
+        vm.prank(FREELANCER); escrow.submitDelivery(id, keccak256("deliverable"), 3 days);
+        vm.prank(CLIENT); escrow.openDispute(id);
+        vm.prank(ARBITER); escrow.resolveDispute(id, 30_000e6);
+        assert(token.balanceOf(FREELANCER) == 30_000e6);
+        assert(token.balanceOf(CLIENT) == 20_000e6);
+    }
+
+    function testRejectsOutOfRangeJob() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, keccak256("terms"));
+    }
+
+    function testClientCannotRefundItself() public {
+        uint256 id = _create(2_000e6);
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.refund(id);
+    }
+
+    function _create(uint256 amount) private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, amount, keccak256("signed terms v1"));
+    }
+}
+

tokens used
42,666
Implemented a deployable Foundry-based USDC escrow.

Key features:

- Enforces $2,000–$50,000 USDC deposits
- Client payment release
- Freelancer-approved refunds
- Delivery submission with a 1–30 day review window
- Freelancer claim after review expiry
- Independent arbiter dispute resolution and split payments
- Reentrancy protection and safe ERC-20 transfers
- Deployment script configured through environment variables

Files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/test/FreelanceEscrow.t.sol)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1/workspace/README.md)

Verification: `forge test` passes all 5 tests, and the deployment script compiles successfully.

The README recommends testing on Base Sepolia and deploying to Base mainnet after an independent security audit.
