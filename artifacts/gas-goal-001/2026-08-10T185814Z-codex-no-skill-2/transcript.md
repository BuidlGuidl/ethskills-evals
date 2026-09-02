Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019fed0a-5173-7702-a085-f4510a6b3f8d
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
2026-08-10T18:58:24.461038Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019fed0a-5173-7702-a085-f4510a6b3f8d.tmp-1786388304248864707: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the workspace, then scaffold a focused Solidity project with tests, deployment configuration, and a concise deployment recommendation. I’ll treat the escrow amount as token-denominated rather than relying on an on-chain USD oracle unless the existing project suggests otherwise.
exec
/bin/bash -lc "pwd && rg --files -g '"'!node_modules'"' -g '"'!lib'"' | sed -n '1,160p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace
 succeeded in 9ms:
TASK.md

exec
/bin/bash -lc 'forge --version && solc --version || true' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace
 succeeded in 146ms:
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

codex
The directory is intentionally bare and Foundry is available, so I’m using a dependency-free Foundry setup. The contract will escrow a configurable ERC-20 stablecoin (intended for USDC), enforce the $2k–$50k range in token base units, and include delivery, review timeout, refund, dispute, and arbiter resolution paths.
2026-08-10T18:59:10.831724Z  WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 188ms)... turn_id=019fed0a-51e0-7130-a1a3-ab9e8e020bf9 retries=1 max_retries=5 sampling_error=stream disconnected before completion: WebSocket protocol error: Connection reset without closing handshake
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..b3eebec316bedcce752f85be70cd745b70cf9e68
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
@@ -0,0 +1,6 @@
+PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+BASE_RPC_URL=https://mainnet.base.org
+TOKEN_ADDRESS=0xYOUR_USDC_ADDRESS
+BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..b909a5a361235f2700b34aabb043dadc7bbfb8ba
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
@@ -0,0 +1,44 @@
+# Freelance Escrow
+
+A non-custodial ERC-20 escrow for freelance jobs. It is configured for payments from
+$2,000 to $50,000 in 6-decimal USDC. Clients fund jobs up front; contractors submit work;
+clients approve payment, or the contractor can claim after a 7-day review period. Either
+party can dispute submitted work and a job-specific arbiter can split the funds. Clients
+can refund a job whose delivery deadline passes without submission.
+
+## Test
+
+Requires [Foundry](https://getfoundry.sh/).
+
+```sh
+forge test
+```
+
+## Deploy
+
+Start on **Base Sepolia**, then deploy to **Base mainnet** after an independent security
+review. Base has low transaction fees, established USDC support, and Ethereum-compatible
+tooling. Use Circle's official native USDC contract address for the selected network;
+verify it from Circle's current documentation rather than copying an address from an
+untrusted source.
+
+```sh
+cp .env.example .env
+# Fill PRIVATE_KEY, TOKEN_ADDRESS, and the appropriate RPC URL, then:
+set -a; source .env; set +a
+forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast
+
+# After testing and review, mainnet deployment:
+forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployer needs ETH on the target network for gas. The deployment script fixes limits
+at `2_000e6` and `50_000e6`, so only use a 6-decimal dollar stablecoin. Before creating a
+job, the client must approve the escrow contract to spend the payment token. Choose an
+independent arbiter address for every job; the arbiter cannot move funds unless a party
+opens a dispute.
+
+This is production-oriented example code, not an audit. For $50,000 deposits, obtain a
+professional audit, use a multisig-operated deployment process, test the complete UI flow
+on Base Sepolia, and document the off-chain arbitration terms before accepting funds.
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..cb905bcb00caf92a239425d3c0053b8d596f97d5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f820690f4cf842be893782104c0f34b08df4bc0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,26 @@
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
+        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
+        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(deployerPrivateKey);
+        // USDC has 6 decimals: these values represent $2,000 and $50,000.
+        escrow = new FreelanceEscrow(IERC20(tokenAddress), 2_000e6, 50_000e6, 7 days);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2cec09872a4f8f460cbd106f23686a6a60245f02
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,187 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Minimal ERC-20 interface used by the escrow.
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Holds stablecoin payments until work is approved or a dispute is resolved.
+/// @dev Deploy one instance per supported token. Amount limits are token base units.
+contract FreelanceEscrow {
+    enum Status {
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address contractor;
+        address arbiter;
+        uint96 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId;
+
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error DeadlineNotReached();
+    error ReviewPeriodNotReached();
+    error TokenTransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed contractor,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, address indexed contractor, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, address indexed client, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 contractorAmount, uint256 clientAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token_, uint256 minimumAmount_, uint256 maximumAmount_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (minimumAmount_ == 0 || maximumAmount_ < minimumAmount_ || maximumAmount_ > type(uint96).max) {
+            revert InvalidAmount();
+        }
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        minimumAmount = minimumAmount_;
+        maximumAmount = maximumAmount_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    function createJob(address contractor, address arbiter, uint96 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (contractor == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            contractor: contractor,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            submittedAt: 0,
+            status: Status.Funded
+        });
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, contractor, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deliveryDeadline) revert InvalidDeadline();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert ReviewPeriodNotReached();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotReached();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.client, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint96 contractorAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (contractorAmount > job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+
+        uint256 clientAmount = job.amount - contractorAmount;
+        if (contractorAmount != 0) _safeTransfer(job.contractor, contractorAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit DisputeResolved(jobId, contractorAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c2c9ad64fe588780a12ca1eb89d5363b7ca83dc6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,102 @@
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
+    MockToken private token;
+    FreelanceEscrow private escrow;
+    address private constant CLIENT = address(0xA11CE);
+    address private constant CONTRACTOR = address(0xB0B);
+    address private constant ARBITER = address(0xCAFE);
+    uint96 private constant AMOUNT = 10_000e6;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6, 7 days);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientApprovesSubmittedWork() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testContractorClaimsAfterReviewTimeout() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 7 days);
+        vm.prank(CONTRACTOR);
+        escrow.claimAfterReview(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 beforeBalance = token.balanceOf(CLIENT);
+        uint256 id = _createJob();
+        vm.warp(block.timestamp + 31 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        assert(token.balanceOf(CLIENT) == beforeBalance);
+    }
+
+    function testArbiterSplitsDisputedFunds() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6);
+        assert(token.balanceOf(CONTRACTOR) == 6_000e6);
+        assert(token.balanceOf(CLIENT) == 94_000e6);
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(CONTRACTOR, ARBITER, 1_999e6, uint64(block.timestamp + 30 days));
+    }
+
+    function _createJob() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(CONTRACTOR, ARBITER, AMOUNT, uint64(block.timestamp + 30 days));
+    }
+}
+

diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..b3eebec316bedcce752f85be70cd745b70cf9e68
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
@@ -0,0 +1,6 @@
+PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+BASE_RPC_URL=https://mainnet.base.org
+TOKEN_ADDRESS=0xYOUR_USDC_ADDRESS
+BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..b909a5a361235f2700b34aabb043dadc7bbfb8ba
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
@@ -0,0 +1,44 @@
+# Freelance Escrow
+
+A non-custodial ERC-20 escrow for freelance jobs. It is configured for payments from
+$2,000 to $50,000 in 6-decimal USDC. Clients fund jobs up front; contractors submit work;
+clients approve payment, or the contractor can claim after a 7-day review period. Either
+party can dispute submitted work and a job-specific arbiter can split the funds. Clients
+can refund a job whose delivery deadline passes without submission.
+
+## Test
+
+Requires [Foundry](https://getfoundry.sh/).
+
+```sh
+forge test
+```
+
+## Deploy
+
+Start on **Base Sepolia**, then deploy to **Base mainnet** after an independent security
+review. Base has low transaction fees, established USDC support, and Ethereum-compatible
+tooling. Use Circle's official native USDC contract address for the selected network;
+verify it from Circle's current documentation rather than copying an address from an
+untrusted source.
+
+```sh
+cp .env.example .env
+# Fill PRIVATE_KEY, TOKEN_ADDRESS, and the appropriate RPC URL, then:
+set -a; source .env; set +a
+forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast
+
+# After testing and review, mainnet deployment:
+forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployer needs ETH on the target network for gas. The deployment script fixes limits
+at `2_000e6` and `50_000e6`, so only use a 6-decimal dollar stablecoin. Before creating a
+job, the client must approve the escrow contract to spend the payment token. Choose an
+independent arbiter address for every job; the arbiter cannot move funds unless a party
+opens a dispute.
+
+This is production-oriented example code, not an audit. For $50,000 deposits, obtain a
+professional audit, use a multisig-operated deployment process, test the complete UI flow
+on Base Sepolia, and document the off-chain arbitration terms before accepting funds.
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..cb905bcb00caf92a239425d3c0053b8d596f97d5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f820690f4cf842be893782104c0f34b08df4bc0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,26 @@
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
+        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
+        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(deployerPrivateKey);
+        // USDC has 6 decimals: these values represent $2,000 and $50,000.
+        escrow = new FreelanceEscrow(IERC20(tokenAddress), 2_000e6, 50_000e6, 7 days);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2cec09872a4f8f460cbd106f23686a6a60245f02
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,187 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Minimal ERC-20 interface used by the escrow.
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Holds stablecoin payments until work is approved or a dispute is resolved.
+/// @dev Deploy one instance per supported token. Amount limits are token base units.
+contract FreelanceEscrow {
+    enum Status {
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address contractor;
+        address arbiter;
+        uint96 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId;
+
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error DeadlineNotReached();
+    error ReviewPeriodNotReached();
+    error TokenTransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed contractor,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, address indexed contractor, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, address indexed client, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 contractorAmount, uint256 clientAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token_, uint256 minimumAmount_, uint256 maximumAmount_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (minimumAmount_ == 0 || maximumAmount_ < minimumAmount_ || maximumAmount_ > type(uint96).max) {
+            revert InvalidAmount();
+        }
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        minimumAmount = minimumAmount_;
+        maximumAmount = maximumAmount_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    function createJob(address contractor, address arbiter, uint96 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (contractor == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            contractor: contractor,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            submittedAt: 0,
+            status: Status.Funded
+        });
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, contractor, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deliveryDeadline) revert InvalidDeadline();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert ReviewPeriodNotReached();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotReached();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.client, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint96 contractorAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (contractorAmount > job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+
+        uint256 clientAmount = job.amount - contractorAmount;
+        if (contractorAmount != 0) _safeTransfer(job.contractor, contractorAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit DisputeResolved(jobId, contractorAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c2c9ad64fe588780a12ca1eb89d5363b7ca83dc6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,102 @@
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
+    MockToken private token;
+    FreelanceEscrow private escrow;
+    address private constant CLIENT = address(0xA11CE);
+    address private constant CONTRACTOR = address(0xB0B);
+    address private constant ARBITER = address(0xCAFE);
+    uint96 private constant AMOUNT = 10_000e6;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6, 7 days);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientApprovesSubmittedWork() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testContractorClaimsAfterReviewTimeout() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 7 days);
+        vm.prank(CONTRACTOR);
+        escrow.claimAfterReview(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 beforeBalance = token.balanceOf(CLIENT);
+        uint256 id = _createJob();
+        vm.warp(block.timestamp + 31 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        assert(token.balanceOf(CLIENT) == beforeBalance);
+    }
+
+    function testArbiterSplitsDisputedFunds() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6);
+        assert(token.balanceOf(CONTRACTOR) == 6_000e6);
+        assert(token.balanceOf(CLIENT) == 94_000e6);
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(CONTRACTOR, ARBITER, 1_999e6, uint64(block.timestamp + 30 days));
+    }
+
+    function _createJob() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(CONTRACTOR, ARBITER, AMOUNT, uint64(block.timestamp + 30 days));
+    }
+}
+

