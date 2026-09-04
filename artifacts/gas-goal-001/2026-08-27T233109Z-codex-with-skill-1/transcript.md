# Executor transcript — 2026-08-27T233109Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04590-2a4c-7e30-a6ee-6485647c41f3
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-27T23:31:11.306365Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a04590-2a4c-7e30-a6ee-6485647c41f3.tmp-1787873471078053749: line 2547: syntax error near unexpected token `('

codex
I’ll build a deployable escrow contract with a small Foundry project. Because deployment cost and network choice are part of the request, I’m using the gas guidance skill to make those choices explicit in the README.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
 succeeded in 12ms:
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && printf '\\n--- package ---\\n' && sed -n '1,200p' package.json && printf '\\n--- git status ---\\n' && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

--- package ---
{
  "name": "eval-workspace",
  "private": true
}

--- git status ---

exec
/bin/bash -lc "command -v forge || true; command -v cast || true; command -v anvil || true; curl -sS --max-time 12 https://ethereum-rpc.publicnode.com -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_gasPrice\",\"params\":[],\"id\":1}' ; printf '\\n'; curl -sS --max-time 12 https://mainnet.base.org -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_gasPrice\",\"params\":[],\"id\":1}'; printf '\\n'; curl -sS --max-time 12 'https://api.coinbase.com/v2/prices/ETH-USD/spot' | head -c 500" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
 succeeded in 1545ms:
{"jsonrpc":"2.0","id":1,"result":"0x33383de"}

{"jsonrpc":"2.0","result":"0x5b8d80","id":1}

{"data":{"amount":"2514.135","base":"ETH","currency":"USD"}}
codex
I found an empty workspace with Foundry available. I’m implementing a USDC-denominated, non-custodial escrow state machine: funded → submitted → released/refunded, with a neutral arbiter able to settle disputes (including a split). The $2k–$50k band will be enforced in USDC units rather than via an on-chain price oracle.
exec
/bin/bash -lc "curl -sS --max-time 12 https://mainnet.base.org -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"latest\",false],\"id\":1}' | head -c 1000; printf '\\n'; curl -sS --max-time 12 https://ethereum-rpc.publicnode.com -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"latest\",false],\"id\":1}' | head -c 1000" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
 succeeded in 418ms:
{"jsonrpc":"2.0","result":{"baseFeePerGas":"0x4c4b40","blobGasUsed":"0x112f914","difficulty":"0x0","excessBlobGas":"0x0","extraData":"0x01000000640000000500000000004c4b40","gasLimit":"0x17d78400","gasUsed":"0x27bc89a","hash":"0x5565796039e50499053e589323e856e8b81033c1a5c0474c8d0a6062cea1a09b","logsBloom":"0xd7129549634a795090ebd2084b3653f2b8db46e122d0e5e3efadd673710a8c014d68dc617842a18df7969ad7a22635b85ed999226c536b42e7e283b370bc7750d579b75905f77e2893ae94fdb0bd85ec3f5baf07de4dd2bbdcfc22b8e97cbb96eb9860e93f1b5c343605be00af47ae2e55ecdc5618f6b6f5dce7ef78a0cfd34005e5520abb2a65e8677deadbe3df69a975f9a1810821f8c0f6bbc94fb5d59ae816492534e0e4383d5a4405e34600d9afb797c45f10481beaefc79f2350980180bca73e7ed8ebdcc9896b7dacc3f4d9e67e7fc19ecdfccddbc0ab4cc3c8fcea5de93c3e5627960e807e6424eaba09b4ee2dafb5ca598369de2592bc6b3a0c5af7","miner":"0x4200000000000000000000000000000000000011","mixHash":"0xc94ef8f6f36233712de5c1766dc7b2f57d46bfc951eee591997ac4969b75748a","nonce":"0x0000000000000000","number":"0x3033curl: (23) Failure writing output to destination

{"jsonrpc":"2.0","result":{"baseFeePerGas":"0x2fda13d","blobGasUsed":"0x20000","difficulty":"0x0","excessBlobGas":"0xa6e26fb","extraData":"0x626f6d626f72612e6275696c6420f09f8c8a","gasLimit":"0x3938700","gasUsed":"0x1d544f6","hash":"0xa904cd2e33d2135818b5682f0dc6e2cf83347cf03cfc97ae3bf9eddea29df9f4","logsBloom":"0xfd3b4d38ef825c3133ee48ade0fff7687fff5637be5dd75e06779d992ffa9671f97fedb4be8b7f23a152fbd8becf2f5f635be6e0fd7a7ffd87f33f2fdc2fe5cdffd1d2126cebfebb2f2b8b2976cb777828fc77edf86db6aaf9769e3ddc7d72befff769a13be25fea6ddd8d8dcea72b71b2a37cafadc87c3b47b0a5f66e7d2e73447d3b5bf41ff949fdd8f2d9cc2e739ade989dc1f5d4fe4de8ed95cb5cb9d41d2e414fe5c5fcf59f569afbf07f9ace9e7c48f75670f7ae2048cf05ef36ec9f5ddfa07bafafee973d6a863e895ff1fa5597fff86c6cbfde7d7dbb9f5bebbffd59ebfd6ffcb3df1d1be355779fedddde5ef59fefbe92fc24f08fcfd23d0aec9654","miner":"0x85c2e985a4fb5c3ff25ee27ee424abd851e4cb33","mixHash":"0xe649b4c96f623568a7aa73999be3c0b9d9c1273b3fb45f4ac4583717961a6837","nonce":"0x0000000000000000","number":"curl: (23) Failure writing output to destination

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/script/DeployFreelanceEscrow.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2aa32e7b579d210f9dc33322d5229772046deaea
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7fc794a616e73aff80a6deb9edbdc2c5eb056b29
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,166 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash);
+    event JobResolved(uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount);
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) revert InvalidAddress();
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender || arbiter == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) revert InvalidAmount();
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) revert TransferFailed();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(uint256 jobId, Job storage job, Status outcome, uint256 freelancerAmount, uint256 clientAmount)
+        private
+    {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) = address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2aa32e7b579d210f9dc33322d5229772046deaea
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7fc794a616e73aff80a6deb9edbdc2c5eb056b29
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,166 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash);
+    event JobResolved(uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount);
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) revert InvalidAddress();
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender || arbiter == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) revert InvalidAmount();
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) revert TransferFailed();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(uint256 jobId, Job storage job, Status outcome, uint256 freelancerAmount, uint256 clientAmount)
+        private
+    {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) = address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/script/DeployFreelanceEscrow.s.sol
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..96eedf728610bff6cb0eba4f397b0e46363af064
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast --verify
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; publish that address and the verified source before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7fc794a616e73aff80a6deb9edbdc2c5eb056b29
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,166 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash);
+    event JobResolved(uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount);
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) revert InvalidAddress();
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender || arbiter == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) revert InvalidAmount();
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) revert TransferFailed();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(uint256 jobId, Job storage job, Status outcome, uint256 freelancerAmount, uint256 clientAmount)
+        private
+    {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) = address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..96eedf728610bff6cb0eba4f397b0e46363af064
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast --verify
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; publish that address and the verified source before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7fc794a616e73aff80a6deb9edbdc2c5eb056b29
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,166 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash);
+    event JobResolved(uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount);
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) revert InvalidAddress();
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender || arbiter == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) revert InvalidAmount();
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) revert TransferFailed();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(uint256 jobId, Job storage job, Status outcome, uint256 freelancerAmount, uint256 clientAmount)
+        private
+    {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) = address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge build && forge test -vvv && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
 exited 1 in 92ms:
Diff in src/FreelanceEscrow.sol:
44  44   |         bytes32 detailsHash
45  45   |     );
46  46   |     event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
47       |-    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash);
48       |-    event JobResolved(uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount);
    47   |+    event DisputeRaised(
    48   |+        uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash
    49   |+    );
    50   |+    event JobResolved(
    51   |+        uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount
    52   |+    );
49  53   | 
50  54   |     /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
51  55   |     uint256 public immutable minAmount;
--------------------------------------------------------------------------------65  69   |     }
66  70   | 
67  71   |     constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
68       |-        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) revert InvalidAddress();
    72   |+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) {
    73   |+            revert InvalidAddress();
    74   |+        }
69  75   |         paymentToken = IERC20(paymentToken_);
70  76   |         minAmount = minAmount_;
71  77   |         maxAmount = maxAmount_;
--------------------------------------------------------------------------------77  83   |         nonReentrant
78  84   |         returns (uint256 jobId)
79  85   |     {
80       |-        if (freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender || arbiter == msg.sender) {
    86   |+        if (
    87   |+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
    88   |+                || arbiter == msg.sender
    89   |+        ) {
81  90   |             revert InvalidAddress();
82  91   |         }
83       |-        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) revert InvalidAmount();
    92   |+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) {
    93   |+            revert InvalidAmount();
    94   |+        }
84  95   | 
85  96   |         // Reject fee-on-transfer tokens: every job must remain fully collateralized.
86  97   |         uint256 balanceBefore = paymentToken.balanceOf(address(this));
87  98   |         _safeTransferFrom(msg.sender, address(this), amount);
88       |-        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) revert TransferFailed();
    99   |+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) {
    100  |+            revert TransferFailed();
    101  |+        }
89  102  | 
90  103  |         jobId = nextJobId++;
91  104  |         jobs[jobId] = Job({
--------------------------------------------------------------------------------143 156  |         _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
144 157  |     }
145 158  | 
146      |-    function _resolve(uint256 jobId, Job storage job, Status outcome, uint256 freelancerAmount, uint256 clientAmount)
147      |-        private
148      |-    {
    159  |+    function _resolve(
    160  |+        uint256 jobId,
    161  |+        Job storage job,
    162  |+        Status outcome,
    163  |+        uint256 freelancerAmount,
    164  |+        uint256 clientAmount
    165  |+    ) private {
149 166  |         job.status = outcome;
150 167  |         totalEscrowed -= job.amount;
151 168  |         if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
--------------------------------------------------------------------------------154 171  |     }
155 172  | 
156 173  |     function _safeTransfer(address to, uint256 amount) private {
157      |-        (bool ok, bytes memory result) = address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
    174  |+        (bool ok, bytes memory result) =
    175  |+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
158 176  |         if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
159 177  |     }
160 178  | 

Diff in test/FreelanceEscrow.t.sol:
7   7    |     mapping(address => uint256) public override balanceOf;
8   8    |     mapping(address => mapping(address => uint256)) public allowance;
9   9    | 
10       |-    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
11       |-    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
12       |-    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
    10   |+    function mint(address to, uint256 amount) external {
    11   |+        balanceOf[to] += amount;
    12   |+    }
    13   |+
    14   |+    function approve(address spender, uint256 amount) external returns (bool) {
    15   |+        allowance[msg.sender][spender] = amount;
    16   |+        return true;
    17   |+    }
    18   |+
    19   |+    function transfer(address to, uint256 amount) external returns (bool) {
    20   |+        return _transfer(msg.sender, to, amount);
    21   |+    }
    22   |+
13  23   |     function transferFrom(address from, address to, uint256 amount) external returns (bool) {
14  24   |         require(allowance[from][msg.sender] >= amount, "allowance");
15  25   |         allowance[from][msg.sender] -= amount;
16  26   |         return _transfer(from, to, amount);
17  27   |     }
    28   |+
18  29   |     function _transfer(address from, address to, uint256 amount) private returns (bool) {
19       |-        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    30   |+        require(balanceOf[from] >= amount, "balance");
    31   |+        balanceOf[from] -= amount;
    32   |+        balanceOf[to] += amount;
    33   |+        return true;
20  34   |     }
21  35   | }
22  36   | 
23       |-contract Actor {
24       |-    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
25       |-    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
26       |-        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
    37   |+    contract Actor {
    38   |+        function approve(MockUSDC token, address spender, uint256 amount) external {
    39   |+            token.approve(spender, amount);
    40   |+        }
    41   |+
    42   |+        function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount)
    43   |+            external
    44   |+            returns (uint256)
    45   |+        {
    46   |+            return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
    47   |+        }
    48   |+
    49   |+        function submit(FreelanceEscrow escrow, uint256 id) external {
    50   |+            escrow.submitWork(id, keccak256("work"));
    51   |+        }
    52   |+
    53   |+        function release(FreelanceEscrow escrow, uint256 id) external {
    54   |+            escrow.release(id);
    55   |+        }
    56   |+
    57   |+        function dispute(FreelanceEscrow escrow, uint256 id) external {
    58   |+            escrow.raiseDispute(id, keccak256("reason"));
    59   |+        }
    60   |+
    61   |+        function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external {
    62   |+            escrow.resolveDispute(id, freelancerAmount);
    63   |+        }
27  64   |     }
28       |-    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
29       |-    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
30       |-    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
31       |-    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
32       |-}
33  65   | 
34       |-contract FreelanceEscrowTest {
35       |-    MockUSDC token = new MockUSDC();
36       |-    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
37       |-    Actor client = new Actor();
38       |-    Actor freelancer = new Actor();
39       |-    Actor arbiter = new Actor();
    66   |+    contract FreelanceEscrowTest {
    67   |+        MockUSDC token = new MockUSDC();
    68   |+        FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
    69   |+        Actor client = new Actor();
    70   |+        Actor freelancer = new Actor();
    71   |+        Actor arbiter = new Actor();
40  72   | 
41       |-    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
    73   |+        function setUp() public {
    74   |+            token.mint(address(client), 10_000e6);
    75   |+            client.approve(token, address(escrow), type(uint256).max);
    76   |+        }
42  77   | 
43       |-    function testClientReleasesSubmittedWork() public {
44       |-        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
45       |-        freelancer.submit(escrow, id);
46       |-        client.release(escrow, id);
47       |-        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
48       |-        require(escrow.totalEscrowed() == 0, "liability remains");
49       |-    }
    78   |+        function testClientReleasesSubmittedWork() public {
    79   |+            uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
    80   |+            freelancer.submit(escrow, id);
    81   |+            client.release(escrow, id);
    82   |+            require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
    83   |+            require(escrow.totalEscrowed() == 0, "liability remains");
    84   |+        }
50  85   | 
51       |-    function testArbiterCanSplitDispute() public {
52       |-        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
53       |-        freelancer.dispute(escrow, id);
54       |-        arbiter.resolve(escrow, id, 6_000e6);
55       |-        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
56       |-        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
57       |-    }
    86   |+        function testArbiterCanSplitDispute() public {
    87   |+            uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
    88   |+            freelancer.dispute(escrow, id);
    89   |+            arbiter.resolve(escrow, id, 6_000e6);
    90   |+            require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
    91   |+            require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
    92   |+        }
58  93   | 
59       |-    function testCannotCreateOutsideDollarBand() public {
60       |-        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
61       |-        require(!ok, "under minimum accepted");
    94   |+        function testCannotCreateOutsideDollarBand() public {
    95   |+            (bool ok,) = address(client)
    96   |+                .call(
    97   |+                    abi.encodeCall(
    98   |+                        Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)
    99   |+                    )
    100  |+                );
    101  |+            require(!ok, "under minimum accepted");
    102  |+        }
62  103  |     }
63       |-}

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..96eedf728610bff6cb0eba4f397b0e46363af064
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast --verify
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; publish that address and the verified source before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7fc794a616e73aff80a6deb9edbdc2c5eb056b29
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,166 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash);
+    event JobResolved(uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount);
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) revert InvalidAddress();
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender || arbiter == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) revert InvalidAmount();
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) revert TransferFailed();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(uint256 jobId, Job storage job, Status outcome, uint256 freelancerAmount, uint256 clientAmount)
+        private
+    {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) = address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge build && forge test -vvv && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
 succeeded in 389ms:
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/test/FreelanceEscrow.t.sol
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol
Compiling 3 files with Solc 0.8.28
Solc 0.8.28 finished in 224.90ms
Compiler run successful!
note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/DeployFreelanceEscrow.s.sol:14:25
   |
14 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:55:30
   |
55 |     uint256 public immutable minAmount;
   |                              ^^^^^^^^^ help: consider using: `MIN_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:56:30
   |
