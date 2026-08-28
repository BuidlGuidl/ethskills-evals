# Executor transcript — 2026-08-27T233831Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04596-e896-7570-832c-5f1fc36df9d3
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-27T23:38:33.205029Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a04596-e896-7570-832c-5f1fc36df9d3.tmp-1787873912988871579: line 2547: syntax error near unexpected token `('

codex
I’ll build a deployable escrow contract with a focused Foundry setup, tests, and deployment instructions. Because the request involves selecting a chain and deployment cost, I’m using the gas guidance skill to make that choice responsibly.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && printf '\\n--- files ---\\n' && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,160p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001
 succeeded in 301ms:
---
name: gas
description: Use when quoting a gas or dollar cost for a transaction or deployment, when cost is the reason to pick mainnet over an L2, when setting EIP-1559 fee fields or cutting L2 fees, or when calling Ethereum expensive or cheap. Not for non-cost chain selection (`l2s`).
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

--- files ---
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,240p' TASK.md; printf '\\n--- package ---\\n'; sed -n '1,240p' package.json; printf '\\n--- git ---\\n'; git status --short; command -v forge || true; command -v cast || true" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001
 succeeded in 0ms:
codex
The project is currently empty and Foundry is available. I’m implementing escrow in a fixed USD-stablecoin unit (six-decimal USDC-style token), with explicit acceptance/release and an arbitrator-only dispute path—rather than pretending a smart contract can safely custody literal dollars.
exec
/bin/bash -lc 'cast gas-price --rpc-url https://ethereum-rpc.publicnode.com && cast base-fee --rpc-url https://ethereum-rpc.publicnode.com && cast gas-price --rpc-url https://mainnet.base.org && cast base-fee --rpc-url https://mainnet.base.org' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001
 succeeded in 1688ms:
52042833
51942833
6000000
5000000

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/.env.example
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/script/DeployFreelanceEscrow.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..a00d1b7fce3fc1f835f0839fa5d9bb41a9b4e90b
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Use a dedicated deployer wallet; never commit its private key.
+PRIVATE_KEY=
+RPC_URL=https://ethereum-rpc.publicnode.com
+USDC_ADDRESS=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
+ARBITRATOR=0x0000000000000000000000000000000000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..90e8dcccc51490249a3cf4fdb7b7a1fc6016fe85
--- /dev/null
+++ b/README.md
@@ -0,0 +1,41 @@
+# Freelance Escrow
+
+`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.
+
+This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.
+
+## Tooling
+
+This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.
+
+1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
+2. Load the variables into your shell:
+
+   ```sh
+   set -a; . ./.env; set +a
+   ```
+
+3. Simulate the deployment, then broadcast:
+
+   ```sh
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
+   ```
+
+`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.
+
+For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.
+
+## Operational notes
+
+- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
+- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
+- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dec645105438125e0413c6990dad372cdbc0d2c4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5218c6501c8d258b834e7edd4e8d9047c673c134
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), arbitrator);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..20acc6791609620685c4e389837872f4e84c421c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,133 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
+/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
+contract FreelanceEscrow {
+    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
+
+    struct Job {
+        address client;
+        address freelancer;
+        uint96 amount;
+        Status status;
+    }
+
+    error ZeroAddress();
+    error InvalidAmount();
+    error JobAlreadyExists();
+    error JobNotFound();
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error InvalidStatus();
+    error TokenTransferFailed();
+    error FeeOnTransferTokenNotSupported();
+    error InvalidAward();
+    error Reentrancy();
+
+    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
+    uint256 public constant MAX_ESCROW = 50_000 * 1e6;
+
+    IERC20 public immutable token;
+    address public immutable arbitrator;
+    uint256 private _locked = 1;
+
+    mapping(bytes32 => Job) public jobs;
+
+    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
+    event WorkDelivered(bytes32 indexed jobId);
+    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
+    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 token_, address arbitrator_) {
+        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
+        token = token_;
+        arbitrator = arbitrator_;
+    }
+
+    /// @notice Funds a new job. The client must first approve this contract for `amount`.
+    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
+        if (freelancer == address(0)) revert ZeroAddress();
+        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
+        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();
+
+        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
+        emit JobFunded(jobId, msg.sender, freelancer, amount);
+    }
+
+    function markDelivered(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.freelancer) revert NotFreelancer();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    /// @notice Client releases the full escrow after accepting delivery.
+    function release(bytes32 jobId) external nonReentrant {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client) revert NotClient();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit FundsReleased(jobId, job.freelancer, job.amount);
+    }
+
+    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
+    function raiseDispute(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender);
+    }
+
+    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
+    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        Job storage job = _job(jobId);
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (clientAward > amount) revert InvalidAward();
+
+        job.status = clientAward == amount ? Status.Refunded : Status.Released;
+        uint256 freelancerAward = amount - clientAward;
+        if (clientAward != 0) _safeTransfer(job.client, clientAward);
+        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
+        emit DisputeResolved(jobId, clientAward, freelancerAward);
+    }
+
+    function _job(bytes32 jobId) private view returns (Job storage job) {
+        job = jobs[jobId];
+        if (job.status == Status.None) revert JobNotFound();
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        if (!token.transfer(to, amount)) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a1a0c9f9d73f1069d2de5a5673fb19c593c69d17
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,74 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed < amount) return false;
+        allowance[from][msg.sender] = allowed - amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        if (balanceOf[from] < amount) return false;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITRATOR = address(0xA8B);
+    bytes32 private constant JOB = keccak256("job-1");
+    uint256 private constant AMOUNT = 5_000e6;
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
+        usdc.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesDeliveredWork() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.prank(CLIENT); escrow.release(JOB);
+        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
+        require(status == FreelanceEscrow.Status.Released, "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
+        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
+        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
+        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
+    }
+
+    function testOnlyClientCanRelease() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.expectRevert(FreelanceEscrow.NotClient.selector);
+        vm.prank(FREELANCER); escrow.release(JOB);
+    }
+
+    function testRejectsOutOfRangeEscrow() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..a00d1b7fce3fc1f835f0839fa5d9bb41a9b4e90b
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Use a dedicated deployer wallet; never commit its private key.
+PRIVATE_KEY=
+RPC_URL=https://ethereum-rpc.publicnode.com
+USDC_ADDRESS=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
+ARBITRATOR=0x0000000000000000000000000000000000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..90e8dcccc51490249a3cf4fdb7b7a1fc6016fe85
--- /dev/null
+++ b/README.md
@@ -0,0 +1,41 @@
+# Freelance Escrow
+
+`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.
+
+This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.
+
+## Tooling
+
+This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.
+
+1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
+2. Load the variables into your shell:
+
+   ```sh
+   set -a; . ./.env; set +a
+   ```
+
+3. Simulate the deployment, then broadcast:
+
+   ```sh
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
+   ```
+
+`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.
+
+For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.
+
+## Operational notes
+
+- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
+- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
+- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dec645105438125e0413c6990dad372cdbc0d2c4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5218c6501c8d258b834e7edd4e8d9047c673c134
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), arbitrator);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..20acc6791609620685c4e389837872f4e84c421c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,133 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
+/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
+contract FreelanceEscrow {
+    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
+
+    struct Job {
+        address client;
+        address freelancer;
+        uint96 amount;
+        Status status;
+    }
+
+    error ZeroAddress();
+    error InvalidAmount();
+    error JobAlreadyExists();
+    error JobNotFound();
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error InvalidStatus();
+    error TokenTransferFailed();
+    error FeeOnTransferTokenNotSupported();
+    error InvalidAward();
+    error Reentrancy();
+
+    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
+    uint256 public constant MAX_ESCROW = 50_000 * 1e6;
+
+    IERC20 public immutable token;
+    address public immutable arbitrator;
+    uint256 private _locked = 1;
+
+    mapping(bytes32 => Job) public jobs;
+
+    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
+    event WorkDelivered(bytes32 indexed jobId);
+    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
+    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 token_, address arbitrator_) {
+        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
+        token = token_;
+        arbitrator = arbitrator_;
+    }
+
+    /// @notice Funds a new job. The client must first approve this contract for `amount`.
+    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
+        if (freelancer == address(0)) revert ZeroAddress();
+        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
+        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();
+
+        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
+        emit JobFunded(jobId, msg.sender, freelancer, amount);
+    }
+
+    function markDelivered(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.freelancer) revert NotFreelancer();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    /// @notice Client releases the full escrow after accepting delivery.
+    function release(bytes32 jobId) external nonReentrant {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client) revert NotClient();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit FundsReleased(jobId, job.freelancer, job.amount);
+    }
+
+    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
+    function raiseDispute(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender);
+    }
+
+    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
+    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        Job storage job = _job(jobId);
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (clientAward > amount) revert InvalidAward();
+
+        job.status = clientAward == amount ? Status.Refunded : Status.Released;
+        uint256 freelancerAward = amount - clientAward;
+        if (clientAward != 0) _safeTransfer(job.client, clientAward);
+        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
+        emit DisputeResolved(jobId, clientAward, freelancerAward);
+    }
+
+    function _job(bytes32 jobId) private view returns (Job storage job) {
+        job = jobs[jobId];
+        if (job.status == Status.None) revert JobNotFound();
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        if (!token.transfer(to, amount)) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a1a0c9f9d73f1069d2de5a5673fb19c593c69d17
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,74 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed < amount) return false;
+        allowance[from][msg.sender] = allowed - amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        if (balanceOf[from] < amount) return false;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITRATOR = address(0xA8B);
+    bytes32 private constant JOB = keccak256("job-1");
+    uint256 private constant AMOUNT = 5_000e6;
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
+        usdc.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesDeliveredWork() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.prank(CLIENT); escrow.release(JOB);
+        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
+        require(status == FreelanceEscrow.Status.Released, "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
+        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
+        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
+        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
+    }
+
+    function testOnlyClientCanRelease() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.expectRevert(FreelanceEscrow.NotClient.selector);
+        vm.prank(FREELANCER); escrow.release(JOB);
+    }
+
+    function testRejectsOutOfRangeEscrow() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
+    }
+}

exec
/bin/bash -lc 'forge test -vvv && forge build && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001
 succeeded in 411ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 186.60ms
Compiler run successful!

Ran 4 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitDispute() (gas: 135905)
[PASS] testClientReleasesDeliveredWork() (gas: 134019)
[PASS] testOnlyClientCanRelease() (gas: 126083)
[PASS] testRejectsOutOfRangeEscrow() (gas: 13829)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 908.92µs (1.14ms CPU time)

Ran 1 test suite in 11.09ms (908.92µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 111.53ms
Compiler run successful!
note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/DeployFreelanceEscrow.s.sol:14:25
   |
14 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:30:25
   |
30 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:40:29
   |
40 |     IERC20 public immutable token;
   |                             ^^^^^ help: consider using: `TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:41:30
   |
