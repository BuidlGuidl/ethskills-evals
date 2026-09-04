Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019fed1a-4e95-7b31-af66-eb25e45458cf
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
2026-08-10T19:15:52.312594Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019fed1a-4e95-7b31-af66-eb25e45458cf.tmp-1786389352120927897: line 2547: syntax error near unexpected token `('

codex
I’m using the `gas` skill because the deployment-chain choice and fee guidance need current transaction-cost data. I’ll first inspect its workflow, then build and test the escrow contract and document deployment.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && printf '\\n__FILES__\\n' && rg --files -g '"'!node_modules'"' | sed -n '1,160p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
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

__FILES__
TASK.md

codex
The directory is bare, so I’m setting up a self-contained Foundry project. The design will use a stable ERC-20 (USDC at deployment) rather than volatile ETH, with per-job client/freelancer/arbiter roles, delivery and dispute states, deadline refunds, split arbitration, and no custodial admin key.
exec
/bin/bash -lc "set -o pipefail
command -v forge
forge --version
printf '__MAINNET__\\n'
cast base-fee --rpc-url https://ethereum-rpc.publicnode.com
cast gas-price --rpc-url https://ethereum-rpc.publicnode.com
printf '__BASE__\\n'
cast base-fee --rpc-url https://mainnet.base.org
cast gas-price --rpc-url https://mainnet.base.org
printf '__ETHUSD__\\n'
curl -fsSL 'https://api.coinbase.com/v2/prices/ETH-USD/spot'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 succeeded in 2213ms:
/home/damu/.foundry/bin/forge
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
__MAINNET__
104897269
104997269
__BASE__
5000000
6000000
__ETHUSD__
{"data":{"amount":"1873.475","base":"ETH","currency":"USD"}}
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d178b52bc641c2ff2c67f6a7c7cde5c6840e31f6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2457e03a87d4f6cb1f30f38cccb7a6471d628e6a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3558fbec55e6bae76c0b207f57bfcd6284cc88f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
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
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e22764ea00fda171dfc692310eca3edfcccd6aea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,113 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}
+

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d178b52bc641c2ff2c67f6a7c7cde5c6840e31f6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2457e03a87d4f6cb1f30f38cccb7a6471d628e6a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3558fbec55e6bae76c0b207f57bfcd6284cc88f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
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
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e22764ea00fda171dfc692310eca3edfcccd6aea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,113 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}
+

codex
The core lifecycle is implemented. I’m now compiling and exercising the happy path, expiry, arbitration split, authorization, deadline, and fund-accounting cases; after that I’ll use the compiled deployment size plus the live fee readings to make the chain recommendation concrete.
exec
/bin/bash -lc 'forge fmt --check && forge test -vv && forge test --gas-report' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 exited 1 in 2ms:
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d178b52bc641c2ff2c67f6a7c7cde5c6840e31f6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2457e03a87d4f6cb1f30f38cccb7a6471d628e6a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3558fbec55e6bae76c0b207f57bfcd6284cc88f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
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
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e22764ea00fda171dfc692310eca3edfcccd6aea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,113 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}
+

exec
/bin/bash -lc 'forge fmt && forge test -vv && forge test --gas-report' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 exited 1 in 1936ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d178b52bc641c2ff2c67f6a7c7cde5c6840e31f6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2457e03a87d4f6cb1f30f38cccb7a6471d628e6a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3558fbec55e6bae76c0b207f57bfcd6284cc88f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
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
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e22764ea00fda171dfc692310eca3edfcccd6aea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,113 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}
+

exec
/bin/bash -lc 'XDG_CACHE_HOME=/tmp/forge-cache FOUNDRY_CACHE_PATH=/tmp/foundry-project-cache forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 exited 1 in 2194ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d178b52bc641c2ff2c67f6a7c7cde5c6840e31f6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2457e03a87d4f6cb1f30f38cccb7a6471d628e6a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3558fbec55e6bae76c0b207f57bfcd6284cc88f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
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
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e22764ea00fda171dfc692310eca3edfcccd6aea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,113 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}
+

exec
/bin/bash -lc 'pwd; ls -ld . src test /tmp; touch .write-check && rm .write-check; RUST_BACKTRACE=1 XDG_CACHE_HOME=/tmp/forge-cache forge build -vvv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 exited 1 in 1902ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d178b52bc641c2ff2c67f6a7c7cde5c6840e31f6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2457e03a87d4f6cb1f30f38cccb7a6471d628e6a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3558fbec55e6bae76c0b207f57bfcd6284cc88f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
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
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e22764ea00fda171dfc692310eca3edfcccd6aea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,113 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}
+

exec
/bin/bash -lc "command -v solc || true; ls -la ~/.svm ~/.svm/0.8.30 2>/dev/null || true; forge config --json | sed -n '1,100p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 succeeded in 9ms:
{
  "src": "src",
  "test": "test",
  "script": "script",
  "out": "out",
  "libs": [
    "lib"
  ],
  "remappings": [],
  "auto_detect_remappings": true,
  "libraries": [],
  "cache": true,
  "dynamic_test_linking": false,
  "cache_path": "cache",
  "snapshots": "snapshots",
  "gas_snapshot_check": false,
  "gas_snapshot_emit": true,
  "broadcast": "broadcast",
  "allow_paths": [],
  "include_paths": [],
  "skip": [],
  "force": false,
  "evm_version": "prague",
  "gas_reports": [
    "*"
  ],
  "gas_reports_ignore": [],
  "gas_reports_include_tests": false,
  "solc": "0.8.30",
  "auto_detect_solc": true,
  "offline": false,
  "optimizer": true,
  "optimizer_runs": 200,
  "optimizer_details": null,
  "model_checker": null,
  "verbosity": 0,
  "eth_rpc_url": null,
  "eth_rpc_accept_invalid_certs": false,
  "eth_rpc_jwt": null,
  "eth_rpc_timeout": null,
  "eth_rpc_headers": null,
  "etherscan_api_key": null,
  "ignored_error_codes": [
    "license",
    "code-size",
    "init-code-size",
    "transient-storage"
  ],
  "ignored_warnings_from": [],
  "deny": "never",
  "match_test": null,
  "no_match_test": null,
  "match_contract": null,
  "no_match_contract": null,
  "match_path": null,
  "no_match_path": null,
  "no_match_coverage": null,
  "test_failures_file": "cache/test-failures",
  "threads": null,
  "show_progress": false,
  "fuzz": {
    "runs": 256,
    "fail_on_revert": true,
    "max_test_rejects": 65536,
    "seed": null,
    "dictionary_weight": 40,
    "include_storage": true,
    "include_push_bytes": true,
    "max_fuzz_dictionary_addresses": 15728640,
    "max_fuzz_dictionary_values": 9830400,
    "max_fuzz_dictionary_literals": 6553600,
    "gas_report_samples": 256,
    "corpus_dir": null,
    "corpus_gzip": true,
    "corpus_min_mutations": 5,
    "corpus_min_size": 0,
    "show_edge_coverage": false,
    "failure_persist_dir": "cache/fuzz",
    "show_logs": false,
    "timeout": null
  },
  "invariant": {
    "runs": 256,
    "depth": 500,
    "fail_on_revert": false,
    "call_override": false,
    "dictionary_weight": 80,
    "include_storage": true,
    "include_push_bytes": true,
    "max_fuzz_dictionary_addresses": 15728640,
    "max_fuzz_dictionary_values": 9830400,
    "max_fuzz_dictionary_literals": 6553600,
    "shrink_run_limit": 5000,
    "max_assume_rejects": 65536,
    "gas_report_samples": 256,
    "corpus_dir": null,
    "corpus_gzip": true,
    "corpus_min_mutations": 5,
    "corpus_min_size": 0,
    "show_edge_coverage": false,

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d178b52bc641c2ff2c67f6a7c7cde5c6840e31f6
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,16 @@
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
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2457e03a87d4f6cb1f30f38cccb7a6471d628e6a
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3558fbec55e6bae76c0b207f57bfcd6284cc88f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
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
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transfer, (to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) = address(paymentToken).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e22764ea00fda171dfc692310eca3edfcccd6aea
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,113 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
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
+    address private constant CLIENT = address(0xC1);
+    address private constant FREELANCER = address(0xF1);
+    address private constant ARBITER = address(0xA1);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}
+

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..401ca65b558a53ad6ce5517848bfc12b78b192c8
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1f114882f38aa3ec3e09da4420b5937e84727af
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,117 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..401ca65b558a53ad6ce5517848bfc12b78b192c8
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1f114882f38aa3ec3e09da4420b5937e84727af
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,117 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge test -vv && forge test --gas-report' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 succeeded in 241ms:
Compiling 2 files with Solc 0.8.28
Solc 0.8.28 finished in 142.12ms
Compiler run successful!
2026-08-10T19:18:18.963324Z  WARN evm::traces::external: etherscan config not found

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDispute() (gas: 167798)
[PASS] testCannotDeliverAfterDeadline() (gas: 149570)
[PASS] testCreateAndRelease() (gas: 162430)
[PASS] testExpiredUndeliveredRefund() (gas: 133781)
[PASS] testResolutionMustAccountForAllFunds() (gas: 158680)
[PASS] testUnauthorizedCannotRelease() (gas: 151764)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 840.36µs (1.81ms CPU time)

Ran 1 test suite in 6.98ms (840.36µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
2026-08-10T19:18:18.971427Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
No files changed, compilation skipped

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDispute() (gas: 305134)
[PASS] testCannotDeliverAfterDeadline() (gas: 193658)
[PASS] testCreateAndRelease() (gas: 268622)
[PASS] testExpiredUndeliveredRefund() (gas: 209069)
[PASS] testResolutionMustAccountForAllFunds() (gas: 263056)
[PASS] testUnauthorizedCannotRelease() (gas: 195852)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 978.40µs (2.20ms CPU time)

╭--------------------------------------------------+-----------------+--------+--------+--------+---------╮
| src/FreelanceEscrow.sol:FreelanceEscrow Contract |                 |        |        |        |         |
+=========================================================================================================+
| Deployment Cost                                  | Deployment Size |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| 991740                                           | 4375            |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
|                                                  |                 |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| Function Name                                    | Min             | Avg    | Median | Max    | # Calls |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| createJob                                        | 160418          | 160418 | 160418 | 160418 | 6       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| markDelivered                                    | 26107           | 29221  | 30260  | 30260  | 4       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| openDispute                                      | 30454           | 31522  | 31522  | 32591  | 2       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| refundExpired                                    | 44449           | 44449  | 44449  | 44449  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| release                                          | 28790           | 46238  | 46238  | 63687  | 2       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| resolveDispute                                   | 31413           | 51220  | 51220  | 71028  | 2       |
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
| approve                                       | 44574           | 44574 | 44574  | 44574 | 6       |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
| balanceOf                                     | 563             | 1857  | 2563   | 2563  | 17      |
|-----------------------------------------------+-----------------+-------+--------+-------+---------|
| mint                                          | 44018           | 44018 | 44018  | 44018 | 6       |
╰-----------------------------------------------+-----------------+-------+--------+-------+---------╯


Ran 1 test suite in 1.94ms (978.40µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..401ca65b558a53ad6ce5517848bfc12b78b192c8
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1f114882f38aa3ec3e09da4420b5937e84727af
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,117 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

codex
All six tests pass. Measured contract deployment is about 991,740 gas and job creation about 160,418 gas; I’m verifying the canonical USDC addresses from Circle before writing copy-paste deployment commands, so the README won’t rely on a remembered token address.
web search: 
web search: site:developers.circle.com USDC contract addresses Base Base Sepolia Ethereum
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..401ca65b558a53ad6ce5517848bfc12b78b192c8
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1f114882f38aa3ec3e09da4420b5937e84727af
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,117 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

exec
/bin/bash -lc "awk 'BEGIN { eth=1873.475; dg=991740; cg=160418; main=.104997269; base=.006; printf \"deploy main %.4f base_exec %.4f create main %.4f base_exec %.4f\\n\",dg*main*1e-9*eth,dg*base*1e-9*eth,cg*main*1e-9*eth,cg*base*1e-9*eth }'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
deploy main 0.1951 base_exec 0.0111 create main 0.0316 base_exec 0.0018

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..401ca65b558a53ad6ce5517848bfc12b78b192c8
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1f114882f38aa3ec3e09da4420b5937e84727af
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,117 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60b426ae84936fc0e5431edc0f5142e067a2fd49
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,83 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one ERC-20 selected in the constructor and rejects fee-on-transfer tokens. For
+USDC, amounts use 6 decimals: `$2,000 = 2_000e6` and `$50,000 = 50_000e6`.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 991,740 gas and `createJob` at about 160,418 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. The contract deliberately
+does not enforce the $2,000–$50,000 business range on-chain so deployments with
+different token decimals are not silently misconfigured; enforce that range in
+the application, or add explicit min/max constructor values before production.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..401ca65b558a53ad6ce5517848bfc12b78b192c8
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1f114882f38aa3ec3e09da4420b5937e84727af
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,117 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60b426ae84936fc0e5431edc0f5142e067a2fd49
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,83 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one ERC-20 selected in the constructor and rejects fee-on-transfer tokens. For
+USDC, amounts use 6 decimals: `$2,000 = 2_000e6` and `$50,000 = 50_000e6`.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 991,740 gas and `createJob` at about 160,418 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. The contract deliberately
+does not enforce the $2,000–$50,000 business range on-chain so deployments with
+different token decimals are not silently misconfigured; enforce that range in
+the application, or add explicit min/max constructor values before production.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..401ca65b558a53ad6ce5517848bfc12b78b192c8
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount == 0) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1f114882f38aa3ec3e09da4420b5937e84727af
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,117 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..688c83ddeb77f4bdd0e17bd2f67d614f34b5e0f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,82 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one 6-decimal ERC-20 selected in the constructor, rejects fee-on-transfer tokens,
+and enforces job sizes from 2,000e6 through 50,000e6 units. For USDC, that is
+exactly $2,000 through $50,000.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 991,740 gas and `createJob` at about 160,418 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. Do not deploy this build
+with a token that uses anything other than 6 decimals: its job limits are expressed
+in USDC-style base units.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ba5d4083e889f2bdf899e5e45b970517b18219ef
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..08582d4885809dc53fb0a62355706e5063a8a268
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function testEnforcesJobSizeRange() external {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days));
+
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 50_001e6, uint64(block.timestamp + 7 days));
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..688c83ddeb77f4bdd0e17bd2f67d614f34b5e0f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,82 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one 6-decimal ERC-20 selected in the constructor, rejects fee-on-transfer tokens,
+and enforces job sizes from 2,000e6 through 50,000e6 units. For USDC, that is
+exactly $2,000 through $50,000.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 991,740 gas and `createJob` at about 160,418 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. Do not deploy this build
+with a token that uses anything other than 6 decimals: its job limits are expressed
+in USDC-style base units.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ba5d4083e889f2bdf899e5e45b970517b18219ef
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..08582d4885809dc53fb0a62355706e5063a8a268
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function testEnforcesJobSizeRange() external {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days));
+
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 50_001e6, uint64(block.timestamp + 7 days));
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

codex
The contract now enforces the requested $2,000–$50,000 range directly in USDC’s 6-decimal units, with boundary-failure tests. I’m doing the final format/test pass and a deployment-script simulation against Base.
exec
/bin/bash -lc 'forge fmt --check && forge test -vv && PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 forge script script/Deploy.s.sol:Deploy --rpc-url https://mainnet.base.org -vv && git diff --check && git status --short' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 succeeded in 6155ms:
Compiling 2 files with Solc 0.8.28
Solc 0.8.28 finished in 149.00ms
Compiler run successful!
2026-08-10T19:19:27.332765Z  WARN evm::traces::external: etherscan config not found

Ran 7 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDispute() (gas: 167949)
[PASS] testCannotDeliverAfterDeadline() (gas: 149673)
[PASS] testCreateAndRelease() (gas: 162470)
[PASS] testEnforcesJobSizeRange() (gas: 22737)
[PASS] testExpiredUndeliveredRefund() (gas: 133821)
[PASS] testResolutionMustAccountForAllFunds() (gas: 158894)
[PASS] testUnauthorizedCannotRelease() (gas: 151934)
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 879.46µs (1.87ms CPU time)

Ran 1 test suite in 6.93ms (879.46µs CPU time): 7 tests passed, 0 failed, 0 skipped (7 total tests)
2026-08-10T19:19:27.340574Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 89.92ms
Compiler run successful!
2026-08-10T19:19:28.655220Z  WARN foundry_evm_traces::debug::sources: failed to parse contract definitions for test/FreelanceEscrow.t.sol
2026-08-10T19:19:29.491446Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/base/49800111"
2026-08-10T19:19:31.408319Z  WARN evm::traces::external: etherscan config not found
Script ran successfully.

== Return ==
escrow: contract FreelanceEscrow 0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519

## Setting up 1 EVM.

==========================

Chain 8453

Estimated gas price: 0.010000077 gwei

Estimated total gas used for script: 1307458

Estimated amount required: 0.000013074680674266 ETH

==========================
2026-08-10T19:19:33.270086Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

SIMULATION COMPLETE. To broadcast these transactions, add --broadcast and wallet configuration(s) to the previous command. See forge script --help for more.
2026-08-10T19:19:33.270233Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/base/49800111")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Transactions saved to: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/broadcast/Deploy.s.sol/8453/dry-run/run-latest.json

Sensitive values saved to: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/cache/Deploy.s.sol/8453/dry-run/run-latest.json

?? ../../../../.pnp.cjs
?? ../../../../.pnp.loader.mjs
?? ../../../building-blocks-quiz-001/
?? ../../../building-blocks-quiz-002/
?? ../../2026-08-10T185641Z-codex-no-skill-1/
?? ../../2026-08-10T185814Z-codex-no-skill-2/
?? ../../2026-08-10T190125Z-codex-no-skill-3/
?? ../../2026-08-10T190443Z-codex-with-skill-1/
?? ../../2026-08-10T191124Z-codex-with-skill-2/
?? ../

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..688c83ddeb77f4bdd0e17bd2f67d614f34b5e0f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,82 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one 6-decimal ERC-20 selected in the constructor, rejects fee-on-transfer tokens,
+and enforces job sizes from 2,000e6 through 50,000e6 units. For USDC, that is
+exactly $2,000 through $50,000.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 991,740 gas and `createJob` at about 160,418 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. Do not deploy this build
+with a token that uses anything other than 6 decimals: its job limits are expressed
+in USDC-style base units.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ba5d4083e889f2bdf899e5e45b970517b18219ef
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..08582d4885809dc53fb0a62355706e5063a8a268
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function testEnforcesJobSizeRange() external {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days));
+
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 50_001e6, uint64(block.timestamp + 7 days));
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

exec
/bin/bash -lc "forge test --gas-report 2>&1 | sed -n '/FreelanceEscrow Contract/,/MockToken Contract/p' | sed -n '1,45p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace
 succeeded in 38ms:
| src/FreelanceEscrow.sol:FreelanceEscrow Contract |                 |        |        |        |         |
+=========================================================================================================+
| Deployment Cost                                  | Deployment Size |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| 1005737                                          | 4440            |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
|                                                  |                 |        |        |        |         |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| Function Name                                    | Min             | Avg    | Median | Max    | # Calls |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| createJob                                        | 27533           | 127207 | 160428 | 160428 | 8       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| markDelivered                                    | 26107           | 29221  | 30260  | 30260  | 4       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| openDispute                                      | 30454           | 31522  | 31522  | 32591  | 2       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| refundExpired                                    | 44449           | 44449  | 44449  | 44449  | 1       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| release                                          | 28790           | 46238  | 46238  | 63687  | 2       |
|--------------------------------------------------+-----------------+--------+--------+--------+---------|
| resolveDispute                                   | 31524           | 51331  | 51331  | 71139  | 2       |
╰--------------------------------------------------+-----------------+--------+--------+--------+---------╯

╭-----------------------------------------------+-----------------+-------+--------+-------+---------╮
| test/FreelanceEscrow.t.sol:MockToken Contract |                 |       |        |       |         |

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..688c83ddeb77f4bdd0e17bd2f67d614f34b5e0f4
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,82 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one 6-decimal ERC-20 selected in the constructor, rejects fee-on-transfer tokens,
+and enforces job sizes from 2,000e6 through 50,000e6 units. For USDC, that is
+exactly $2,000 through $50,000.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 991,740 gas and `createJob` at about 160,418 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. Do not deploy this build
+with a token that uses anything other than 6 decimals: its job limits are expressed
+in USDC-style base units.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ba5d4083e889f2bdf899e5e45b970517b18219ef
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..08582d4885809dc53fb0a62355706e5063a8a268
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function testEnforcesJobSizeRange() external {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days));
+
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 50_001e6, uint64(block.timestamp + 7 days));
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9988f67a06c2436dc8392e730e35503655a8ff26
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,82 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one 6-decimal ERC-20 selected in the constructor, rejects fee-on-transfer tokens,
+and enforces job sizes from 2,000e6 through 50,000e6 units. For USDC, that is
+exactly $2,000 through $50,000.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 1,005,737 gas and `createJob` at about 160,428 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. Do not deploy this build
+with a token that uses anything other than 6 decimals: its job limits are expressed
+in USDC-style base units.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ba5d4083e889f2bdf899e5e45b970517b18219ef
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..08582d4885809dc53fb0a62355706e5063a8a268
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function testEnforcesJobSizeRange() external {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days));
+
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 50_001e6, uint64(block.timestamp + 7 days));
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9988f67a06c2436dc8392e730e35503655a8ff26
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,82 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one 6-decimal ERC-20 selected in the constructor, rejects fee-on-transfer tokens,
+and enforces job sizes from 2,000e6 through 50,000e6 units. For USDC, that is
+exactly $2,000 through $50,000.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 1,005,737 gas and `createJob` at about 160,428 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. Do not deploy this build
+with a token that uses anything other than 6 decimals: its job limits are expressed
+in USDC-style base units.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ba5d4083e889f2bdf899e5e45b970517b18219ef
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..08582d4885809dc53fb0a62355706e5063a8a268
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function testEnforcesJobSizeRange() external {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days));
+
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 50_001e6, uint64(block.timestamp + 7 days));
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

codex
Implemented a deployable Foundry escrow project.

Key features:

- USDC payments from $2,000–$50,000
- Client, freelancer, and independent arbiter roles
- Delivery confirmation and client release
- Deadline-based refunds
- Freelancer cancellation
- Dispute resolution with arbitrary client/freelancer split
- Reentrancy protection and safe token transfers
- No owner, upgrade key, fees, or withdrawal backdoor

Files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md)

Validation completed:

- 7/7 tests passing
- Base deployment simulation successful
- Deployment gas: approximately 1,005,737
- Recommended deployment: Base, after testing on Base Sepolia and completing an independent security audit

The README includes current gas-based chain reasoning, canonical Circle USDC addresses, deployment commands, lifecycle instructions, and production risks.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..3c831621866bd6a40b33193ccac6d6b9fb53e88d
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+/out/
+/cache/
+/broadcast/
+.env
+
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..9988f67a06c2436dc8392e730e35503655a8ff26
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md
@@ -0,0 +1,82 @@
+# Freelance escrow
+
+A non-custodial USDC escrow for freelance jobs. A client funds a job, the named
+freelancer marks it delivered, and the client releases payment. Either party can
+send a delivered job to its pre-agreed arbiter, who can split the escrow between
+them. If no delivery is recorded by the deadline, the client can refund it; the
+freelancer can also cancel an undelivered job.
+
+The contract has no owner, upgrade key, fee, or withdrawal backdoor. It accepts
+one 6-decimal ERC-20 selected in the constructor, rejects fee-on-transfer tokens,
+and enforces job sizes from 2,000e6 through 50,000e6 units. For USDC, that is
+exactly $2,000 through $50,000.
+
+## Test
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:
+
+```sh
+forge test
+```
+
+The tests cover release, expiry refund, split arbitration, authorization,
+deadline enforcement, and exact dispute accounting.
+
+## Where to deploy
+
+I would deploy on **Base**, after a Base Sepolia trial and an independent audit.
+This service will create and settle jobs repeatedly, so an L2 keeps routine user
+interactions cheap while retaining Ethereum settlement. Native USDC is available
+there at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it against
+[Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+before deploying).
+
+Measured on 2026-08-10: Ethereum mainnet gas was 0.104997269 gwei, Base gas was
+0.006 gwei, and ETH/USD was $1,873.475. The test gas report measures deployment
+at 1,005,737 gas and `createJob` at about 160,428 gas. That implies roughly $0.20
+to deploy and $0.032 to create a job on mainnet, versus Base execution portions
+of roughly $0.011 and $0.0018. Base transactions also include an L1 data fee, so
+those Base figures are not total fees. Recheck gas and ETH/USD immediately before
+deployment; these measurements are a snapshot, not fee settings.
+
+## Deploy
+
+First use Base Sepolia and Circle's test USDC:
+
+```sh
+export PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://sepolia.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Once tested and audited, deploy to Base mainnet:
+
+```sh
+export PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url https://mainnet.base.org \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Use a dedicated deployer key, never commit it or `.env`, and verify the printed
+contract address on the relevant block explorer. Foundry derives EIP-1559 fees
+from the target RPC at submission time; this project does not hardcode fee values.
+
+Before handling real funds, commission a security audit and decide operational
+rules for choosing trustworthy arbiters. A compromised or colluding arbiter can
+allocate any job that enters `Disputed`, although it cannot touch other jobs.
+USDC also carries issuer freeze/blacklist and depeg risk. Do not deploy this build
+with a token that uses anything other than 6 decimals: its job limits are expressed
+in USDC-style base units.
+
+## Job flow
+
+1. Client approves the escrow contract to spend the exact USDC amount, then calls
+   `createJob(freelancer, arbiter, amount, deadline)`.
+2. Freelancer calls `markDelivered(jobId)` before the deadline.
+3. Client calls `release(jobId)`, or either party calls `openDispute(jobId)` and
+   the arbiter calls `resolveDispute(jobId, clientAmount, freelancerAmount)`.
+4. For an undelivered expired job, the client calls `refundExpired(jobId)`.
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..64a7bd4eeaeb1daf46c4925d0b483cca8d8f07a7
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+
+[rpc_endpoints]
+base = "https://mainnet.base.org"
+base_sepolia = "https://sepolia.base.org"
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..575640629bab6729afc1c17aee3ebca732aacdf0
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,21 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external view returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envAddress("PAYMENT_TOKEN");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ba5d4083e889f2bdf899e5e45b970517b18219ef
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol
@@ -0,0 +1,183 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial, per-job escrow for one configured ERC-20 (normally USDC).
+/// @dev The arbiter can only distribute a disputed job's existing balance.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
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
+        uint64 deadline;
+        Status status;
+        uint256 amount;
+    }
+
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus();
+    error Unauthorized();
+    error DeadlinePassed();
+    error DeadlineNotPassed();
+    error TransferFailed();
+    error UnsupportedTokenBehavior();
+    error Reentrancy();
+
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    mapping(uint256 jobId => Job) public jobs;
+
+    uint256 private locked = 1;
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        uint64 deadline
+    );
+    event WorkDelivered(uint256 indexed jobId);
+    event DisputeOpened(uint256 indexed jobId, address indexed openedBy);
+    event PaymentReleased(uint256 indexed jobId, uint256 amount);
+    event PaymentRefunded(uint256 indexed jobId, uint256 amount);
+    event DisputeResolved(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(IERC20 token) {
+        if (address(token) == address(0) || address(token).code.length == 0) {
+            revert InvalidAddress();
+        }
+        paymentToken = token;
+    }
+
+    function createJob(address freelancer, address arbiter, uint256 amount, uint64 deadline)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) revert InvalidAddress();
+        if (amount < MIN_JOB_AMOUNT || amount > MAX_JOB_AMOUNT) revert InvalidAmount();
+        if (deadline <= block.timestamp) revert InvalidDeadline();
+
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) - balanceBefore != amount) {
+            revert UnsupportedTokenBehavior();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            deadline: deadline,
+            status: Status.Funded,
+            amount: amount
+        });
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, deadline);
+    }
+
+    function markDelivered(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp > job.deadline) revert DeadlinePassed();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit PaymentReleased(jobId, job.amount);
+    }
+
+    /// @notice The freelancer may cancel before delivery, returning all funds.
+    function cancel(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    /// @notice The client can recover an undelivered job after its deadline.
+    function refundExpired(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();
+        job.status = Status.Refunded;
+        _safeTransfer(job.client, job.amount);
+        emit PaymentRefunded(jobId, job.amount);
+    }
+
+    function openDispute(uint256 jobId) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender);
+    }
+
+    function resolveDispute(uint256 jobId, uint256 clientAmount, uint256 freelancerAmount)
+        external
+        nonReentrant
+    {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (clientAmount + freelancerAmount != job.amount) revert InvalidAmount();
+        job.status = Status.Resolved;
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool success, bytes memory data) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..08582d4885809dc53fb0a62355706e5063a8a268
--- /dev/null
+++ b/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
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
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockToken private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() external {
+        token = new MockToken();
+        escrow = new FreelanceEscrow(token);
+        token.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testCreateAndRelease() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.release(id);
+        assert(token.balanceOf(FREELANCER) == AMOUNT);
+        assert(token.balanceOf(address(escrow)) == 0);
+    }
+
+    function testExpiredUndeliveredRefund() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.prank(CLIENT);
+        escrow.refundExpired(id);
+        assert(token.balanceOf(CLIENT) == 100_000e6);
+    }
+
+    function testArbiterCanSplitDispute() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(CLIENT);
+        escrow.openDispute(id);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 2_500e6, 7_500e6);
+        assert(token.balanceOf(CLIENT) == 92_500e6);
+        assert(token.balanceOf(FREELANCER) == 7_500e6);
+    }
+
+    function testUnauthorizedCannotRelease() external {
+        uint256 id = _create();
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        vm.prank(FREELANCER);
+        escrow.release(id);
+    }
+
+    function testCannotDeliverAfterDeadline() external {
+        uint256 id = _create();
+        vm.warp(block.timestamp + 8 days);
+        vm.expectRevert(FreelanceEscrow.DeadlinePassed.selector);
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+    }
+
+    function testResolutionMustAccountForAllFunds() external {
+        uint256 id = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered(id);
+        vm.prank(FREELANCER);
+        escrow.openDispute(id);
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(ARBITER);
+        escrow.resolveDispute(id, 1, 1);
+    }
+
+    function testEnforcesJobSizeRange() external {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 1_999e6, uint64(block.timestamp + 7 days));
+
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT);
+        escrow.createJob(FREELANCER, ARBITER, 50_001e6, uint64(block.timestamp + 7 days));
+    }
+
+    function _create() private returns (uint256) {
+        vm.prank(CLIENT);
+        return escrow.createJob(FREELANCER, ARBITER, AMOUNT, uint64(block.timestamp + 7 days));
+    }
+}

tokens used
52,892
Implemented a deployable Foundry escrow project.

Key features:

- USDC payments from $2,000–$50,000
- Client, freelancer, and independent arbiter roles
- Delivery confirmation and client release
- Deadline-based refunds
- Freelancer cancellation
- Dispute resolution with arbitrary client/freelancer split
- Reentrancy protection and safe token transfers
- No owner, upgrade key, fees, or withdrawal backdoor

Files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/src/FreelanceEscrow.sol)
- [Deploy.s.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/script/Deploy.s.sol)
- [FreelanceEscrow.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/test/FreelanceEscrow.t.sol)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/gas-goal-001/2026-08-10T191542Z-codex-with-skill-3/workspace/README.md)

Validation completed:

- 7/7 tests passing
- Base deployment simulation successful
- Deployment gas: approximately 1,005,737
- Recommended deployment: Base, after testing on Base Sepolia and completing an independent security audit

The README includes current gas-based chain reasoning, canonical Circle USDC addresses, deployment commands, lifecycle instructions, and production risks.