exec
/bin/bash -lc 'forge fmt --check && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace
 exited 1 in 27ms:
Diff in src/FreelanceEscrow.sol:
72  72   |         locked = 1;
73  73   |     }
74  74   | 
75       |-    constructor(IERC20 token_, uint256 minimumAmount_, uint256 maximumAmount_, uint64 reviewPeriod_) {
    75   |+    constructor(
    76   |+        IERC20 token_,
    77   |+        uint256 minimumAmount_,
    78   |+        uint256 maximumAmount_,
    79   |+        uint64 reviewPeriod_
    80   |+    ) {
76  81   |         if (address(token_) == address(0)) revert InvalidAddress();
77       |-        if (minimumAmount_ == 0 || maximumAmount_ < minimumAmount_ || maximumAmount_ > type(uint96).max) {
    82   |+        if (
    83   |+            minimumAmount_ == 0 || maximumAmount_ < minimumAmount_
    84   |+                || maximumAmount_ > type(uint96).max
    85   |+        ) {
78  86   |             revert InvalidAmount();
79  87   |         }
80  88   |         if (reviewPeriod_ == 0) revert InvalidDeadline();
--------------------------------------------------------------------------------90  98   |         returns (uint256 jobId)
91  99   |     {
92  100  |         if (contractor == address(0) || arbiter == address(0)) revert InvalidAddress();
93       |-        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) revert InvalidAddress();
    101  |+        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) {
    102  |+            revert InvalidAddress();
    103  |+        }
94  104  |         if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
95  105  |         if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
96  106  | 
--------------------------------------------------------------------------------107 117  | 
108 118  |         uint256 balanceBefore = token.balanceOf(address(this));
109 119  |         _safeTransferFrom(msg.sender, address(this), amount);
110      |-        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedTokenBehavior();
    120  |+        if (token.balanceOf(address(this)) != balanceBefore + amount) {
    121  |+            revert UnsupportedTokenBehavior();
    122  |+        }
111 123  | 
112 124  |         emit JobCreated(jobId, msg.sender, contractor, arbiter, amount, deliveryDeadline);
113 125  |     }
--------------------------------------------------------------------------------135 147  |         Job storage job = jobs[jobId];
136 148  |         if (msg.sender != job.contractor) revert Unauthorized();
137 149  |         if (job.status != Status.Submitted) revert InvalidStatus();
138      |-        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert ReviewPeriodNotReached();
    150  |+        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) {
    151  |+            revert ReviewPeriodNotReached();
    152  |+        }
