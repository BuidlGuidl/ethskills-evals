Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019fed16-61b4-7012-b2fc-eb60b30b5505
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
2026-08-10T19:11:35.038318Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019fed16-61b4-7012-b2fc-eb60b30b5505.tmp-1786389094843085622: line 2547: syntax error near unexpected token `('

codex
I’m using the gas skill because the deployment-chain choice should reflect current Ethereum and L2 transaction costs. I’ll inspect its required workflow, then build and test the contract locally.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && rg --files -g '"'!node_modules'"' -g '"'!lib'"' . | sed -n '1,160p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: gas
description: Measure current Ethereum transaction costs and use them when choosing between mainnet and L2s. Use when estimating gas or dollar costs, selecting a deployment chain, setting transaction fees, optimizing L2 fees, or claiming that Ethereum is expensive.
---

# Gas and Chain Cost

Your trained gas-price and ETH-price priors are stale. Never quote a transaction cost or exclude a chain for cost reasons without measuring the relevant chain now.

```bash
# Mainnet
cast base-fee --rpc-url https://ethereum-rpc.publicnode.com
cast gas-price --rpc-url https://ethereum-rpc.publicnode.com

# Example L2; query the chain actually under consideration
cast base-fee --rpc-url https://mainnet.base.org
cast gas-price --rpc-url https://mainnet.base.org
```

If an endpoint fails, try another RPC. Do not replace a failed lookup with a remembered number. Fetch ETH/USD live before quoting dollars.

Estimate the actual operation when possible. Otherwise state and justify the gas-used assumption:

```text
cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd
```

Choose from the measured workload:

- Keep mainnet viable for low-frequency, high-value actions unless another requirement favors an L2.
- Prefer an L2 for high-frequency, low-value, latency-sensitive, or L2-native activity.
- Do not choose an L2 merely because you remember mainnet gas being expensive.

Derive EIP-1559 fee fields from the target chain immediately before submission. Do not hardcode them or port a mainnet priority-fee constant to an L2.

For L2 optimization, inspect current receipts before deciding what dominates the fee. On OP-stack chains compare `gasUsed × effectiveGasPrice` with `l1Fee`; do not import a pre-Dencun calldata-cost assumption. Other rollup families use different fee models, so measure them independently.
./TASK.md

exec
/bin/bash -lc "command -v forge; command -v cast; cast base-fee --rpc-url https://ethereum-rpc.publicnode.com; cast gas-price --rpc-url https://ethereum-rpc.publicnode.com; cast base-fee --rpc-url https://mainnet.base.org; cast gas-price --rpc-url https://mainnet.base.org; curl -fsSL 'https://api.coinbase.com/v2/prices/ETH-USD/spot'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 succeeded in 1088ms:
152586848
152686848
5000000
6000000
{"data":{"amount":"1872.815","base":"ETH","currency":"USD"}}
codex
The workspace is empty, so I’m setting this up as a dependency-free Foundry project. The escrow will use an ERC-20 stablecoin (intended for native USDC) rather than volatile ETH, with per-job client/freelancer/arbiter roles, deadlines, disputes, split rulings, and inactivity escape hatches so funds cannot remain locked solely because one party disappears.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..728b9a0dcba74cbb84e7990152541417e59c599a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..728b9a0dcba74cbb84e7990152541417e59c599a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

2026-08-10T19:12:59.023331Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
exec
/bin/bash -lc 'forge fmt --check && forge test -vv && forge test --gas-report' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 exited 1 in 7ms:
Diff in src/FreelanceEscrow.sol:
151 151  |     }
152 152  | 
153 153  |     function _safeTransferFrom(address from, address to, uint256 amount) internal {
154      |-        (bool ok, bytes memory data) =
155      |-            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    154  |+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
156 155  |         if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
157 156  |     }
158 157  | }

Diff in test/FreelanceEscrow.t.sol:
12  12   | contract MockToken is IERC20 {
13  13   |     mapping(address => uint256) public balanceOf;
14  14   |     mapping(address => mapping(address => uint256)) public allowance;
15       |-    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
16       |-    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
17       |-    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
    15   |+
    16   |+    function mint(address to, uint256 amount) external {
    17   |+        balanceOf[to] += amount;
    18   |+    }
    19   |+
    20   |+    function approve(address spender, uint256 amount) external returns (bool) {
    21   |+        allowance[msg.sender][spender] = amount;
    22   |+        return true;
    23   |+    }
    24   |+
    25   |+    function transfer(address to, uint256 amount) external returns (bool) {
    26   |+        balanceOf[msg.sender] -= amount;
    27   |+        balanceOf[to] += amount;
    28   |+        return true;
    29   |+    }
    30   |+
18  31   |     function transferFrom(address from, address to, uint256 amount) external returns (bool) {
19       |-        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    32   |+        allowance[from][msg.sender] -= amount;
    33   |+        balanceOf[from] -= amount;
    34   |+        balanceOf[to] += amount;
    35   |+        return true;
20  36   |     }
21  37   | }
22  38   | 
--------------------------------------------------------------------------------30  46   |     FreelanceEscrow private escrow;
31  47   | 
32  48   |     function setUp() public {
33       |-        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
34       |-        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
    49   |+        token = new MockToken();
    50   |+        escrow = new FreelanceEscrow(token, 3 days);
    51   |+        token.mint(CLIENT, AMOUNT * 5);
    52   |+        vm.prank(CLIENT);
    53   |+        token.approve(address(escrow), type(uint256).max);
35  54   |     }
36  55   | 
37  56   |     function _create() private returns (uint256) {
38       |-        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
    57   |+        vm.prank(CLIENT);
    58   |+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
39  59   |     }
40  60   | 
41  61   |     function testClientReleasesSubmittedWork() public {
42       |-        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
43       |-        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
    62   |+        uint256 id = _create();
    63   |+        vm.prank(FREELANCER);
    64   |+        escrow.submitWork(id);
    65   |+        vm.prank(CLIENT);
    66   |+        escrow.release(id);
    67   |+        require(token.balanceOf(FREELANCER) == AMOUNT);
    68   |+        require(token.balanceOf(address(escrow)) == 0);
44  69   |     }
45  70   | 
46  71   |     function testFreelancerClaimsAfterReviewPeriod() public {
47       |-        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
48       |-        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
    72   |+        uint256 id = _create();
    73   |+        vm.prank(FREELANCER);
    74   |+        escrow.submitWork(id);
    75   |+        vm.warp(block.timestamp + 3 days);
    76   |+        vm.prank(FREELANCER);
    77   |+        escrow.release(id);
    78   |+        require(token.balanceOf(FREELANCER) == AMOUNT);
49  79   |     }
50  80   | 
51  81   |     function testClientRefundsMissedDeadline() public {
52       |-        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
    82   |+        uint256 id = _create();
    83   |+        vm.warp(block.timestamp + 7 days + 1);
    84   |+        vm.prank(CLIENT);
    85   |+        escrow.refund(id);
53  86   |         require(token.balanceOf(CLIENT) == AMOUNT * 5);
54  87   |     }
55  88   | 
56  89   |     function testArbiterSplitsDispute() public {
57       |-        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
    90   |+        uint256 id = _create();
    91   |+        vm.prank(FREELANCER);
    92   |+        escrow.openDispute(id);
    93   |+        vm.prank(ARBITER);
58  94   |         escrow.resolveDispute(id, 6_000e6, 4_000e6);
59       |-        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
    95   |+        require(token.balanceOf(FREELANCER) == 6_000e6);
    96   |+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
60  97   |     }
61  98   | 
62  99   |     function testOutsiderCannotRelease() public {
63       |-        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
    100  |+        uint256 id = _create();
    101  |+        vm.prank(address(0xBAD));
    102  |+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
    103  |+        escrow.release(id);
64  104  |     }
65  105  | }

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..728b9a0dcba74cbb84e7990152541417e59c599a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

2026-08-10T19:13:04.115942Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
exec
/bin/bash -lc 'forge fmt && forge test -vv && forge test --gas-report' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 exited 1 in 2321ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..728b9a0dcba74cbb84e7990152541417e59c599a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

exec
/bin/bash -lc 'FOUNDRY_CACHE_PATH=/tmp/foundry-cache FOUNDRY_OUT=out forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 exited 1 in 2207ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..728b9a0dcba74cbb84e7990152541417e59c599a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

exec
/bin/bash -lc "forge config | sed -n '1,100p'; ls -la ~/.svm ~/.foundry/cache 2>/dev/null || true; command -v solc || true" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 succeeded in 6ms:
[profile.default]
src = "src"
test = "test"
script = "script"
out = "out"
libs = ["lib"]
remappings = []
auto_detect_remappings = true
libraries = []
cache = true
dynamic_test_linking = false
cache_path = "cache"
snapshots = "snapshots"
gas_snapshot_check = false
gas_snapshot_emit = true
broadcast = "broadcast"
allow_paths = []
include_paths = []
skip = []
force = false
evm_version = "prague"
gas_reports = ["*"]
gas_reports_ignore = []
gas_reports_include_tests = false
solc = "0.8.30"
auto_detect_solc = true
offline = false
optimizer = true
optimizer_runs = 200
verbosity = 0
eth_rpc_accept_invalid_certs = false
ignored_error_codes = [
    "license",
    "code-size",
    "init-code-size",
    "transient-storage",
]
ignored_warnings_from = []
deny = "never"
test_failures_file = "cache/test-failures"
show_progress = false
ffi = false
allow_internal_expect_revert = false
always_use_create_2_factory = false
prompt_timeout = 120
sender = "0x1804c8ab1f12e6bbf3894d4083f33e07309d1f38"
tx_origin = "0x1804c8ab1f12e6bbf3894d4083f33e07309d1f38"
initial_balance = "0xffffffffffffffffffffffff"
block_number = 1
gas_limit = 1073741824
block_base_fee_per_gas = 0
block_coinbase = "0x0000000000000000000000000000000000000000"
block_timestamp = 1
block_difficulty = 0
block_prevrandao = "0x0000000000000000000000000000000000000000000000000000000000000000"
memory_limit = 134217728
extra_output = []
extra_output_files = []
names = false
sizes = false
via_ir = false
ast = false
no_storage_caching = false
no_rpc_rate_limit = false
use_literal_content = false
bytecode_hash = "ipfs"
cbor_metadata = true
sparse_mode = false
build_info = false
isolate = false
disable_block_gas_limit = false
enable_tx_gas_limit = false
unchecked_cheatcode_artifacts = false
create2_library_salt = "0x0000000000000000000000000000000000000000000000000000000000000000"
create2_deployer = "0x4e59b44847b379578588920ca78fbf26c0b4956c"
assertions_revert = true
legacy_assertions = false
celo = false
bypass_prevrandao = false
transaction_timeout = 120
additional_compiler_profiles = []
compilation_restrictions = []
script_execution_protection = true

[profile.default.rpc_storage_caching]
chains = "all"
endpoints = "all"

[[profile.default.fs_permissions]]
access = "read"
path = "out"

[fmt]
line_length = 120
tab_width = 4
style = "space"
bracket_spacing = false
int_types = "long"
multiline_func_header = "attributes_first"
quote_style = "double"
/home/damu/.foundry/cache:
total 84
drwxrwxr-x  4 damu damu  4096 Jan  9  2025 .
drwxrwxr-x  8 damu damu  4096 May 11 16:44 ..
drwxrwxr-x  5 damu damu  4096 Feb 25 09:27 etherscan
drwxrwxr-x 11 damu damu  4096 Jul 16 18:36 rpc
-rw-rw-r--  1 damu damu 66824 Aug  1 18:43 signatures

/home/damu/.svm:
total 44
drwxrwxr-x 11 damu damu 4096 Jul 16 18:35 .
drwxr-xr-x 84 damu damu 4096 Aug 10 16:08 ..
-rw-rw-r--  1 damu damu    0 Mar 22  2023 .global-version
drwxrwxr-x  2 damu damu 4096 May 22  2023 0.8.13
drwxrwxr-x  2 damu damu 4096 May 31  2023 0.8.17
drwxrwxr-x  2 damu damu 4096 Mar 22  2023 0.8.19
drwxrwxr-x  2 damu damu 4096 Apr  8 16:17 0.8.20
drwxrwxr-x  2 damu damu 4096 Jul 25  2024 0.8.22
drwxrwxr-x  2 damu damu 4096 Feb 23 13:09 0.8.23
drwxrwxr-x  2 damu damu 4096 Dec 27  2024 0.8.24
drwxrwxr-x  2 damu damu 4096 Jul 16 18:35 0.8.28
drwxrwxr-x  2 damu damu 4096 May  4 15:38 0.8.33
/home/damu/.local/bin/solc

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..728b9a0dcba74cbb84e7990152541417e59c599a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,12 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

exec
/bin/bash -lc 'forge test -vv && forge test --gas-report' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 succeeded in 271ms:
Compiling 2 files with Solc 0.8.33
Solc 0.8.33 finished in 175.85ms
Compiler run successful!
2026-08-10T19:13:32.182169Z  WARN evm::traces::external: etherscan config not found

Ran 5 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterSplitsDispute() (gas: 187719)
[PASS] testClientRefundsMissedDeadline() (gas: 156802)
[PASS] testClientReleasesSubmittedWork() (gas: 185446)
[PASS] testFreelancerClaimsAfterReviewPeriod() (gas: 185304)
[PASS] testOutsiderCannotRelease() (gas: 174415)
Suite result: ok. 5 passed; 0 failed; 0 skipped; finished in 700.03µs (1.37ms CPU time)

Ran 1 test suite in 8.96ms (700.03µs CPU time): 5 tests passed, 0 failed, 0 skipped (5 total tests)
2026-08-10T19:13:32.191944Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
No files changed, compilation skipped

Ran 5 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterSplitsDispute() (gas: 301051)
[PASS] testClientRefundsMissedDeadline() (gas: 234090)
[PASS] testClientReleasesSubmittedWork() (gas: 296438)
[PASS] testFreelancerClaimsAfterReviewPeriod() (gas: 287796)
[PASS] testOutsiderCannotRelease() (gas: 222503)
Suite result: ok. 5 passed; 0 failed; 0 skipped; finished in 946.02µs (1.75ms CPU time)

╭--------------------------------------------------+-----------------+--------+--------+--------+---------╮
| src/FreelanceEscrow.sol:FreelanceEscrow Contract |                 |        |        |        |         |
+=========================================================================================================+
| Deployment Cost                                  | Deployment Size |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| 1051063                                          | 4772            |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
|                                                  |                 |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| Function Name                                    | Min             | Avg    | Median | Max    | # Calls |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| createJob                                        | 182718          | 182718 | 182718 | 182718 | 5       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| openDispute                                      | 32591           | 32591  | 32591  | 32591  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| refund                                           | 46873           | 46873  | 46873  | 46873  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| release                                          | 33135           | 53835  | 63905  | 64466  | 3       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| resolveDispute                                   | 73287           | 73287  | 73287  | 73287  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| submitWork                                       | 35562           | 35562  | 35562  | 35562  | 2       |
╰--------------------------------------------------+-----------------+--------+--------+--------+---------╯

╭-----------------------------------------------+-----------------+-------+--------+-------+---------╮
| test/FreelanceEscrow.t.sol:MockToken Contract |                 |       |        |       |         |
+====================================================================================================+
| Deployment Cost                               | Deployment Size |       |        |       |         |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
| 256924                                        | 970             |       |        |       |         |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
|                                               |                 |       |        |       |         |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
| Function Name                                 | Min             | Avg   | Median | Max   | # Calls |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
| approve                                       | 44574           | 44574 | 44574  | 44574 | 5       |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
| balanceOf                                     | 563             | 1938  | 2563   | 2563  | 16      |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
| mint                                          | 44018           | 44018 | 44018  | 44018 | 5       |
╰-----------------------------------------------+-----------------+-------+--------+-------+---------╯


Ran 1 test suite in 1.84ms (946.02µs CPU time): 5 tests passed, 0 failed, 0 skipped (5 total tests)

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

codex
The core flows now pass five local tests. The measured contract deployment is about 1.05 million gas and each job creation about 183k gas; I’m finishing the deployment guide with live fee measurements and explicit warnings around token-address verification, arbiter trust, and production auditing.
web search: 
web search: site:developers.circle.com stablecoins USDC contract addresses Base mainnet Ethereum
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e06bdc5812f838cb9559ea38b7c0342905a52bc5
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..662c17988c906f9313ca2459d4904c323ad19b51
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,65 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken(); escrow = new FreelanceEscrow(token, 3 days); token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT); return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.prank(CLIENT); escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT); require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.submitWork(id); vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER); escrow.release(id); require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create(); vm.warp(block.timestamp + 7 days + 1); vm.prank(CLIENT); escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create(); vm.prank(FREELANCER); escrow.openDispute(id); vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6); require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create(); vm.prank(address(0xBAD)); vm.expectRevert(FreelanceEscrow.Unauthorized.selector); escrow.release(id);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge test -vv && git diff --check && rg --files | sort' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 succeeded in 234ms:
Compiling 2 files with Solc 0.8.33
Solc 0.8.33 finished in 160.10ms
Compiler run successful!
2026-08-10T19:14:31.243274Z  WARN evm::traces::external: etherscan config not found

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterSplitsDispute() (gas: 187888)
[PASS] testClientRefundsMissedDeadline() (gas: 156860)
[PASS] testClientReleasesSubmittedWork() (gas: 185504)
[PASS] testFreelancerClaimsAfterReviewPeriod() (gas: 185362)
[PASS] testOutsiderCannotRelease() (gas: 174540)
[PASS] testRejectsAmountsOutsideServiceRange() (gas: 22960)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 727.63µs (1.44ms CPU time)

Ran 1 test suite in 9.39ms (727.63µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
2026-08-10T19:14:31.253654Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
README.md
TASK.md
cache/solidity-files-cache.json
foundry.toml
out/FreelanceEscrow.sol/FreelanceEscrow.json
out/FreelanceEscrow.sol/IERC20.json
out/FreelanceEscrow.t.sol/FreelanceEscrowTest.json
out/FreelanceEscrow.t.sol/MockToken.json
out/FreelanceEscrow.t.sol/Vm.json
out/build-info/66ab6060b027b567.json
script/Deploy.s.sol
src/FreelanceEscrow.sol
test/FreelanceEscrow.t.sol

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d0c40bbc3107d29476462920f1199555c85287d4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,4 @@
+/broadcast/
+/cache/
+/out/
+/.env
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d0c40bbc3107d29476462920f1199555c85287d4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,4 @@
+/broadcast/
+/cache/
+/out/
+/.env
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

exec
/bin/bash -lc "forge test --gas-report | sed -n '/FreelanceEscrow Contract/,/MockToken Contract/p' | sed -n '1,35p'; git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 succeeded in 50ms:
| src/FreelanceEscrow.sol:FreelanceEscrow Contract |                 |        |        |        |         |
+=========================================================================================================+
| Deployment Cost                                  | Deployment Size |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| 1072208                                          | 4870            |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
|                                                  |                 |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| Function Name                                    | Min             | Avg    | Median | Max    | # Calls |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| createJob                                        | 27669           | 138459 | 182768 | 182768 | 7       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| openDispute                                      | 32591           | 32591  | 32591  | 32591  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| refund                                           | 46873           | 46873  | 46873  | 46873  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| release                                          | 33135           | 53835  | 63905  | 64466  | 3       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| resolveDispute                                   | 73398           | 73398  | 73398  | 73398  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| submitWork                                       | 35562           | 35562  | 35562  | 35562  | 2       |
╰--------------------------------------------------+-----------------+--------+--------+--------+---------╯

╭-----------------------------------------------+-----------------+-------+--------+-------+---------╮
| test/FreelanceEscrow.t.sol:MockToken Contract |                 |       |        |       |         |
?? ../../../../.pnp.cjs
?? ../../../../.pnp.loader.mjs
?? ../../../building-blocks-quiz-001/
?? ../../../building-blocks-quiz-002/
?? ../../2026-08-10T185641Z-codex-no-skill-1/
?? ../../2026-08-10T185814Z-codex-no-skill-2/
?? ../../2026-08-10T190125Z-codex-no-skill-3/
?? ../../2026-08-10T190443Z-codex-with-skill-1/
?? ../

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d0c40bbc3107d29476462920f1199555c85287d4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,4 @@
+/broadcast/
+/cache/
+/out/
+/.env
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

exec
/bin/bash -lc "awk 'BEGIN { gas=1072208; eth=1872.815; print gas*0.152686848e-9*eth, gas*0.006e-9*eth }'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace
 succeeded in 6ms:
0.306602 0.0120483

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d0c40bbc3107d29476462920f1199555c85287d4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,4 @@
+/broadcast/
+/cache/
+/out/
+/.env
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4b4e755607d582a9eac84c6fee18fa3f783c3b44
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,051,063, so the execution-gas component is roughly
+$0.30 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d0c40bbc3107d29476462920f1199555c85287d4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,4 @@
+/broadcast/
+/cache/
+/out/
+/.env
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4ccf725356e65890863ebbc8e52422e33bf8465d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,072,208, so the execution-gas component is roughly
+$0.31 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d0c40bbc3107d29476462920f1199555c85287d4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,4 @@
+/broadcast/
+/cache/
+/out/
+/.env
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4ccf725356e65890863ebbc8e52422e33bf8465d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,072,208, so the execution-gas component is roughly
+$0.31 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

codex
Built a deployable Foundry-based USDC escrow service.

Included:

- USDC deposits restricted to $2,000–$50,000
- Client release and missed-deadline refunds
- Freelancer claims after the review period
- Independent arbiters and split dispute resolutions
- Reentrancy protection and strict token-transfer checks
- Base/Base Sepolia deployment script
- Six passing tests
- Deployment instructions, measured gas costs, security warnings, and chain rationale in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md)

Core files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol)

Validation: `forge test` passes all 6 tests. I recommend Base with native USDC for launch, after Base Sepolia testing and an independent security/legal review.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d0c40bbc3107d29476462920f1199555c85287d4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,4 @@
+/broadcast/
+/cache/
+/out/
+/.env
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..4ccf725356e65890863ebbc8e52422e33bf8465d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md
@@ -0,0 +1,69 @@
+# Freelance Escrow
+
+A fixed-range USDC escrow for freelance jobs worth **$2,000–$50,000**. It is a dependency-free Foundry project.
+The client deposits the full amount when creating a job. The client can release it, the freelancer can claim it
+after a submitted job's review period, and the client can refund a missed deadline. Either party can open a dispute;
+the job's preselected arbiter can then allocate any exact split between them.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```sh
+forge test
+forge test --gas-report
+```
+
+The current suite covers release, inactivity claim, missed-deadline refund, dispute splitting, and access control.
+
+## Where to deploy
+
+I would launch on **Base**, using native USDC at
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Base makes routine create/release/dispute calls inexpensive while
+keeping Ethereum ecosystem tooling and native USDC. Circle's authoritative address list is
+[here](https://developers.circle.com/stablecoins/usdc-contract-addresses); verify it again before deploying.
+
+Measured on 2026-08-10: Ethereum mainnet gas price was 0.152686848 gwei, Base gas price was 0.006 gwei, and ETH/USD
+was $1,872.815. This contract's measured deployment gas is 1,072,208, so the execution-gas component is roughly
+$0.31 on Ethereum and $0.012 on Base (`gas × gasPrice × 1e-9 × ETH/USD`). A Base transaction also includes an L1 data
+fee, so those figures are not an all-in promise; inspect the first real receipt before budgeting. At today's unusually
+low mainnet fee, Ethereum is also viable for low-frequency, high-value jobs. Base is the better default if this will be
+a service with frequent job lifecycle transactions.
+
+## Deploy
+
+First use Base Sepolia and its test USDC
+(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Import a deployer into Foundry's encrypted keystore rather than putting
+a raw key in shell history:
+
+```sh
+cast wallet import deployer
+export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
+export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --broadcast
+```
+
+Test every flow with test USDC. Then deploy the exact reviewed commit to Base mainnet:
+
+```sh
+export BASE_RPC_URL="https://mainnet.base.org"
+export USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
+export REVIEW_PERIOD_SECONDS="259200"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --account deployer --broadcast
+```
+
+Foundry derives live EIP-1559 fee fields from the RPC; do not hardcode gas prices. Save and independently verify the
+printed deployment address, chain ID, constructor token, and review period. For a job, the client first approves the
+escrow for the USDC amount, then calls `createJob`. USDC has 6 decimals, so `$2,000` is `2000000000` units.
+
+## Production cautions
+
+- This is tested starter code, **not an audit**. Arrange an independent security review before holding real funds.
+- The arbiter is trusted to split disputed funds. Use an independent, contractually appointed arbiter or a multisig;
+  the arbiter cannot act unless a party opens a dispute.
+- Terms, evidence, and deliverables remain off-chain. Record each job ID and bind it to signed legal terms in your app.
+- Native USDC can freeze addresses under its issuer controls. The contract intentionally rejects fee-on-transfer tokens.
+- There is no admin, upgrade key, platform fee, or recovery backdoor. A deployment is immutable.
+- Escrow and dispute-resolution services may trigger licensing, money-transmission, sanctions, tax, and consumer-law
+  duties. Get advice for every jurisdiction served before launch.
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bf157b55e760ded080ffdfda9d131029d9e7893a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.33"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 120
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ee2add5ccc1b3bd3b38249f370b56af8b35ac6c
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol
@@ -0,0 +1,24 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function envUint(string calldata name) external view returns (uint256);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        uint256 reviewPeriod = vm.envUint("REVIEW_PERIOD_SECONDS");
+        require(reviewPeriod <= type(uint64).max, "review period too large");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), uint64(reviewPeriod));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c54a791acb246f995eb6ede7f9ccb718418a83ea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,159 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for a single ERC-20 token (normally USDC).
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Settled
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint128 amount;
+        uint64 deliveryDeadline;
+        uint64 submittedAt;
+        Status status;
+    }
+
+    IERC20 public immutable token;
+    uint64 public immutable reviewPeriod;
+    uint128 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint128 public constant MAX_JOB_AMOUNT = 50_000e6;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+    uint256 private locked = 1;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status actual);
+    error TooEarly();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint256 deliveryDeadline
+    );
+    event WorkSubmitted(uint256 indexed jobId, uint256 submittedAt);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event JobSettled(uint256 indexed jobId, uint256 freelancerAmount, uint256 clientAmount);
+
+    constructor(IERC20 token_, uint64 reviewPeriod_) {
+        if (address(token_) == address(0)) revert InvalidAddress();
+        if (reviewPeriod_ == 0) revert InvalidDeadline();
+        token = token_;
+        reviewPeriod = reviewPeriod_;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function createJob(address freelancer, address arbiter, uint128 amount, uint64 deliveryDeadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0)) revert InvalidAddress();
+        if (freelancer == msg.sender || arbiter == msg.sender || freelancer == arbiter) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deliveryDeadline <= block.timestamp) revert InvalidDeadline();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job(msg.sender, freelancer, arbiter, amount, deliveryDeadline, 0, Status.Funded);
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
+
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deliveryDeadline);
+    }
+
+    function submitWork(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (block.timestamp > job.deliveryDeadline) revert TooEarly();
+        job.status = Status.Submitted;
+        job.submittedAt = uint64(block.timestamp);
+        emit WorkSubmitted(jobId, block.timestamp);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        if (msg.sender != job.client) {
+            if (msg.sender != job.freelancer || job.status != Status.Submitted) revert Unauthorized();
+            if (block.timestamp < uint256(job.submittedAt) + reviewPeriod) revert TooEarly();
+        }
+        _settle(jobId, job, job.amount, 0);
+    }
+
+    /// @notice Freelancer may voluntarily refund at any time; client may refund after a missed delivery deadline.
+    function refund(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (job.status != Status.Funded) revert InvalidStatus(job.status);
+        if (msg.sender != job.freelancer) {
+            if (msg.sender != job.client) revert Unauthorized();
+            if (block.timestamp <= job.deliveryDeadline) revert TooEarly();
+        }
+        _settle(jobId, job, 0, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus(job.status);
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    /// @notice Arbiter allocates the fixed escrow amount. The two amounts must sum exactly to the deposit.
+    function resolveDispute(uint256 jobId, uint128 freelancerAmount, uint128 clientAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus(job.status);
+        if (uint256(freelancerAmount) + clientAmount != job.amount) revert InvalidAmount();
+        _settle(jobId, job, freelancerAmount, clientAmount);
+    }
+
+    function _settle(uint256 jobId, Job storage job, uint256 freelancerAmount, uint256 clientAmount) internal {
+        job.status = Status.Settled;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobSettled(jobId, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b4ac8ec23096c34340dced9c0b8a531cae303ad
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,115 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint128 private constant AMOUNT = 10_000e6;
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token, 3 days);
+        token.mint(CLIENT, AMOUNT * 5);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+        require(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testFreelancerClaimsAfterReviewPeriod() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.submitWork(id);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+        require(token.balanceOf(FREELANCER) == AMOUNT);
+    }
+
+    function testClientRefundsMissedDeadline() public {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 7 days + 1);
+        vm.prank(CLIENT);
+        escrow.refund(id);
+        require(token.balanceOf(CLIENT) == AMOUNT * 5);
+    }
+
+    function testArbiterSplitsDispute() public {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 6_000e6, 4_000e6);
+        require(token.balanceOf(FREELANCER) == 6_000e6);
+        require(token.balanceOf(CLIENT) == AMOUNT * 4 + 4_000e6);
+    }
+
+    function testOutsiderCannotRelease() public {
+        uint256 id = _create();
+        vm.prank(address(0xBAD));
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.release(id);
+    }
+
+    function testRejectsAmountsOutsideServiceRange() public {
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 2_000e6 - 1, uint64(block.timestamp + 7 days));
+
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        escrow.createJob(FREELANCER, ARBITER, 50_000e6 + 1, uint64(block.timestamp + 7 days));
+    }
+}

tokens used
78,599
Built a deployable Foundry-based USDC escrow service.

Included:

- USDC deposits restricted to $2,000–$50,000
- Client release and missed-deadline refunds
- Freelancer claims after the review period
- Independent arbiters and split dispute resolutions
- Reentrancy protection and strict token-transfer checks
- Base/Base Sepolia deployment script
- Six passing tests
- Deployment instructions, measured gas costs, security warnings, and chain rationale in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/README.md)

Core files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191124Z-codex-with-skill-2/workspace/test/FreelanceEscrow.t.sol)

Validation: `forge test` passes all 6 tests. I recommend Base with native USDC for launch, after Base Sepolia testing and an independent security/legal review.