41 |     address public immutable arbitrator;
   |                              ^^^^^^^^^^ help: consider using: `ARBITRATOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:52:5
   |
52 | /     modifier nonReentrant() {
53 | |         if (_locked != 1) revert Reentrancy();
54 | |         _locked = 2;
55 | |         _;
56 | |         _locked = 1;
57 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
52 ~     modifier nonReentrant() {
53 +         _nonReentrantBefore();
54 +         _;
55 +         _nonReentrantAfter();
56 +     }
57 + 
58 +     function _nonReentrantBefore() internal {
59 +         if (_locked != 1) revert Reentrancy();
60 +         _locked = 2;
61 +     }
62 + 
63 +     function _nonReentrantAfter() internal {
64 +         _locked = 1;
65 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/FreelanceEscrow.sol:75:80
   |
75 |         jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
   |                                                                                ^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint96' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

?? .env.example
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..a00d1b7fce3fc1f835f0839fa5d9bb41a9b4e90b
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Use a dedicated deployer wallet; never commit its private key.
+PRIVATE_KEY=
+RPC_URL=https://ethereum-rpc.publicnode.com
+USDC_ADDRESS=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
+ARBITRATOR=0x0000000000000000000000000000000000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..90e8dcccc51490249a3cf4fdb7b7a1fc6016fe85
--- /dev/null
+++ b/README.md
@@ -0,0 +1,41 @@
+# Freelance Escrow
+
+`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.
+
+This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.
+
+## Tooling
+
+This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.
+
+1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
+2. Load the variables into your shell:
+
+   ```sh
+   set -a; . ./.env; set +a
+   ```
+
+3. Simulate the deployment, then broadcast:
+
+   ```sh
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
+   ```
+
+`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.
+
+For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.
+
+## Operational notes
+
+- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
+- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
+- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dec645105438125e0413c6990dad372cdbc0d2c4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5218c6501c8d258b834e7edd4e8d9047c673c134
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20(usdc), arbitrator);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..20acc6791609620685c4e389837872f4e84c421c
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,133 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
+/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
+contract FreelanceEscrow {
+    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
+
+    struct Job {
+        address client;
+        address freelancer;
+        uint96 amount;
+        Status status;
+    }
+
+    error ZeroAddress();
+    error InvalidAmount();
+    error JobAlreadyExists();
+    error JobNotFound();
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error InvalidStatus();
+    error TokenTransferFailed();
+    error FeeOnTransferTokenNotSupported();
+    error InvalidAward();
+    error Reentrancy();
+
+    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
+    uint256 public constant MAX_ESCROW = 50_000 * 1e6;
+
+    IERC20 public immutable token;
+    address public immutable arbitrator;
+    uint256 private _locked = 1;
+
+    mapping(bytes32 => Job) public jobs;
+
+    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
+    event WorkDelivered(bytes32 indexed jobId);
+    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
+    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 token_, address arbitrator_) {
+        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
+        token = token_;
+        arbitrator = arbitrator_;
+    }
+
+    /// @notice Funds a new job. The client must first approve this contract for `amount`.
+    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
+        if (freelancer == address(0)) revert ZeroAddress();
+        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
+        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();
+
+        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
+        emit JobFunded(jobId, msg.sender, freelancer, amount);
+    }
+
+    function markDelivered(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.freelancer) revert NotFreelancer();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    /// @notice Client releases the full escrow after accepting delivery.
+    function release(bytes32 jobId) external nonReentrant {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client) revert NotClient();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit FundsReleased(jobId, job.freelancer, job.amount);
+    }
+
+    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
+    function raiseDispute(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender);
+    }
+
+    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
+    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        Job storage job = _job(jobId);
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (clientAward > amount) revert InvalidAward();
+
+        job.status = clientAward == amount ? Status.Refunded : Status.Released;
+        uint256 freelancerAward = amount - clientAward;
+        if (clientAward != 0) _safeTransfer(job.client, clientAward);
+        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
+        emit DisputeResolved(jobId, clientAward, freelancerAward);
+    }
+
+    function _job(bytes32 jobId) private view returns (Job storage job) {
+        job = jobs[jobId];
+        if (job.status == Status.None) revert JobNotFound();
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        if (!token.transfer(to, amount)) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a1a0c9f9d73f1069d2de5a5673fb19c593c69d17
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,74 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed < amount) return false;
+        allowance[from][msg.sender] = allowed - amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        if (balanceOf[from] < amount) return false;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITRATOR = address(0xA8B);
+    bytes32 private constant JOB = keccak256("job-1");
+    uint256 private constant AMOUNT = 5_000e6;
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
+        usdc.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesDeliveredWork() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.prank(CLIENT); escrow.release(JOB);
+        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
+        require(status == FreelanceEscrow.Status.Released, "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
+        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
+        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
+        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
+    }
+
+    function testOnlyClientCanRelease() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.expectRevert(FreelanceEscrow.NotClient.selector);
+        vm.prank(FREELANCER); escrow.release(JOB);
+    }
+
+    function testRejectsOutOfRangeEscrow() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
+    }
+}

codex
The escrow flow and deployment script are in place, and the initial test suite passes. I’m tightening one deployment guard now: the contract will refuse a token that is not six-decimal, preventing a mismatched token from silently turning the stated dollar limits into the wrong values.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/script/DeployFreelanceEscrow.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..a00d1b7fce3fc1f835f0839fa5d9bb41a9b4e90b
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Use a dedicated deployer wallet; never commit its private key.
+PRIVATE_KEY=
+RPC_URL=https://ethereum-rpc.publicnode.com
+USDC_ADDRESS=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
+ARBITRATOR=0x0000000000000000000000000000000000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..90e8dcccc51490249a3cf4fdb7b7a1fc6016fe85
--- /dev/null
+++ b/README.md
@@ -0,0 +1,41 @@
+# Freelance Escrow
+
+`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.
+
+This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.
+
+## Tooling
+
+This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.
+
+1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
+2. Load the variables into your shell:
+
+   ```sh
+   set -a; . ./.env; set +a
+   ```
+
+3. Simulate the deployment, then broadcast:
+
+   ```sh
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
+   ```
+
+`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.
+
+For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.
+
+## Operational notes
+
+- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
+- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
+- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dec645105438125e0413c6990dad372cdbc0d2c4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..acd69ee3be0ddd436c6caa633caf23baf7a01844
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20Metadata(usdc), arbitrator);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8e2baa492b6686b08d4bb1bd3e99116e64498f45
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,139 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
+/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
+contract FreelanceEscrow {
+    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
+
+    struct Job {
+        address client;
+        address freelancer;
+        uint96 amount;
+        Status status;
+    }
+
+    error ZeroAddress();
+    error UnsupportedTokenDecimals();
+    error InvalidAmount();
+    error JobAlreadyExists();
+    error JobNotFound();
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error InvalidStatus();
+    error TokenTransferFailed();
+    error FeeOnTransferTokenNotSupported();
+    error InvalidAward();
+    error Reentrancy();
+
+    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
+    uint256 public constant MAX_ESCROW = 50_000 * 1e6;
+
+    IERC20 public immutable token;
+    address public immutable arbitrator;
+    uint256 private _locked = 1;
+
+    mapping(bytes32 => Job) public jobs;
+
+    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
+    event WorkDelivered(bytes32 indexed jobId);
+    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
+    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20Metadata token_, address arbitrator_) {
+        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
+        if (token_.decimals() != 6) revert UnsupportedTokenDecimals();
+        token = token_;
+        arbitrator = arbitrator_;
+    }
+
+    /// @notice Funds a new job. The client must first approve this contract for `amount`.
+    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
+        if (freelancer == address(0)) revert ZeroAddress();
+        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
+        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();
+
+        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
+        emit JobFunded(jobId, msg.sender, freelancer, amount);
+    }
+
+    function markDelivered(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.freelancer) revert NotFreelancer();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    /// @notice Client releases the full escrow after accepting delivery.
+    function release(bytes32 jobId) external nonReentrant {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client) revert NotClient();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit FundsReleased(jobId, job.freelancer, job.amount);
+    }
+
+    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
+    function raiseDispute(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender);
+    }
+
+    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
+    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        Job storage job = _job(jobId);
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (clientAward > amount) revert InvalidAward();
+
+        job.status = clientAward == amount ? Status.Refunded : Status.Released;
+        uint256 freelancerAward = amount - clientAward;
+        if (clientAward != 0) _safeTransfer(job.client, clientAward);
+        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
+        emit DisputeResolved(jobId, clientAward, freelancerAward);
+    }
+
+    function _job(bytes32 jobId) private view returns (Job storage job) {
+        job = jobs[jobId];
+        if (job.status == Status.None) revert JobNotFound();
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        if (!token.transfer(to, amount)) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4ca8df91bc8398b06418416cfca24e94382cee31
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,75 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20Metadata {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function decimals() external pure returns (uint8) { return 6; }
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed < amount) return false;
+        allowance[from][msg.sender] = allowed - amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        if (balanceOf[from] < amount) return false;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITRATOR = address(0xA8B);
+    bytes32 private constant JOB = keccak256("job-1");
+    uint256 private constant AMOUNT = 5_000e6;
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
+        usdc.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesDeliveredWork() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.prank(CLIENT); escrow.release(JOB);
+        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
+        require(status == FreelanceEscrow.Status.Released, "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
+        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
+        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
+        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
+    }
+
+    function testOnlyClientCanRelease() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.expectRevert(FreelanceEscrow.NotClient.selector);
+        vm.prank(FREELANCER); escrow.release(JOB);
+    }
+
+    function testRejectsOutOfRangeEscrow() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..a00d1b7fce3fc1f835f0839fa5d9bb41a9b4e90b
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Use a dedicated deployer wallet; never commit its private key.
+PRIVATE_KEY=
+RPC_URL=https://ethereum-rpc.publicnode.com
+USDC_ADDRESS=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
+ARBITRATOR=0x0000000000000000000000000000000000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..90e8dcccc51490249a3cf4fdb7b7a1fc6016fe85
--- /dev/null
+++ b/README.md
@@ -0,0 +1,41 @@
+# Freelance Escrow
+
+`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.
+
+This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.
+
+## Tooling
+
+This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.
+
+1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
+2. Load the variables into your shell:
+
+   ```sh
+   set -a; . ./.env; set +a
+   ```
+
+3. Simulate the deployment, then broadcast:
+
+   ```sh
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
+   ```
+
+`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.
+
+For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.
+
+## Operational notes
+
+- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
+- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
+- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dec645105438125e0413c6990dad372cdbc0d2c4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..acd69ee3be0ddd436c6caa633caf23baf7a01844
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20Metadata(usdc), arbitrator);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8e2baa492b6686b08d4bb1bd3e99116e64498f45
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,139 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
+/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
+contract FreelanceEscrow {
+    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
+
+    struct Job {
+        address client;
+        address freelancer;
+        uint96 amount;
+        Status status;
+    }
+
+    error ZeroAddress();
+    error UnsupportedTokenDecimals();
+    error InvalidAmount();
+    error JobAlreadyExists();
+    error JobNotFound();
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error InvalidStatus();
+    error TokenTransferFailed();
+    error FeeOnTransferTokenNotSupported();
+    error InvalidAward();
+    error Reentrancy();
+
+    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
+    uint256 public constant MAX_ESCROW = 50_000 * 1e6;
+
+    IERC20 public immutable token;
+    address public immutable arbitrator;
+    uint256 private _locked = 1;
+
+    mapping(bytes32 => Job) public jobs;
+
+    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
+    event WorkDelivered(bytes32 indexed jobId);
+    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
+    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20Metadata token_, address arbitrator_) {
+        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
+        if (token_.decimals() != 6) revert UnsupportedTokenDecimals();
+        token = token_;
+        arbitrator = arbitrator_;
+    }
+
+    /// @notice Funds a new job. The client must first approve this contract for `amount`.
+    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
+        if (freelancer == address(0)) revert ZeroAddress();
+        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
+        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();
+
+        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
+        emit JobFunded(jobId, msg.sender, freelancer, amount);
+    }
+
+    function markDelivered(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.freelancer) revert NotFreelancer();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    /// @notice Client releases the full escrow after accepting delivery.
+    function release(bytes32 jobId) external nonReentrant {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client) revert NotClient();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit FundsReleased(jobId, job.freelancer, job.amount);
+    }
+
+    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
+    function raiseDispute(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender);
+    }
+
+    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
+    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        Job storage job = _job(jobId);
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (clientAward > amount) revert InvalidAward();
+
+        job.status = clientAward == amount ? Status.Refunded : Status.Released;
+        uint256 freelancerAward = amount - clientAward;
+        if (clientAward != 0) _safeTransfer(job.client, clientAward);
+        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
+        emit DisputeResolved(jobId, clientAward, freelancerAward);
+    }
+
+    function _job(bytes32 jobId) private view returns (Job storage job) {
+        job = jobs[jobId];
+        if (job.status == Status.None) revert JobNotFound();
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        if (!token.transfer(to, amount)) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4ca8df91bc8398b06418416cfca24e94382cee31
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,75 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20Metadata {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function decimals() external pure returns (uint8) { return 6; }
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed < amount) return false;
+        allowance[from][msg.sender] = allowed - amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        if (balanceOf[from] < amount) return false;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITRATOR = address(0xA8B);
+    bytes32 private constant JOB = keccak256("job-1");
+    uint256 private constant AMOUNT = 5_000e6;
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
+        usdc.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesDeliveredWork() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.prank(CLIENT); escrow.release(JOB);
+        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
+        require(status == FreelanceEscrow.Status.Released, "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
+        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
+        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
+        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
+    }
+
+    function testOnlyClientCanRelease() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.expectRevert(FreelanceEscrow.NotClient.selector);
+        vm.prank(FREELANCER); escrow.release(JOB);
+    }
+
+    function testRejectsOutOfRangeEscrow() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt --check || forge fmt && forge test -vvv && forge build && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001
 succeeded in 411ms:
Diff in src/FreelanceEscrow.sol:
15  15   | /// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
16  16   | /// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
17  17   | contract FreelanceEscrow {
18       |-    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
    18   |+    enum Status {
    19   |+        None,
    20   |+        Funded,
    21   |+        Delivered,
    22   |+        Disputed,
    23   |+        Released,
    24   |+        Refunded
    25   |+    }
19  26   | 
20  27   |     struct Job {
21  28   |         address client;

Diff in test/FreelanceEscrow.t.sol:
11  11   | contract MockUSDC is IERC20Metadata {
12  12   |     mapping(address => uint256) public override balanceOf;
13  13   |     mapping(address => mapping(address => uint256)) public allowance;
14       |-    function decimals() external pure returns (uint8) { return 6; }
15       |-    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
16       |-    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
17       |-    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
    14   |+
    15   |+    function decimals() external pure returns (uint8) {
    16   |+        return 6;
    17   |+    }
    18   |+
    19   |+    function mint(address to, uint256 amount) external {
    20   |+        balanceOf[to] += amount;
    21   |+    }
    22   |+
    23   |+    function approve(address spender, uint256 amount) external returns (bool) {
    24   |+        allowance[msg.sender][spender] = amount;
    25   |+        return true;
    26   |+    }
    27   |+
    28   |+    function transfer(address to, uint256 amount) external returns (bool) {
    29   |+        return _transfer(msg.sender, to, amount);
    30   |+    }
    31   |+
18  32   |     function transferFrom(address from, address to, uint256 amount) external returns (bool) {
19  33   |         uint256 allowed = allowance[from][msg.sender];
20  34   |         if (allowed < amount) return false;
21  35   |         allowance[from][msg.sender] = allowed - amount;
22  36   |         return _transfer(from, to, amount);
23  37   |     }
    38   |+
24  39   |     function _transfer(address from, address to, uint256 amount) private returns (bool) {
25  40   |         if (balanceOf[from] < amount) return false;
26       |-        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    41   |+        balanceOf[from] -= amount;
    42   |+        balanceOf[to] += amount;
    43   |+        return true;
27  44   |     }
28  45   | }
29  46   | 
30       |-contract FreelanceEscrowTest {
31       |-    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
32       |-    address private constant CLIENT = address(0xC1E17);
33       |-    address private constant FREELANCER = address(0xFEE1);
34       |-    address private constant ARBITRATOR = address(0xA8B);
35       |-    bytes32 private constant JOB = keccak256("job-1");
36       |-    uint256 private constant AMOUNT = 5_000e6;
37       |-    MockUSDC private usdc;
38       |-    FreelanceEscrow private escrow;
    47   |+    contract FreelanceEscrowTest {
    48   |+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    49   |+        address private constant CLIENT = address(0xC1E17);
    50   |+        address private constant FREELANCER = address(0xFEE1);
    51   |+        address private constant ARBITRATOR = address(0xA8B);
    52   |+        bytes32 private constant JOB = keccak256("job-1");
    53   |+        uint256 private constant AMOUNT = 5_000e6;
    54   |+        MockUSDC private usdc;
    55   |+        FreelanceEscrow private escrow;
39  56   | 
40       |-    function setUp() public {
41       |-        usdc = new MockUSDC();
42       |-        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
43       |-        usdc.mint(CLIENT, 100_000e6);
44       |-        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
45       |-    }
    57   |+        function setUp() public {
    58   |+            usdc = new MockUSDC();
    59   |+            escrow = new FreelanceEscrow(usdc, ARBITRATOR);
    60   |+            usdc.mint(CLIENT, 100_000e6);
    61   |+            vm.prank(CLIENT);
    62   |+            usdc.approve(address(escrow), type(uint256).max);
    63   |+        }
46  64   | 
47       |-    function testClientReleasesDeliveredWork() public {
48       |-        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
49       |-        vm.prank(FREELANCER); escrow.markDelivered(JOB);
50       |-        vm.prank(CLIENT); escrow.release(JOB);
51       |-        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
52       |-        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
53       |-        require(status == FreelanceEscrow.Status.Released, "wrong status");
54       |-    }
    65   |+        function testClientReleasesDeliveredWork() public {
    66   |+            vm.prank(CLIENT);
    67   |+            escrow.fundJob(JOB, FREELANCER, AMOUNT);
    68   |+            vm.prank(FREELANCER);
    69   |+            escrow.markDelivered(JOB);
    70   |+            vm.prank(CLIENT);
    71   |+            escrow.release(JOB);
    72   |+            require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
    73   |+            (,,, FreelanceEscrow.Status status) = escrow.jobs(JOB);
    74   |+            require(status == FreelanceEscrow.Status.Released, "wrong status");
    75   |+        }
55  76   | 
56       |-    function testArbitratorCanSplitDispute() public {
57       |-        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
58       |-        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
59       |-        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
60       |-        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
61       |-        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
62       |-    }
    77   |+        function testArbitratorCanSplitDispute() public {
    78   |+            vm.prank(CLIENT);
    79   |+            escrow.fundJob(JOB, FREELANCER, AMOUNT);
    80   |+            vm.prank(FREELANCER);
    81   |+            escrow.raiseDispute(JOB);
    82   |+            vm.prank(ARBITRATOR);
    83   |+            escrow.resolveDispute(JOB, 1_500e6);
    84   |+            require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
    85   |+            require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
    86   |+        }
63  87   | 
64       |-    function testOnlyClientCanRelease() public {
65       |-        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
66       |-        vm.prank(FREELANCER); escrow.markDelivered(JOB);
67       |-        vm.expectRevert(FreelanceEscrow.NotClient.selector);
68       |-        vm.prank(FREELANCER); escrow.release(JOB);
69       |-    }
    88   |+        function testOnlyClientCanRelease() public {
    89   |+            vm.prank(CLIENT);
    90   |+            escrow.fundJob(JOB, FREELANCER, AMOUNT);
    91   |+            vm.prank(FREELANCER);
    92   |+            escrow.markDelivered(JOB);
    93   |+            vm.expectRevert(FreelanceEscrow.NotClient.selector);
    94   |+            vm.prank(FREELANCER);
    95   |+            escrow.release(JOB);
    96   |+        }
70  97   | 
71       |-    function testRejectsOutOfRangeEscrow() public {
72       |-        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
73       |-        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
    98   |+        function testRejectsOutOfRangeEscrow() public {
    99   |+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
    100  |+            vm.prank(CLIENT);
    101  |+            escrow.fundJob(JOB, FREELANCER, 1_999e6);
    102  |+        }
74  103  |     }
75       |-}
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/test/FreelanceEscrow.t.sol
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 175.18ms
Compiler run successful!

Ran 4 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbitratorCanSplitDispute() (gas: 136037)
[PASS] testClientReleasesDeliveredWork() (gas: 134107)
[PASS] testOnlyClientCanRelease() (gas: 126127)
[PASS] testRejectsOutOfRangeEscrow() (gas: 13829)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 657.54µs (845.68µs CPU time)

Ran 1 test suite in 9.86ms (657.54µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 99.78ms
Compiler run successful!
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:52:29
   |
52 |     IERC20 public immutable token;
   |                             ^^^^^ help: consider using: `TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/DeployFreelanceEscrow.s.sol:14:25
   |