139 153  |         job.status = Status.Released;
140 154  |         _safeTransfer(job.contractor, job.amount);
141 155  |         emit PaymentReleased(jobId, job.contractor, job.amount);
--------------------------------------------------------------------------------175 189  |     function _safeTransfer(address to, uint256 amount) private {
176 190  |         (bool success, bytes memory data) =
177 191  |             address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
178      |-        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    192  |+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
    193  |+            revert TokenTransferFailed();
    194  |+        }
179 195  |     }
180 196  | 
181 197  |     function _safeTransferFrom(address from, address to, uint256 amount) private {
182 198  |         (bool success, bytes memory data) =
183 199  |             address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
184      |-        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    200  |+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
    201  |+            revert TokenTransferFailed();
    202  |+        }
185 203  |     }
186 204  | }
187 205  | 

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

diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..b3eebec316bedcce752f85be70cd745b70cf9e68
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
@@ -0,0 +1,6 @@
+PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+BASE_RPC_URL=https://mainnet.base.org
+TOKEN_ADDRESS=0xYOUR_USDC_ADDRESS
+BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..b909a5a361235f2700b34aabb043dadc7bbfb8ba
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
@@ -0,0 +1,44 @@
+# Freelance Escrow
+
+A non-custodial ERC-20 escrow for freelance jobs. It is configured for payments from
+$2,000 to $50,000 in 6-decimal USDC. Clients fund jobs up front; contractors submit work;
+clients approve payment, or the contractor can claim after a 7-day review period. Either
+party can dispute submitted work and a job-specific arbiter can split the funds. Clients
+can refund a job whose delivery deadline passes without submission.
+
+## Test
+
+Requires [Foundry](https://getfoundry.sh/).
+
+```sh
+forge test
+```
+
+## Deploy
+
+Start on **Base Sepolia**, then deploy to **Base mainnet** after an independent security
+review. Base has low transaction fees, established USDC support, and Ethereum-compatible
+tooling. Use Circle's official native USDC contract address for the selected network;
+verify it from Circle's current documentation rather than copying an address from an
+untrusted source.
+
+```sh
+cp .env.example .env
+# Fill PRIVATE_KEY, TOKEN_ADDRESS, and the appropriate RPC URL, then:
+set -a; source .env; set +a
+forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast
+
+# After testing and review, mainnet deployment:
+forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployer needs ETH on the target network for gas. The deployment script fixes limits
+at `2_000e6` and `50_000e6`, so only use a 6-decimal dollar stablecoin. Before creating a
+job, the client must approve the escrow contract to spend the payment token. Choose an
+independent arbiter address for every job; the arbiter cannot move funds unless a party
+opens a dispute.
+
+This is production-oriented example code, not an audit. For $50,000 deposits, obtain a
+professional audit, use a multisig-operated deployment process, test the complete UI flow
+on Base Sepolia, and document the off-chain arbitration terms before accepting funds.
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..cb905bcb00caf92a239425d3c0053b8d596f97d5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f820690f4cf842be893782104c0f34b08df4bc0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,26 @@
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
+        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
+        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(deployerPrivateKey);
+        // USDC has 6 decimals: these values represent $2,000 and $50,000.
+        escrow = new FreelanceEscrow(IERC20(tokenAddress), 2_000e6, 50_000e6, 7 days);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2cec09872a4f8f460cbd106f23686a6a60245f02
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,187 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Minimal ERC-20 interface used by the escrow.
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Holds stablecoin payments until work is approved or a dispute is resolved.
+/// @dev Deploy one instance per supported token. Amount limits are token base units.
+contract FreelanceEscrow {
+    enum Status {
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address contractor;
+        address arbiter;
+        uint96 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId;
+
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error DeadlineNotReached();
+    error ReviewPeriodNotReached();
+    error TokenTransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed contractor,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, address indexed contractor, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, address indexed client, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 contractorAmount, uint256 clientAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token_, uint256 minimumAmount_, uint256 maximumAmount_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (minimumAmount_ == 0 || maximumAmount_ < minimumAmount_ || maximumAmount_ > type(uint96).max) {
+            revert InvalidAmount();
+        }
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        minimumAmount = minimumAmount_;
+        maximumAmount = maximumAmount_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    function createJob(address contractor, address arbiter, uint96 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (contractor == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            contractor: contractor,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            submittedAt: 0,
+            status: Status.Funded
+        });
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, contractor, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deliveryDeadline) revert InvalidDeadline();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert ReviewPeriodNotReached();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotReached();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.client, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint96 contractorAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (contractorAmount > job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+
+        uint256 clientAmount = job.amount - contractorAmount;
+        if (contractorAmount != 0) _safeTransfer(job.contractor, contractorAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit DisputeResolved(jobId, contractorAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c2c9ad64fe588780a12ca1eb89d5363b7ca83dc6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,102 @@
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
+    MockToken private token;
+    FreelanceEscrow private escrow;
+    address private constant CLIENT = address(0xA11CE);
+    address private constant CONTRACTOR = address(0xB0B);
+    address private constant ARBITER = address(0xCAFE);
+    uint96 private constant AMOUNT = 10_000e6;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6, 7 days);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientApprovesSubmittedWork() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testContractorClaimsAfterReviewTimeout() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 7 days);
+        vm.prank(CONTRACTOR);
+        escrow.claimAfterReview(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 beforeBalance = token.balanceOf(CLIENT);
+        uint256 id = _createJob();
+        vm.warp(block.timestamp + 31 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        assert(token.balanceOf(CLIENT) == beforeBalance);
+    }
+
+    function testArbiterSplitsDisputedFunds() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6);
+        assert(token.balanceOf(CONTRACTOR) == 6_000e6);
+        assert(token.balanceOf(CLIENT) == 94_000e6);
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(CONTRACTOR, ARBITER, 1_999e6, uint64(block.timestamp + 30 days));
+    }
+
+    function _createJob() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(CONTRACTOR, ARBITER, AMOUNT, uint64(block.timestamp + 30 days));
+    }
+}
+

codex
The first verification pass only found formatting differences; I’m applying Foundry’s formatter and rerunning compilation and all behavioral tests.
exec
/bin/bash -lc 'forge fmt && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace
 succeeded in 263ms:
Compiling 2 files with Solc 0.8.20
Solc 0.8.20 finished in 203.89ms
Compiler run successful!
2026-08-10T19:00:43.065687Z  WARN evm::traces::external: etherscan config not found

Ran 5 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterSplitsDisputedFunds() (gas: 186801)
[PASS] testClientApprovesSubmittedWork() (gas: 180073)
[PASS] testClientRefundsMissedDeadline() (gas: 153480)
[PASS] testContractorClaimsAfterReviewTimeout() (gas: 180686)
[PASS] testRejectsAmountBelowMinimum() (gas: 14701)
Suite result: ok. 5 passed; 0 failed; 0 skipped; finished in 635.69µs (1.08ms CPU time)

Ran 1 test suite in 10.49ms (635.69µs CPU time): 5 tests passed, 0 failed, 0 skipped (5 total tests)
2026-08-10T19:00:43.076963Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..b3eebec316bedcce752f85be70cd745b70cf9e68
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
@@ -0,0 +1,6 @@
+PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+BASE_RPC_URL=https://mainnet.base.org
+TOKEN_ADDRESS=0xYOUR_USDC_ADDRESS
+BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..b909a5a361235f2700b34aabb043dadc7bbfb8ba
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
@@ -0,0 +1,44 @@
+# Freelance Escrow
+
+A non-custodial ERC-20 escrow for freelance jobs. It is configured for payments from
+$2,000 to $50,000 in 6-decimal USDC. Clients fund jobs up front; contractors submit work;
+clients approve payment, or the contractor can claim after a 7-day review period. Either
+party can dispute submitted work and a job-specific arbiter can split the funds. Clients
+can refund a job whose delivery deadline passes without submission.
+
+## Test
+
+Requires [Foundry](https://getfoundry.sh/).
+
+```sh
+forge test
+```
+
+## Deploy
+
+Start on **Base Sepolia**, then deploy to **Base mainnet** after an independent security
+review. Base has low transaction fees, established USDC support, and Ethereum-compatible
+tooling. Use Circle's official native USDC contract address for the selected network;
+verify it from Circle's current documentation rather than copying an address from an
+untrusted source.
+
+```sh
+cp .env.example .env
+# Fill PRIVATE_KEY, TOKEN_ADDRESS, and the appropriate RPC URL, then:
+set -a; source .env; set +a
+forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast
+
+# After testing and review, mainnet deployment:
+forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployer needs ETH on the target network for gas. The deployment script fixes limits
+at `2_000e6` and `50_000e6`, so only use a 6-decimal dollar stablecoin. Before creating a
+job, the client must approve the escrow contract to spend the payment token. Choose an
+independent arbiter address for every job; the arbiter cannot move funds unless a party
+opens a dispute.
+
+This is production-oriented example code, not an audit. For $50,000 deposits, obtain a
+professional audit, use a multisig-operated deployment process, test the complete UI flow
+on Base Sepolia, and document the off-chain arbitration terms before accepting funds.
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..cb905bcb00caf92a239425d3c0053b8d596f97d5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f820690f4cf842be893782104c0f34b08df4bc0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,26 @@
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
+        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
+        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(deployerPrivateKey);
+        // USDC has 6 decimals: these values represent $2,000 and $50,000.
+        escrow = new FreelanceEscrow(IERC20(tokenAddress), 2_000e6, 50_000e6, 7 days);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2cec09872a4f8f460cbd106f23686a6a60245f02
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,187 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Minimal ERC-20 interface used by the escrow.
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Holds stablecoin payments until work is approved or a dispute is resolved.
+/// @dev Deploy one instance per supported token. Amount limits are token base units.
+contract FreelanceEscrow {
+    enum Status {
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address contractor;
+        address arbiter;
+        uint96 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId;
+
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error DeadlineNotReached();
+    error ReviewPeriodNotReached();
+    error TokenTransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed contractor,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, address indexed contractor, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, address indexed client, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 contractorAmount, uint256 clientAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token_, uint256 minimumAmount_, uint256 maximumAmount_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (minimumAmount_ == 0 || maximumAmount_ < minimumAmount_ || maximumAmount_ > type(uint96).max) {
+            revert InvalidAmount();
+        }
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        minimumAmount = minimumAmount_;
+        maximumAmount = maximumAmount_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    function createJob(address contractor, address arbiter, uint96 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (contractor == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            contractor: contractor,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            submittedAt: 0,
+            status: Status.Funded
+        });
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, contractor, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deliveryDeadline) revert InvalidDeadline();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert ReviewPeriodNotReached();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotReached();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.client, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint96 contractorAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (contractorAmount > job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+
+        uint256 clientAmount = job.amount - contractorAmount;
+        if (contractorAmount != 0) _safeTransfer(job.contractor, contractorAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit DisputeResolved(jobId, contractorAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c2c9ad64fe588780a12ca1eb89d5363b7ca83dc6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,102 @@
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
+    MockToken private token;
+    FreelanceEscrow private escrow;
+    address private constant CLIENT = address(0xA11CE);
+    address private constant CONTRACTOR = address(0xB0B);
+    address private constant ARBITER = address(0xCAFE);
+    uint96 private constant AMOUNT = 10_000e6;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6, 7 days);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientApprovesSubmittedWork() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testContractorClaimsAfterReviewTimeout() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 7 days);
+        vm.prank(CONTRACTOR);
+        escrow.claimAfterReview(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 beforeBalance = token.balanceOf(CLIENT);
+        uint256 id = _createJob();
+        vm.warp(block.timestamp + 31 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        assert(token.balanceOf(CLIENT) == beforeBalance);
+    }
+
+    function testArbiterSplitsDisputedFunds() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6);
+        assert(token.balanceOf(CONTRACTOR) == 6_000e6);
+        assert(token.balanceOf(CLIENT) == 94_000e6);
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(CONTRACTOR, ARBITER, 1_999e6, uint64(block.timestamp + 30 days));
+    }
+
+    function _createJob() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(CONTRACTOR, ARBITER, AMOUNT, uint64(block.timestamp + 30 days));
+    }
+}
+