56 |     uint256 public immutable maxAmount;
   |                              ^^^^^^^^^ help: consider using: `MAX_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:57:29
   |
57 |     IERC20 public immutable paymentToken;
   |                             ^^^^^^^^^^^^ help: consider using: `PAYMENT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:64:5
   |
64 | /     modifier nonReentrant() {
65 | |         if (unlocked != 1) revert ReentrantCall();
66 | |         unlocked = 2;
67 | |         _;
68 | |         unlocked = 1;
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
71 +         if (unlocked != 1) revert ReentrantCall();
72 +         unlocked = 2;
73 +     }
74 + 
75 +     function _nonReentrantAfter() internal {
76 +         unlocked = 1;
77 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/FreelanceEscrow.sol:108:21
    |
108 |             amount: uint96(amount),
    |                     ^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint96' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

No files changed, compilation skipped

Ran 3 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDispute() (gas: 205058)
[PASS] testCannotCreateOutsideDollarBand() (gas: 20927)
[PASS] testClientReleasesSubmittedWork() (gas: 194065)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 3.07ms (1.63ms CPU time)

Ran 1 test suite in 30.57ms (3.07ms CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..96eedf728610bff6cb0eba4f397b0e46363af064
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast --verify
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; publish that address and the verified source before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7fc794a616e73aff80a6deb9edbdc2c5eb056b29
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,166 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash);
+    event JobResolved(uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount);
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) revert InvalidAddress();
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender || arbiter == msg.sender) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) revert InvalidAmount();
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) revert TransferFailed();
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(uint256 jobId, Job storage job, Status outcome, uint256 freelancerAmount, uint256 clientAmount)
+        private
+    {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) = address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