14 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:53:30
   |
53 |     address public immutable arbitrator;
   |                              ^^^^^^^^^^ help: consider using: `ARBITRATOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:48:29
   |
48 |         Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                             ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:64:5
   |
64 | /     modifier nonReentrant() {
65 | |         if (_locked != 1) revert Reentrancy();
66 | |         _locked = 2;
67 | |         _;
68 | |         _locked = 1;
69 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
64 ~     modifier nonReentrant() {
65 +         _nonReentrantBefore();
66 +         _;
67 +         _nonReentrantAfter();
68 +     }
69 + 
70 +     function _nonReentrantBefore() internal {
71 +         if (_locked != 1) revert Reentrancy();
72 +         _locked = 2;
73 +     }
74 + 
75 +     function _nonReentrantAfter() internal {
76 +         _locked = 1;
77 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unused-import]: unused imports should be removed
 --> test/FreelanceEscrow.t.sol:4:26
  |
4 | import {FreelanceEscrow, IERC20, IERC20Metadata} from "../src/FreelanceEscrow.sol";
  |                          ^^^^^^
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#unused-import

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/FreelanceEscrow.sol:88:80
   |
88 |         jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
   |                                                                                ^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint96' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

?? .env.example
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..a00d1b7fce3fc1f835f0839fa5d9bb41a9b4e90b
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Use a dedicated deployer wallet; never commit its private key.
+PRIVATE_KEY=
+RPC_URL=https://ethereum-rpc.publicnode.com
+USDC_ADDRESS=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
+ARBITRATOR=0x0000000000000000000000000000000000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..90e8dcccc51490249a3cf4fdb7b7a1fc6016fe85
--- /dev/null
+++ b/README.md
@@ -0,0 +1,41 @@
+# Freelance Escrow
+
+`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.
+
+This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.
+
+## Tooling
+
+This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.
+
+1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
+2. Load the variables into your shell:
+
+   ```sh
+   set -a; . ./.env; set +a
+   ```
+
+3. Simulate the deployment, then broadcast:
+
+   ```sh
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
+   ```
+
+`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.
+
+For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.
+
+## Operational notes
+
+- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
+- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
+- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dec645105438125e0413c6990dad372cdbc0d2c4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..acd69ee3be0ddd436c6caa633caf23baf7a01844
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20Metadata(usdc), arbitrator);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8e2baa492b6686b08d4bb1bd3e99116e64498f45
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,139 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
+/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
+contract FreelanceEscrow {
+    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
+
+    struct Job {
+        address client;
+        address freelancer;
+        uint96 amount;
+        Status status;
+    }
+
+    error ZeroAddress();
+    error UnsupportedTokenDecimals();
+    error InvalidAmount();
+    error JobAlreadyExists();
+    error JobNotFound();
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error InvalidStatus();
+    error TokenTransferFailed();
+    error FeeOnTransferTokenNotSupported();
+    error InvalidAward();
+    error Reentrancy();
+
+    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
+    uint256 public constant MAX_ESCROW = 50_000 * 1e6;
+
+    IERC20 public immutable token;
+    address public immutable arbitrator;
+    uint256 private _locked = 1;
+
+    mapping(bytes32 => Job) public jobs;
+
+    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
+    event WorkDelivered(bytes32 indexed jobId);
+    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
+    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20Metadata token_, address arbitrator_) {
+        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
+        if (token_.decimals() != 6) revert UnsupportedTokenDecimals();
+        token = token_;
+        arbitrator = arbitrator_;
+    }
+
+    /// @notice Funds a new job. The client must first approve this contract for `amount`.
+    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
+        if (freelancer == address(0)) revert ZeroAddress();
+        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
+        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();
+
+        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
+        emit JobFunded(jobId, msg.sender, freelancer, amount);
+    }
+
+    function markDelivered(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.freelancer) revert NotFreelancer();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    /// @notice Client releases the full escrow after accepting delivery.
+    function release(bytes32 jobId) external nonReentrant {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client) revert NotClient();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit FundsReleased(jobId, job.freelancer, job.amount);
+    }
+
+    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
+    function raiseDispute(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender);
+    }
+
+    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
+    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        Job storage job = _job(jobId);
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (clientAward > amount) revert InvalidAward();
+
+        job.status = clientAward == amount ? Status.Refunded : Status.Released;
+        uint256 freelancerAward = amount - clientAward;
+        if (clientAward != 0) _safeTransfer(job.client, clientAward);
+        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
+        emit DisputeResolved(jobId, clientAward, freelancerAward);
+    }
+
+    function _job(bytes32 jobId) private view returns (Job storage job) {
+        job = jobs[jobId];
+        if (job.status == Status.None) revert JobNotFound();
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        if (!token.transfer(to, amount)) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4ca8df91bc8398b06418416cfca24e94382cee31
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,75 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20Metadata {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function decimals() external pure returns (uint8) { return 6; }
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed < amount) return false;
+        allowance[from][msg.sender] = allowed - amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        if (balanceOf[from] < amount) return false;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITRATOR = address(0xA8B);
+    bytes32 private constant JOB = keccak256("job-1");
+    uint256 private constant AMOUNT = 5_000e6;
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
+        usdc.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesDeliveredWork() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.prank(CLIENT); escrow.release(JOB);
+        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
+        require(status == FreelanceEscrow.Status.Released, "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
+        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
+        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
+        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
+    }
+
+    function testOnlyClientCanRelease() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.expectRevert(FreelanceEscrow.NotClient.selector);
+        vm.prank(FREELANCER); escrow.release(JOB);
+    }
+
+    function testRejectsOutOfRangeEscrow() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
+    }
+}

codex
Built a Foundry-based escrow project.

- Contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol)
- Deployment script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Deployment guide: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/README.md)
- Environment template: [.env.example](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/.env.example)

It escrows 6-decimal USDC from $2k–$50k, supports delivery, client release, disputes by either party, and arbitrator-controlled split resolutions. It rejects incorrect-decimal and fee-on-transfer tokens.

I recommend Ethereum mainnet with native USDC for these high-value, low-frequency escrows; the README includes exact commands and the rationale. Live fee data was checked when making that choice.

Verified with `forge test`: 4 passing tests.
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..a00d1b7fce3fc1f835f0839fa5d9bb41a9b4e90b
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Use a dedicated deployer wallet; never commit its private key.
+PRIVATE_KEY=
+RPC_URL=https://ethereum-rpc.publicnode.com
+USDC_ADDRESS=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
+ARBITRATOR=0x0000000000000000000000000000000000000000
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..90e8dcccc51490249a3cf4fdb7b7a1fc6016fe85
--- /dev/null
+++ b/README.md
@@ -0,0 +1,41 @@
+# Freelance Escrow
+
+`FreelanceEscrow` holds a single, trusted **6-decimal USD stablecoin** per job. A client funds a job between $2,000 and $50,000; the freelancer marks it delivered; the client releases the funds. Either party can freeze a job in dispute, and the immutable arbitrator resolves it with a client/freelancer split.
+
+This is a solid starting point, not production-ready financial infrastructure. Before taking customer funds, obtain a professional security audit, define the arbitration process and legal terms, set up key management for the arbitrator, and confirm the applicable money-transmission, sanctions, and consumer-protection requirements.
+
+## Tooling
+
+This project uses [Foundry](https://book.getfoundry.sh/). Install it, then run:
+
+```sh
+forge test
+```
+
+## Deploy
+
+I would deploy the first production version to **Ethereum mainnet**, using native USDC at `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. These are relatively high-value, low-frequency escrows, so Ethereum’s settlement security and canonical USDC liquidity are the better fit. At the time this project was created, the live RPC reported approximately 52 gwei on Ethereum mainnet (and 0.006 gwei on Base); recheck fees immediately before broadcasting—this repository deliberately does not hardcode fee fields.
+
+1. Copy `.env.example` to `.env`, set `PRIVATE_KEY` for a dedicated deployer, and replace `ARBITRATOR` with the address controlled by your dispute-resolution process. Do not use a personal hot wallet for the arbitrator.
+2. Load the variables into your shell:
+
+   ```sh
+   set -a; . ./.env; set +a
+   ```
+
+3. Simulate the deployment, then broadcast:
+
+   ```sh
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL"
+   forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow --rpc-url "$RPC_URL" --broadcast --verify
+   ```
+
+`--verify` needs an Etherscan API key configured by Foundry. Record the deployed address and verify the constructor arguments (USDC and arbitrator) before publishing it to users.
+
+For a dry run, deploy the exact same contract to Sepolia with a 6-decimal mock USDC you control; do **not** point it at a random token. For future multi-chain operation, deploy separate instances and publish the trusted token/arbitrator pair for each chain.
+
+## Operational notes
+
+- Job IDs are `bytes32`; derive them off-chain from a unique UUID, e.g. `cast keccak "your-uuid"`.
+- The client must first approve the escrow contract for the amount, then call `fundJob(jobId, freelancer, amountInUSDCUnits)`.
+- The contract intentionally rejects fee-on-transfer tokens and has no admin withdrawal or upgrade mechanism. Only the nominated arbitrator can resolve disputed funds.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..dec645105438125e0413c6990dad372cdbc0d2c4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..acd69ee3be0ddd436c6caa633caf23baf7a01844
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address arbitrator = vm.envAddress("ARBITRATOR");
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(IERC20Metadata(usdc), arbitrator);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8e2baa492b6686b08d4bb1bd3e99116e64498f45
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,139 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
+
+interface IERC20Metadata is IERC20 {
+    function decimals() external view returns (uint8);
+}
+
+/// @title FreelanceEscrow
+/// @notice Non-custodial job escrow for a single, trusted 6-decimal USD stablecoin.
+/// @dev Amount limits are denominated in the token's smallest unit: 2,000–50,000 USD.
+contract FreelanceEscrow {
+    enum Status { None, Funded, Delivered, Disputed, Released, Refunded }
+
+    struct Job {
+        address client;
+        address freelancer;
+        uint96 amount;
+        Status status;
+    }
+
+    error ZeroAddress();
+    error UnsupportedTokenDecimals();
+    error InvalidAmount();
+    error JobAlreadyExists();
+    error JobNotFound();
+    error NotClient();
+    error NotFreelancer();
+    error NotParty();
+    error NotArbitrator();
+    error InvalidStatus();
+    error TokenTransferFailed();
+    error FeeOnTransferTokenNotSupported();
+    error InvalidAward();
+    error Reentrancy();
+
+    uint256 public constant MIN_ESCROW = 2_000 * 1e6;
+    uint256 public constant MAX_ESCROW = 50_000 * 1e6;
+
+    IERC20 public immutable token;
+    address public immutable arbitrator;
+    uint256 private _locked = 1;
+
+    mapping(bytes32 => Job) public jobs;
+
+    event JobFunded(bytes32 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
+    event WorkDelivered(bytes32 indexed jobId);
+    event FundsReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event DisputeRaised(bytes32 indexed jobId, address indexed raisedBy);
+    event DisputeResolved(bytes32 indexed jobId, uint256 clientAward, uint256 freelancerAward);
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert Reentrancy();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20Metadata token_, address arbitrator_) {
+        if (address(token_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
+        if (token_.decimals() != 6) revert UnsupportedTokenDecimals();
+        token = token_;
+        arbitrator = arbitrator_;
+    }
+
+    /// @notice Funds a new job. The client must first approve this contract for `amount`.
+    function fundJob(bytes32 jobId, address freelancer, uint256 amount) external nonReentrant {
+        if (freelancer == address(0)) revert ZeroAddress();
+        if (amount < MIN_ESCROW || amount > MAX_ESCROW || amount > type(uint96).max) revert InvalidAmount();
+        if (jobs[jobId].status != Status.None) revert JobAlreadyExists();
+
+        uint256 beforeBalance = token.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (token.balanceOf(address(this)) != beforeBalance + amount) revert FeeOnTransferTokenNotSupported();
+
+        jobs[jobId] = Job({client: msg.sender, freelancer: freelancer, amount: uint96(amount), status: Status.Funded});
+        emit JobFunded(jobId, msg.sender, freelancer, amount);
+    }
+
+    function markDelivered(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.freelancer) revert NotFreelancer();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Delivered;
+        emit WorkDelivered(jobId);
+    }
+
+    /// @notice Client releases the full escrow after accepting delivery.
+    function release(bytes32 jobId) external nonReentrant {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client) revert NotClient();
+        if (job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Released;
+        _safeTransfer(job.freelancer, job.amount);
+        emit FundsReleased(jobId, job.freelancer, job.amount);
+    }
+
+    /// @notice Either party can freeze a funded or delivered job for the designated arbitrator.
+    function raiseDispute(bytes32 jobId) external {
+        Job storage job = _job(jobId);
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert NotParty();
+        if (job.status != Status.Funded && job.status != Status.Delivered) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender);
+    }
+
+    /// @notice Resolves a dispute. `clientAward` may split the escrow; the remainder goes to freelancer.
+    function resolveDispute(bytes32 jobId, uint256 clientAward) external nonReentrant {
+        if (msg.sender != arbitrator) revert NotArbitrator();
+        Job storage job = _job(jobId);
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        uint256 amount = job.amount;
+        if (clientAward > amount) revert InvalidAward();
+
+        job.status = clientAward == amount ? Status.Refunded : Status.Released;
+        uint256 freelancerAward = amount - clientAward;
+        if (clientAward != 0) _safeTransfer(job.client, clientAward);
+        if (freelancerAward != 0) _safeTransfer(job.freelancer, freelancerAward);
+        emit DisputeResolved(jobId, clientAward, freelancerAward);
+    }
+
+    function _job(bytes32 jobId) private view returns (Job storage job) {
+        job = jobs[jobId];
+        if (job.status == Status.None) revert JobNotFound();
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        if (!token.transfer(to, amount)) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        if (!token.transferFrom(from, to, amount)) revert TokenTransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4ca8df91bc8398b06418416cfca24e94382cee31
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,75 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow, IERC20, IERC20Metadata} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20Metadata {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function decimals() external pure returns (uint8) { return 6; }
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed < amount) return false;
+        allowance[from][msg.sender] = allowed - amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        if (balanceOf[from] < amount) return false;
+        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITRATOR = address(0xA8B);
+    bytes32 private constant JOB = keccak256("job-1");
+    uint256 private constant AMOUNT = 5_000e6;
+    MockUSDC private usdc;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        escrow = new FreelanceEscrow(usdc, ARBITRATOR);
+        usdc.mint(CLIENT, 100_000e6);
+        vm.prank(CLIENT); usdc.approve(address(escrow), type(uint256).max);
+    }
+
+    function testClientReleasesDeliveredWork() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.prank(CLIENT); escrow.release(JOB);
+        require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        (, , , FreelanceEscrow.Status status) = escrow.jobs(JOB);
+        require(status == FreelanceEscrow.Status.Released, "wrong status");
+    }
+
+    function testArbitratorCanSplitDispute() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.raiseDispute(JOB);
+        vm.prank(ARBITRATOR); escrow.resolveDispute(JOB, 1_500e6);
+        require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
+        require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
+    }
+
+    function testOnlyClientCanRelease() public {
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, AMOUNT);
+        vm.prank(FREELANCER); escrow.markDelivered(JOB);
+        vm.expectRevert(FreelanceEscrow.NotClient.selector);
+        vm.prank(FREELANCER); escrow.release(JOB);
+    }
+
+    function testRejectsOutOfRangeEscrow() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        vm.prank(CLIENT); escrow.fundJob(JOB, FREELANCER, 1_999e6);
+    }
+}

tokens used
31,638
````

## final message

Built a Foundry-based escrow project.

- Contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/src/FreelanceEscrow.sol)
- Deployment script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Deployment guide: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/README.md)
- Environment template: [.env.example](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233831Z-codex-with-skill-3/gas-goal-001/.env.example)

It escrows 6-decimal USDC from $2k–$50k, supports delivery, client release, disputes by either party, and arbitrator-controlled split resolutions. It rejects incorrect-decimal and fee-on-transfer tokens.

I recommend Ethereum mainnet with native USDC for these high-value, low-frequency escrows; the README includes exact commands and the rationale. Live fee data was checked when making that choice.

Verified with `forge test`: 4 passing tests.