2026-08-10T19:00:43.122714Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
exec
/bin/bash -lc 'git status --short 2>/dev/null || true && forge build --sizes' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace
 succeeded in 192ms:
?? ../../../../.pnp.cjs
?? ../../../../.pnp.loader.mjs
?? ../../../building-blocks-quiz-001/
?? ../../../building-blocks-quiz-002/
?? ../../2026-08-10T185641Z-codex-no-skill-1/
?? ../
Compiling 1 files with Solc 0.8.20
Solc 0.8.20 finished in 132.18ms
Compiler run successful!

╭-----------------+------------------+-------------------+--------------------+---------------------╮
| Contract        | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+===================================================================================================+
| Deploy          | 6,150            | 6,179             | 18,426             | 42,973              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| FreelanceEscrow | 4,896            | 5,325             | 19,680             | 43,827              |
|-----------------+------------------+-------------------+--------------------+---------------------|
| MockToken       | 941              | 970               | 23,635             | 48,182              |
╰-----------------+------------------+-------------------+--------------------+---------------------╯

2026-08-10T19:00:47.123265Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
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
  --> src/FreelanceEscrow.sol:34:29
   |
34 |     IERC20 public immutable token;
   |                             ^^^^^ help: consider using: `TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:35:30
   |
35 |     uint256 public immutable minimumAmount;
   |                              ^^^^^^^^^^^^^ help: consider using: `MINIMUM_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:36:30
   |