codex
The contract and deployment script now compile, and the test suite covers normal release, a disputed split, and rejection below the configured minimum. I also measured the current chain fee endpoints rather than relying on stale fee assumptions; the README tells you to recheck immediately before broadcast.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..e46df447ef6f76714784bf4a8bd5d3cb62d9d8ad
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; verify and publish the source on BaseScan before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..283950731fa011eaf64777f45f5d1cab6eafde52
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,184 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(
+        uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash
+    );
+    event JobResolved(
+        uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount
+    );
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) {
+            revert InvalidAddress();
+        }
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) {
+            revert InvalidAmount();
+        }
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) {
+            revert TransferFailed();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(
+        uint256 jobId,
+        Job storage job,
+        Status outcome,
+        uint256 freelancerAmount,
+        uint256 clientAmount
+    ) private {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..e46df447ef6f76714784bf4a8bd5d3cb62d9d8ad
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; verify and publish the source on BaseScan before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..283950731fa011eaf64777f45f5d1cab6eafde52
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,184 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(
+        uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash
+    );
+    event JobResolved(
+        uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount
+    );
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) {
+            revert InvalidAddress();
+        }
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) {
+            revert InvalidAmount();
+        }
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) {
+            revert TransferFailed();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(
+        uint256 jobId,
+        Job storage job,
+        Status outcome,
+        uint256 freelancerAmount,
+        uint256 clientAmount
+    ) private {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge build && forge test -vvv && forge inspect FreelanceEscrow abi >/dev/null && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001
 succeeded in 331ms:
Compiling 3 files with Solc 0.8.28
Solc 0.8.28 finished in 197.53ms
Compiler run successful!
note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/DeployFreelanceEscrow.s.sol:14:25
   |
14 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:55:30
   |
55 |     uint256 public immutable minAmount;
   |                              ^^^^^^^^^ help: consider using: `MIN_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:56:30
   |
56 |     uint256 public immutable maxAmount;
   |                              ^^^^^^^^^ help: consider using: `MAX_AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:57:29
   |
57 |     IERC20 public immutable paymentToken;
   |                             ^^^^^^^^^^^^ help: consider using: `PAYMENT_TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:64:5
   |
64 | /     modifier nonReentrant() {
65 | |         if (unlocked != 1) revert ReentrantCall();
66 | |         unlocked = 2;
67 | |         _;
68 | |         unlocked = 1;
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
71 +         if (unlocked != 1) revert ReentrantCall();
72 +         unlocked = 2;
73 +     }
74 + 
75 +     function _nonReentrantAfter() internal {
76 +         unlocked = 1;
77 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> src/FreelanceEscrow.sol:108:21
    |
108 |             amount: uint96(amount),
    |                     ^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'uint96' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

No files changed, compilation skipped

Ran 3 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDispute() (gas: 205122)
[PASS] testCannotCreateOutsideDollarBand() (gas: 20991)
[PASS] testClientReleasesSubmittedWork() (gas: 194129)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 996.62µs (889.91µs CPU time)

Ran 1 test suite in 8.00ms (996.62µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..e46df447ef6f76714784bf4a8bd5d3cb62d9d8ad
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; verify and publish the source on BaseScan before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..283950731fa011eaf64777f45f5d1cab6eafde52
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,184 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(
+        uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash
+    );
+    event JobResolved(
+        uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount
+    );
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) {
+            revert InvalidAddress();
+        }
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) {
+            revert InvalidAmount();
+        }
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) {
+            revert TransferFailed();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(
+        uint256 jobId,
+        Job storage job,
+        Status outcome,
+        uint256 freelancerAmount,
+        uint256 clientAmount
+    ) private {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

codex
Built a Foundry-based USDC escrow project.

Key files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol)
- [deployment script](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/README.md)

It enforces $2,000–$50,000 in 6-decimal USDC, supports delivery submission, client release/refund, and arbiter-led disputed split payouts. The README recommends Base mainnet with native USDC and includes deployment commands.

Verified with `forge build` and `forge test`: 3 passing tests.

Before real use, deploy to a testnet first and obtain a professional security audit—the selected arbiter has material control over disputed funds.
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..e46df447ef6f76714784bf4a8bd5d3cb62d9d8ad
--- /dev/null
+++ b/README.md
@@ -0,0 +1,34 @@
+# Freelance Escrow
+
+A non-upgradeable USDC escrow for individual freelance jobs. The client funds a job when creating it; the freelancer submits a hash of the deliverable; the client releases payment. Before submission, the client can refund. Either party can raise a dispute, which the job's chosen neutral arbiter resolves in full or with a split payment.
+
+The contract enforces a payment-token range at deployment. The supplied deployment script uses 6-decimal USDC and enforces **$2,000–$50,000** (`2_000e6`–`50_000e6`). It deliberately does not use an exchange-rate oracle: the dollar band is only meaningful for a stablecoin such as USDC.
+
+## Deploy
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation), a funded deployer wallet, and a `PRIVATE_KEY` environment variable (never commit it).
+
+```bash
+forge test
+export PRIVATE_KEY=0x...
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url https://mainnet.base.org --broadcast
+```
+
+The defaults target Base mainnet native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For another network, supply its verified USDC address and matching smallest-unit limits:
+
+```bash
+export PAYMENT_TOKEN=0xYourVerifiedUSDCAddress
+export MIN_AMOUNT=2000000000
+export MAX_AMOUNT=50000000000
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+First use a testnet and independently verify the token address. Deployment output includes the deployed escrow address; verify and publish the source on BaseScan before accepting payments.
+
+## Recommended network
+
+Deploy on **Base mainnet** with native USDC. This is a low-frequency, high-value product, so Ethereum mainnet would also be a defensible choice; Base is the default here because it has native USDC and the live fee readings at the time this project was generated were materially lower. Recheck fees immediately before broadcasting—gas prices are volatile—and let Foundry derive transaction fee settings rather than hardcoding them.
+
+This contract has not been audited. For real $2k–$50k payments, obtain a professional audit, document how arbiters are selected, and use a multisig or established dispute-resolution process operationally. The arbiter can allocate every disputed dollar, so that role is a material trust assumption.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..bc932c29c5ff5f610f39f7208b23e15ca5178f20
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
+tab_width = 4
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2d352bfc5b48148c9e4f95673b06607d04585ed1
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envOr(string calldata name, address defaultValue) external returns (address value);
+    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
+}
+
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
+    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+    uint256 internal constant MIN_USDC = 2_000e6;
+    uint256 internal constant MAX_USDC = 50_000e6;
+
+    function run() external returns (FreelanceEscrow escrow) {
+        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
+        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
+        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
+        vm.startBroadcast();
+        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..283950731fa011eaf64777f45f5d1cab6eafde52
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,184 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Holds one USDC payment per job. It does not custody ETH or price assets with an oracle.
+contract FreelanceEscrow {
+    enum Status {
+        None,
+        Funded,
+        Submitted,
+        Disputed,
+        Released,
+        Refunded
+    }
+
+    struct Job {
+        address client;
+        address freelancer;
+        address arbiter;
+        uint96 amount;
+        Status status;
+        bytes32 detailsHash;
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus();
+    error TransferFailed();
+    error ReentrantCall();
+    error InvalidResolution();
+
+    event JobCreated(
+        uint256 indexed jobId,
+        address indexed client,
+        address indexed freelancer,
+        address arbiter,
+        uint256 amount,
+        bytes32 detailsHash
+    );
+    event WorkSubmitted(uint256 indexed jobId, bytes32 indexed deliverableHash);
+    event DisputeRaised(
+        uint256 indexed jobId, address indexed raisedBy, bytes32 indexed reasonHash
+    );
+    event JobResolved(
+        uint256 indexed jobId, Status outcome, uint256 freelancerAmount, uint256 clientAmount
+    );
+
+    /// @dev Token values are specified in its smallest unit. For 6-decimal USDC these are $2,000–$50,000.
+    uint256 public immutable minAmount;
+    uint256 public immutable maxAmount;
+    IERC20 public immutable paymentToken;
+    uint256 public nextJobId = 1;
+    uint256 public totalEscrowed;
+
+    mapping(uint256 jobId => Job job) public jobs;
+    uint256 private unlocked = 1;
+
+    modifier nonReentrant() {
+        if (unlocked != 1) revert ReentrantCall();
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(address paymentToken_, uint256 minAmount_, uint256 maxAmount_) {
+        if (paymentToken_ == address(0) || minAmount_ == 0 || minAmount_ > maxAmount_) {
+            revert InvalidAddress();
+        }
+        paymentToken = IERC20(paymentToken_);
+        minAmount = minAmount_;
+        maxAmount = maxAmount_;
+    }
+
+    /// @param detailsHash Hash of off-chain job terms; do not put private deliverables on-chain.
+    function createJob(address freelancer, address arbiter, uint256 amount, bytes32 detailsHash)
+        external
+        nonReentrant
+        returns (uint256 jobId)
+    {
+        if (
+            freelancer == address(0) || arbiter == address(0) || freelancer == msg.sender
+                || arbiter == msg.sender || arbiter == freelancer
+        ) {
+            revert InvalidAddress();
+        }
+        if (amount < minAmount || amount > maxAmount || amount > type(uint96).max) {
+            revert InvalidAmount();
+        }
+
+        // Reject fee-on-transfer tokens: every job must remain fully collateralized.
+        uint256 balanceBefore = paymentToken.balanceOf(address(this));
+        _safeTransferFrom(msg.sender, address(this), amount);
+        if (paymentToken.balanceOf(address(this)) != balanceBefore + amount) {
+            revert TransferFailed();
+        }
+
+        jobId = nextJobId++;
+        jobs[jobId] = Job({
+            client: msg.sender,
+            freelancer: freelancer,
+            arbiter: arbiter,
+            amount: uint96(amount),
+            status: Status.Funded,
+            detailsHash: detailsHash
+        });
+        totalEscrowed += amount;
+        emit JobCreated(jobId, msg.sender, freelancer, arbiter, amount, detailsHash);
+    }
+
+    function submitWork(uint256 jobId, bytes32 deliverableHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        job.status = Status.Submitted;
+        emit WorkSubmitted(jobId, deliverableHash);
+    }
+
+    /// @notice Client can release after reviewing work, or immediately if they no longer need a submission record.
+    function release(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        _resolve(jobId, job, Status.Released, job.amount, 0);
+    }
+
+    /// @notice Client may cancel only before the freelancer submits work.
+    function refundBeforeSubmission(uint256 jobId) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client) revert Unauthorized();
+        if (job.status != Status.Funded) revert InvalidStatus();
+        _resolve(jobId, job, Status.Refunded, 0, job.amount);
+    }
+
+    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.client && msg.sender != job.freelancer) revert Unauthorized();
+        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidStatus();
+        job.status = Status.Disputed;
+        emit DisputeRaised(jobId, msg.sender, reasonHash);
+    }
+
+    /// @notice The job's chosen arbiter selects the payout, including a split settlement.
+    function resolveDispute(uint256 jobId, uint256 freelancerAmount) external nonReentrant {
+        Job storage job = jobs[jobId];
+        if (msg.sender != job.arbiter) revert Unauthorized();
+        if (job.status != Status.Disputed) revert InvalidStatus();
+        if (freelancerAmount > job.amount) revert InvalidResolution();
+        uint256 clientAmount = uint256(job.amount) - freelancerAmount;
+        Status outcome = freelancerAmount == 0 ? Status.Refunded : Status.Released;
+        _resolve(jobId, job, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _resolve(
+        uint256 jobId,
+        Job storage job,
+        Status outcome,
+        uint256 freelancerAmount,
+        uint256 clientAmount
+    ) private {
+        job.status = outcome;
+        totalEscrowed -= job.amount;
+        if (freelancerAmount != 0) _safeTransfer(job.freelancer, freelancerAmount);
+        if (clientAmount != 0) _safeTransfer(job.client, clientAmount);
+        emit JobResolved(jobId, outcome, freelancerAmount, clientAmount);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory result) =
+            address(paymentToken).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7db272d8638cd341141f056edc4c71df90cfbdcd
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { return _transfer(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        require(allowance[from][msg.sender] >= amount, "allowance");
+        allowance[from][msg.sender] -= amount;
+        return _transfer(from, to, amount);
+    }
+    function _transfer(address from, address to, uint256 amount) private returns (bool) {
+        require(balanceOf[from] >= amount, "balance"); balanceOf[from] -= amount; balanceOf[to] += amount; return true;
+    }
+}
+
+contract Actor {
+    function approve(MockUSDC token, address spender, uint256 amount) external { token.approve(spender, amount); }
+    function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount) external returns (uint256) {
+        return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
+    }
+    function submit(FreelanceEscrow escrow, uint256 id) external { escrow.submitWork(id, keccak256("work")); }
+    function release(FreelanceEscrow escrow, uint256 id) external { escrow.release(id); }
+    function dispute(FreelanceEscrow escrow, uint256 id) external { escrow.raiseDispute(id, keccak256("reason")); }
+    function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external { escrow.resolveDispute(id, freelancerAmount); }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC token = new MockUSDC();
+    FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
+    Actor client = new Actor();
+    Actor freelancer = new Actor();
+    Actor arbiter = new Actor();
+
+    function setUp() public { token.mint(address(client), 10_000e6); client.approve(token, address(escrow), type(uint256).max); }
+
+    function testClientReleasesSubmittedWork() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.submit(escrow, id);
+        client.release(escrow, id);
+        require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
+        require(escrow.totalEscrowed() == 0, "liability remains");
+    }
+
+    function testArbiterCanSplitDispute() public {
+        uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
+        freelancer.dispute(escrow, id);
+        arbiter.resolve(escrow, id, 6_000e6);
+        require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
+        require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
+    }
+
+    function testCannotCreateOutsideDollarBand() public {
+        (bool ok,) = address(client).call(abi.encodeCall(Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)));
+        require(!ok, "under minimum accepted");
+    }
+}

tokens used
31,722
````

## final message

Built a Foundry-based USDC escrow project.

Key files:

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/src/FreelanceEscrow.sol)
- [deployment script](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233109Z-codex-with-skill-1/gas-goal-001/README.md)

It enforces $2,000–$50,000 in 6-decimal USDC, supports delivery submission, client release/refund, and arbiter-led disputed split payouts. The README recommends Base mainnet with native USDC and includes deployment commands.

Verified with `forge build` and `forge test`: 3 passing tests.

Before real use, deploy to a testnet first and obtain a professional security audit—the selected arbiter has material control over disputed funds.