36 |     uint256 public immutable maximumAmount;
   |                              ^^^^^^^^^^^^^ help: consider using: `MAXIMUM_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:37:29
   |
37 |     uint64 public immutable reviewPeriod;
   |                             ^^^^^^^^^^^^ help: consider using: `REVIEW_PERIOD`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:68:5
   |
68 | /     modifier nonReentrant() {
69 | |         if (locked != 1) revert Reentrancy();
70 | |         locked = 2;
71 | |         _;
72 | |         locked = 1;
73 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
68 ~     modifier nonReentrant() {
69 +         _nonReentrantBefore();
70 +         _;
71 +         _nonReentrantAfter();
72 +     }
73 + 
74 +     function _nonReentrantBefore() internal {
75 +         if (locked != 1) revert Reentrancy();
76 +         locked = 2;
77 +     }
78 + 
79 +     function _nonReentrantAfter() internal {
80 +         locked = 1;
81 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic


diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..b3eebec316bedcce752f85be70cd745b70cf9e68
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
@@ -0,0 +1,6 @@
+PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+BASE_RPC_URL=https://mainnet.base.org
+TOKEN_ADDRESS=0xYOUR_USDC_ADDRESS
+BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..b909a5a361235f2700b34aabb043dadc7bbfb8ba
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
@@ -0,0 +1,44 @@
+# Freelance Escrow
+
+A non-custodial ERC-20 escrow for freelance jobs. It is configured for payments from
+$2,000 to $50,000 in 6-decimal USDC. Clients fund jobs up front; contractors submit work;
+clients approve payment, or the contractor can claim after a 7-day review period. Either
+party can dispute submitted work and a job-specific arbiter can split the funds. Clients
+can refund a job whose delivery deadline passes without submission.
+
+## Test
+
+Requires [Foundry](https://getfoundry.sh/).
+
+```sh
+forge test
+```
+
+## Deploy
+
+Start on **Base Sepolia**, then deploy to **Base mainnet** after an independent security
+review. Base has low transaction fees, established USDC support, and Ethereum-compatible
+tooling. Use Circle's official native USDC contract address for the selected network;
+verify it from Circle's current documentation rather than copying an address from an
+untrusted source.
+
+```sh
+cp .env.example .env
+# Fill PRIVATE_KEY, TOKEN_ADDRESS, and the appropriate RPC URL, then:
+set -a; source .env; set +a
+forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast
+
+# After testing and review, mainnet deployment:
+forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployer needs ETH on the target network for gas. The deployment script fixes limits
+at `2_000e6` and `50_000e6`, so only use a 6-decimal dollar stablecoin. Before creating a
+job, the client must approve the escrow contract to spend the payment token. Choose an
+independent arbiter address for every job; the arbiter cannot move funds unless a party
+opens a dispute.
+
+This is production-oriented example code, not an audit. For $50,000 deposits, obtain a
+professional audit, use a multisig-operated deployment process, test the complete UI flow
+on Base Sepolia, and document the off-chain arbitration terms before accepting funds.
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..cb905bcb00caf92a239425d3c0053b8d596f97d5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f820690f4cf842be893782104c0f34b08df4bc0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,26 @@
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
+        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
+        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(deployerPrivateKey);
+        // USDC has 6 decimals: these values represent $2,000 and $50,000.
+        escrow = new FreelanceEscrow(IERC20(tokenAddress), 2_000e6, 50_000e6, 7 days);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2cec09872a4f8f460cbd106f23686a6a60245f02
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,187 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Minimal ERC-20 interface used by the escrow.
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Holds stablecoin payments until work is approved or a dispute is resolved.
+/// @dev Deploy one instance per supported token. Amount limits are token base units.
+contract FreelanceEscrow {
+    enum Status {
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address contractor;
+        address arbiter;
+        uint96 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId;
+
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error DeadlineNotReached();
+    error ReviewPeriodNotReached();
+    error TokenTransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed contractor,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, address indexed contractor, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, address indexed client, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 contractorAmount, uint256 clientAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token_, uint256 minimumAmount_, uint256 maximumAmount_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (minimumAmount_ == 0 || maximumAmount_ < minimumAmount_ || maximumAmount_ > type(uint96).max) {
+            revert InvalidAmount();
+        }
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        minimumAmount = minimumAmount_;
+        maximumAmount = maximumAmount_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    function createJob(address contractor, address arbiter, uint96 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (contractor == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            contractor: contractor,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            submittedAt: 0,
+            status: Status.Funded
+        });
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, contractor, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deliveryDeadline) revert InvalidDeadline();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert ReviewPeriodNotReached();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotReached();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.client, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint96 contractorAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (contractorAmount > job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+
+        uint256 clientAmount = job.amount - contractorAmount;
+        if (contractorAmount != 0) _safeTransfer(job.contractor, contractorAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit DisputeResolved(jobId, contractorAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c2c9ad64fe588780a12ca1eb89d5363b7ca83dc6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,102 @@
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
+    MockToken private token;
+    FreelanceEscrow private escrow;
+    address private constant CLIENT = address(0xA11CE);
+    address private constant CONTRACTOR = address(0xB0B);
+    address private constant ARBITER = address(0xCAFE);
+    uint96 private constant AMOUNT = 10_000e6;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6, 7 days);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientApprovesSubmittedWork() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testContractorClaimsAfterReviewTimeout() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 7 days);
+        vm.prank(CONTRACTOR);
+        escrow.claimAfterReview(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 beforeBalance = token.balanceOf(CLIENT);
+        uint256 id = _createJob();
+        vm.warp(block.timestamp + 31 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        assert(token.balanceOf(CLIENT) == beforeBalance);
+    }
+
+    function testArbiterSplitsDisputedFunds() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6);
+        assert(token.balanceOf(CONTRACTOR) == 6_000e6);
+        assert(token.balanceOf(CLIENT) == 94_000e6);
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(CONTRACTOR, ARBITER, 1_999e6, uint64(block.timestamp + 30 days));
+    }
+
+    function _createJob() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(CONTRACTOR, ARBITER, AMOUNT, uint64(block.timestamp + 30 days));
+    }
+}
+

2026-08-10T19:00:47.180379Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
codex
Built a deployable Foundry escrow project.

Included:

- USDC escrow limits of $2,000–$50,000
- Client approval and contractor timeout claims
- Missed-deadline refunds
- Independent arbitration with split payouts
- Reentrancy and token-transfer protections
- Base Sepolia/Base deployment script
- Five passing contract tests
- Deployment and security guidance in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md)

Main contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol)

Verification: `forge test` passes all 5 tests; the deployed contract runtime is 4,896 bytes. Start on Base Sepolia, then use Base mainnet with native USDC after an audit.
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..b3eebec316bedcce752f85be70cd745b70cf9e68
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/.env.example
@@ -0,0 +1,6 @@
+PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+BASE_RPC_URL=https://mainnet.base.org
+TOKEN_ADDRESS=0xYOUR_USDC_ADDRESS
+BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..b909a5a361235f2700b34aabb043dadc7bbfb8ba
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md
@@ -0,0 +1,44 @@
+# Freelance Escrow
+
+A non-custodial ERC-20 escrow for freelance jobs. It is configured for payments from
+$2,000 to $50,000 in 6-decimal USDC. Clients fund jobs up front; contractors submit work;
+clients approve payment, or the contractor can claim after a 7-day review period. Either
+party can dispute submitted work and a job-specific arbiter can split the funds. Clients
+can refund a job whose delivery deadline passes without submission.
+
+## Test
+
+Requires [Foundry](https://getfoundry.sh/).
+
+```sh
+forge test
+```
+
+## Deploy
+
+Start on **Base Sepolia**, then deploy to **Base mainnet** after an independent security
+review. Base has low transaction fees, established USDC support, and Ethereum-compatible
+tooling. Use Circle's official native USDC contract address for the selected network;
+verify it from Circle's current documentation rather than copying an address from an
+untrusted source.
+
+```sh
+cp .env.example .env
+# Fill PRIVATE_KEY, TOKEN_ADDRESS, and the appropriate RPC URL, then:
+set -a; source .env; set +a
+forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast
+
+# After testing and review, mainnet deployment:
+forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployer needs ETH on the target network for gas. The deployment script fixes limits
+at `2_000e6` and `50_000e6`, so only use a 6-decimal dollar stablecoin. Before creating a
+job, the client must approve the escrow contract to spend the payment token. Choose an
+independent arbiter address for every job; the arbiter cannot move funds unless a party
+opens a dispute.
+
+This is production-oriented example code, not an audit. For $50,000 deposits, obtain a
+professional audit, use a multisig-operated deployment process, test the complete UI flow
+on Base Sepolia, and document the off-chain arbitration terms before accepting funds.
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..cb905bcb00caf92a239425d3c0053b8d596f97d5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base = "${BASE_RPC_URL}"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0f820690f4cf842be893782104c0f34b08df4bc0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,26 @@
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
+        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
+        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
+
+        vm.startBroadcast(deployerPrivateKey);
+        // USDC has 6 decimals: these values represent $2,000 and $50,000.
+        escrow = new FreelanceEscrow(IERC20(tokenAddress), 2_000e6, 50_000e6, 7 days);
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2cec09872a4f8f460cbd106f23686a6a60245f02
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,187 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Minimal ERC-20 interface used by the escrow.
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Holds stablecoin payments until work is approved or a dispute is resolved.
+/// @dev Deploy one instance per supported token. Amount limits are token base units.
+contract FreelanceEscrow {
+    enum Status {
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded,
+        Resolved
+    }
+
+    struct Job {
+        address client;
+        address contractor;
+        address arbiter;
+        uint96 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint256 public immutable minimumAmount;
+    uint256 public immutable maximumAmount;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId;
+
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error DeadlineNotReached();
+    error ReviewPeriodNotReached();
+    error TokenTransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed contractor,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, address indexed contractor, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, address indexed client, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 contractorAmount, uint256 clientAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token_, uint256 minimumAmount_, uint256 maximumAmount_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (minimumAmount_ == 0 || maximumAmount_ < minimumAmount_ || maximumAmount_ > type(uint96).max) {
+            revert InvalidAmount();
+        }
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        minimumAmount = minimumAmount_;
+        maximumAmount = maximumAmount_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    function createJob(address contractor, address arbiter, uint96 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (contractor == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (contractor == msg.sender || arbiter == msg.sender || arbiter == contractor) revert InvalidAddress();
+        if (amount < minimumAmount || amount > maximumAmount) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            contractor: contractor,
+            arbiter: arbiter,
+            amount: amount,
+            deliveryDeadline: deliveryDeadline,
+            submittedAt: 0,
+            status: Status.Funded
+        });
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, contractor, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deliveryDeadline) revert InvalidDeadline();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function approveWork(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function claimAfterReview(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert ReviewPeriodNotReached();
+        job.status = Status.Released;
+        _safeTransfer(job.contractor, job.amount);
+        emit PaymentReleased(jobId, job.contractor, job.amount);
+    }
+
+    function refundMissedDeadline(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deliveryDeadline) revert DeadlineNotReached();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.client, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.contractor) revert Unauthorized();
+        if (job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint96 contractorAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (contractorAmount > job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+
+        uint256 clientAmount = job.amount - contractorAmount;
+        if (contractorAmount != 0) _safeTransfer(job.contractor, contractorAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit DisputeResolved(jobId, contractorAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c2c9ad64fe588780a12ca1eb89d5363b7ca83dc6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,102 @@
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
+    MockToken private token;
+    FreelanceEscrow private escrow;
+    address private constant CLIENT = address(0xA11CE);
+    address private constant CONTRACTOR = address(0xB0B);
+    address private constant ARBITER = address(0xCAFE);
+    uint96 private constant AMOUNT = 10_000e6;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 2_000e6, 50_000e6, 7 days);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientApprovesSubmittedWork() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.approveWork(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testContractorClaimsAfterReviewTimeout() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 7 days);
+        vm.prank(CONTRACTOR);
+        escrow.claimAfterReview(id);
+        assert(token.balanceOf(CONTRACTOR) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 beforeBalance = token.balanceOf(CLIENT);
+        uint256 id = _createJob();
+        vm.warp(block.timestamp + 31 days);
+        vm.prank(CLIENT);
+        escrow.refundMissedDeadline(id);
+        assert(token.balanceOf(CLIENT) == beforeBalance);
+    }
+
+    function testArbiterSplitsDisputedFunds() public {
+        uint256 id = _createJob();
+        vm.prank(CONTRACTOR);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6);
+        assert(token.balanceOf(CONTRACTOR) == 6_000e6);
+        assert(token.balanceOf(CLIENT) == 94_000e6);
+    }
+
+    function testRejectsAmountBelowMinimum() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(CONTRACTOR, ARBITER, 1_999e6, uint64(block.timestamp + 30 days));
+    }
+
+    function _createJob() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(CONTRACTOR, ARBITER, AMOUNT, uint64(block.timestamp + 30 days));
+    }
+}
+

tokens used
35,278
Built a deployable Foundry escrow project.

Included:

- USDC escrow limits of $2,000–$50,000
- Client approval and contractor timeout claims
- Missed-deadline refunds
- Independent arbitration with split payouts
- Reentrancy and token-transfer protections
- Base Sepolia/Base deployment script
- Five passing contract tests
- Deployment and security guidance in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/README.md)

Main contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T185814Z-codex-no-skill-2/workspace/src/FreelanceEscrow.sol)

Verification: `forge test` passes all 5 tests; the deployed contract runtime is 4,896 bytes. Start on Base Sepolia, then use Base mainnet with native USDC after an audit.
