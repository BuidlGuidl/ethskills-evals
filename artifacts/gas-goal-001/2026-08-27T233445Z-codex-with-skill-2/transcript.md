# Executor transcript — 2026-08-27T233445Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04593-7820-7021-b9c1-84a5eb597de9
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-27T23:34:47.816189Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a04593-7820-7021-b9c1-84a5eb597de9.tmp-1787873687598628697: line 2547: syntax error near unexpected token `('

codex
I’ll build a deployable escrow contract with a practical test/deployment setup. Because choosing a network entails transaction-cost guidance, I’m applying the available gas guidance skill before selecting deployment defaults.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && rg --files -g 'AGENTS.md' -g 'package.json' -g 'foundry.toml' -g 'hardhat.config.*' -g 'README.md' | sed -n '1,160p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 succeeded in 5ms:
package.json

exec
/bin/bash -lc "pwd && find . -maxdepth 2 -type f | sort | sed -n '1,240p' && sed -n '1,240p' package.json && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 succeeded in 3ms:
exec
/bin/bash -lc "command -v forge || true
command -v cast || true
node --version
npm --version
sed -n '1,200p' TASK.md" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 succeeded in 311ms:
v22.22.2
10.9.7
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

codex
I’m using Foundry and USDC-denominated amounts, so the $2k–$50k limit is enforceable on-chain without relying on a price oracle. The design includes explicit acceptance, delivery, client release, cancellation before acceptance, and arbiter-controlled dispute splits.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/.gitignore
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/script/DeployFreelanceEscrow.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/src/interfaces/IERC20.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..10c796c059b95f893c1babffe574bd24344072ae
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0c260abc9c9c28517a816474fd5b209a32a7a147
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(
+        address indexed arbiter, uint256 clientAward, uint256 contractorAward
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0fa5e70bd2117cc4aaecf02d28e11b8396d80b5d
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant CONTRACTOR = address(0xC0N7RAc70R);
+    address private constant ARBITER = address(0xA8B17ER);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testClientCanFundAndReleaseAfterDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.markDelivered();
+        vm.prank(CLIENT);
+        escrow.release();
+
+        require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+    }
+
+    function testArbiterCanSplitDisputedFunds() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.raiseDispute();
+        vm.prank(ARBITER);
+        escrow.resolveDispute(4_000e6, 6_000e6);
+
+        require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testCannotReleaseBeforeDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidStatus.selector);
+        escrow.release();
+    }
+
+    function testOnlyClientCanFund() public {
+        vm.prank(CONTRACTOR);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.fund();
+    }
+
+    function testRejectsOutOfRangeAmount() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+    }
+}

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..10c796c059b95f893c1babffe574bd24344072ae
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0c260abc9c9c28517a816474fd5b209a32a7a147
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(
+        address indexed arbiter, uint256 clientAward, uint256 contractorAward
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0fa5e70bd2117cc4aaecf02d28e11b8396d80b5d
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant CONTRACTOR = address(0xC0N7RAc70R);
+    address private constant ARBITER = address(0xA8B17ER);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testClientCanFundAndReleaseAfterDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.markDelivered();
+        vm.prank(CLIENT);
+        escrow.release();
+
+        require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+    }
+
+    function testArbiterCanSplitDisputedFunds() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.raiseDispute();
+        vm.prank(ARBITER);
+        escrow.resolveDispute(4_000e6, 6_000e6);
+
+        require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testCannotReleaseBeforeDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidStatus.selector);
+        escrow.release();
+    }
+
+    function testOnlyClientCanFund() public {
+        vm.prank(CONTRACTOR);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.fund();
+    }
+
+    function testRejectsOutOfRangeAmount() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..10c796c059b95f893c1babffe574bd24344072ae
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0c260abc9c9c28517a816474fd5b209a32a7a147
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(
+        address indexed arbiter, uint256 clientAward, uint256 contractorAward
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e3b6def90a04085704b4bf143c0795aa2a270d1
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant CONTRACTOR = address(0xC0A7AC70);
+    address private constant ARBITER = address(0xA8B17E);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testClientCanFundAndReleaseAfterDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.markDelivered();
+        vm.prank(CLIENT);
+        escrow.release();
+
+        require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+    }
+
+    function testArbiterCanSplitDisputedFunds() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.raiseDispute();
+        vm.prank(ARBITER);
+        escrow.resolveDispute(4_000e6, 6_000e6);
+
+        require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testCannotReleaseBeforeDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidStatus.selector);
+        escrow.release();
+    }
+
+    function testOnlyClientCanFund() public {
+        vm.prank(CONTRACTOR);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.fund();
+    }
+
+    function testRejectsOutOfRangeAmount() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge test -vvv && forge build --sizes && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 exited 1 in 9ms:
Diff in src/FreelanceEscrow.sol:
41  41   |     event Cancelled(address indexed client);
42  42   |     event Refunded(address indexed client, uint256 amount);
43  43   |     event DisputeRaised(address indexed raisedBy);
44       |-    event DisputeResolved(
45       |-        address indexed arbiter, uint256 clientAward, uint256 contractorAward
46       |-    );
    44   |+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
47  45   | 
48  46   |     modifier onlyClient() {
49  47   |         if (msg.sender != client) revert Unauthorized();
--------------------------------------------------------------------------------143 141  |     }
144 142  | 
145 143  |     function _safeTransfer(address to, uint256 value) private {
146      |-        (bool success, bytes memory data) = address(usdc).call(
147      |-            abi.encodeCall(IERC20.transfer, (to, value))
148      |-        );
149      |-        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    144  |+        (bool success, bytes memory data) =
    145  |+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
    146  |+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
    147  |+            revert TokenTransferFailed();
    148  |+        }
150 149  |     }
151 150  | 
152 151  |     function _safeTransferFrom(address from, address to, uint256 value) private {
153      |-        (bool success, bytes memory data) = address(usdc).call(
154      |-            abi.encodeCall(IERC20.transferFrom, (from, to, value))
155      |-        );
156      |-        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    152  |+        (bool success, bytes memory data) =
    153  |+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
    154  |+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
    155  |+            revert TokenTransferFailed();
    156  |+        }
157 157  |     }
158 158  | }

Diff in test/FreelanceEscrow.t.sol:
42  42   |     }
43  43   | }
44  44   | 
45       |-contract FreelanceEscrowTest {
46       |-    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
47       |-    address private constant CLIENT = address(0xC1E17);
48       |-    address private constant CONTRACTOR = address(0xC0A7AC70);
49       |-    address private constant ARBITER = address(0xA8B17E);
50       |-    uint256 private constant AMOUNT = 10_000e6;
    45   |+    contract FreelanceEscrowTest {
    46   |+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    47   |+        address private constant CLIENT = address(0xC1E17);
    48   |+        address private constant CONTRACTOR = address(0xC0A7AC70);
    49   |+        address private constant ARBITER = address(0xA8B17E);
    50   |+        uint256 private constant AMOUNT = 10_000e6;
51  51   | 
52       |-    MockUSDC private token;
53       |-    FreelanceEscrow private escrow;
    52   |+        MockUSDC private token;
    53   |+        FreelanceEscrow private escrow;
54  54   | 
55       |-    function setUp() public {
56       |-        token = new MockUSDC();
57       |-        escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
58       |-        token.mint(CLIENT, AMOUNT);
59       |-        vm.prank(CLIENT);
60       |-        token.approve(address(escrow), AMOUNT);
61       |-    }
    55   |+        function setUp() public {
    56   |+            token = new MockUSDC();
    57   |+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
    58   |+            token.mint(CLIENT, AMOUNT);
    59   |+            vm.prank(CLIENT);
    60   |+            token.approve(address(escrow), AMOUNT);
    61   |+        }
62  62   | 
63       |-    function testClientCanFundAndReleaseAfterDelivery() public {
64       |-        vm.prank(CLIENT);
65       |-        escrow.fund();
66       |-        vm.prank(CONTRACTOR);
67       |-        escrow.markDelivered();
68       |-        vm.prank(CLIENT);
69       |-        escrow.release();
    63   |+        function testClientCanFundAndReleaseAfterDelivery() public {
    64   |+            vm.prank(CLIENT);
    65   |+            escrow.fund();
    66   |+            vm.prank(CONTRACTOR);
    67   |+            escrow.markDelivered();
    68   |+            vm.prank(CLIENT);
    69   |+            escrow.release();
70  70   | 
71       |-        require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
72       |-        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
73       |-    }
    71   |+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
    72   |+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
    73   |+        }
74  74   | 
75       |-    function testArbiterCanSplitDisputedFunds() public {
76       |-        vm.prank(CLIENT);
77       |-        escrow.fund();
78       |-        vm.prank(CONTRACTOR);
79       |-        escrow.raiseDispute();
80       |-        vm.prank(ARBITER);
81       |-        escrow.resolveDispute(4_000e6, 6_000e6);
    75   |+        function testArbiterCanSplitDisputedFunds() public {
    76   |+            vm.prank(CLIENT);
    77   |+            escrow.fund();
    78   |+            vm.prank(CONTRACTOR);
    79   |+            escrow.raiseDispute();
    80   |+            vm.prank(ARBITER);
    81   |+            escrow.resolveDispute(4_000e6, 6_000e6);
82  82   | 
83       |-        require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
84       |-        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
85       |-    }
    83   |+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
    84   |+            require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
    85   |+        }
86  86   | 
87       |-    function testCannotReleaseBeforeDelivery() public {
88       |-        vm.prank(CLIENT);
89       |-        escrow.fund();
90       |-        vm.prank(CLIENT);
91       |-        vm.expectRevert(FreelanceEscrow.InvalidStatus.selector);
92       |-        escrow.release();
93       |-    }
    87   |+        function testCannotReleaseBeforeDelivery() public {
    88   |+            vm.prank(CLIENT);
    89   |+            escrow.fund();
    90   |+            vm.prank(CLIENT);
    91   |+            vm.expectRevert(FreelanceEscrow.InvalidStatus.selector);
    92   |+            escrow.release();
    93   |+        }
94  94   | 
95       |-    function testOnlyClientCanFund() public {
96       |-        vm.prank(CONTRACTOR);
97       |-        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
98       |-        escrow.fund();
99       |-    }
    95   |+        function testOnlyClientCanFund() public {
    96   |+            vm.prank(CONTRACTOR);
    97   |+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
    98   |+            escrow.fund();
    99   |+        }
100 100  | 
101      |-    function testRejectsOutOfRangeAmount() public {
102      |-        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
103      |-        new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
    101  |+        function testRejectsOutOfRangeAmount() public {
    102  |+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
    103  |+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
    104  |+        }
104 105  |     }
105      |-}

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..10c796c059b95f893c1babffe574bd24344072ae
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0c260abc9c9c28517a816474fd5b209a32a7a147
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(
+        address indexed arbiter, uint256 clientAward, uint256 contractorAward
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e3b6def90a04085704b4bf143c0795aa2a270d1
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant CONTRACTOR = address(0xC0A7AC70);
+    address private constant ARBITER = address(0xA8B17E);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testClientCanFundAndReleaseAfterDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.markDelivered();
+        vm.prank(CLIENT);
+        escrow.release();
+
+        require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+    }
+
+    function testArbiterCanSplitDisputedFunds() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.raiseDispute();
+        vm.prank(ARBITER);
+        escrow.resolveDispute(4_000e6, 6_000e6);
+
+        require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testCannotReleaseBeforeDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidStatus.selector);
+        escrow.release();
+    }
+
+    function testOnlyClientCanFund() public {
+        vm.prank(CONTRACTOR);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.fund();
+    }
+
+    function testRejectsOutOfRangeAmount() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+    }
+}

exec
/bin/bash -lc "nl -ba test/FreelanceEscrow.t.sol | sed -n '1,180p'
forge fmt
forge test -vvv
forge build --sizes
git diff --check
git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 succeeded in 405ms:
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 182.94ms
Compiler run successful!

Ran 5 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDisputedFunds() (gas: 83815)
[FAIL: Error != expected error: InvalidStatus(1) != wO] testCannotReleaseBeforeDelivery() (gas: 73144)
Traces:
  [73144] FreelanceEscrowTest::testCannotReleaseBeforeDelivery()
    ├─ [0] VM::prank(0x00000000000000000000000000000000000C1e17)
    │   └─ ← [Return]
    ├─ [63183] FreelanceEscrow::fund()
    │   ├─ [2563] MockUSDC::balanceOf(FreelanceEscrow: [0x2e234DAe75C793f67A35089C9d99245E1C58470b]) [staticcall]
    │   │   └─ ← [Return] 0
    │   ├─ [31651] MockUSDC::transferFrom(0x00000000000000000000000000000000000C1e17, FreelanceEscrow: [0x2e234DAe75C793f67A35089C9d99245E1C58470b], 10000000000 [1e10])
    │   │   └─ ← [Return] true
    │   ├─ [563] MockUSDC::balanceOf(FreelanceEscrow: [0x2e234DAe75C793f67A35089C9d99245E1C58470b]) [staticcall]
    │   │   └─ ← [Return] 10000000000 [1e10]
    │   ├─ emit Funded(client: 0x00000000000000000000000000000000000C1e17, amount: 10000000000 [1e10])
    │   └─ ← [Stop]
    ├─ [0] VM::prank(0x00000000000000000000000000000000000C1e17)
    │   └─ ← [Return]
    ├─ [0] VM::expectRevert(custom error 0xc31eb0e0: wO)
    │   └─ ← [Return]
    ├─ [630] FreelanceEscrow::release()
    │   └─ ← [Revert] InvalidStatus(1)
    └─ ← [Revert] Error != expected error: InvalidStatus(1) != wO

Backtrace:
  at FreelanceEscrow.release
  at FreelanceEscrowTest.testCannotReleaseBeforeDelivery

[PASS] testClientCanFundAndReleaseAfterDelivery() (gas: 80236)
[PASS] testOnlyClientCanFund() (gas: 8683)
[PASS] testRejectsOutOfRangeAmount() (gas: 39546)
Suite result: FAILED. 4 passed; 1 failed; 0 skipped; finished in 2.12ms (2.18ms CPU time)

Ran 1 test suite in 11.66ms (2.12ms CPU time): 4 tests passed, 1 failed, 0 skipped (5 total tests)

Failing tests:
Encountered 1 failing test in test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[FAIL: Error != expected error: InvalidStatus(1) != wO] testCannotReleaseBeforeDelivery() (gas: 73144)

Encountered a total of 1 failing tests, 4 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 103.17ms
Compiler run successful!

╭-----------------------+------------------+-------------------+--------------------+---------------------╮
| Contract              | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+=========================================================================================================+
| DeployFreelanceEscrow | 5,820            | 5,849             | 18,756             | 43,303              |
|-----------------------+------------------+-------------------+--------------------+---------------------|
| FreelanceEscrow       | 3,717            | 4,395             | 20,859             | 44,757              |
|-----------------------+------------------+-------------------+--------------------+---------------------|
| MockUSDC              | 1,058            | 1,087             | 23,518             | 48,065              |
╰-----------------------+------------------+-------------------+--------------------+---------------------╯

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:23:29
   |
23 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:46:29
   |
46 |         Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                             ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/DeployFreelanceEscrow.s.sol:16:25
   |
16 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:24:30
   |
24 |     address public immutable client;
   |                              ^^^^^^ help: consider using: `CLIENT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:25:30
   |
25 |     address public immutable contractor;
   |                              ^^^^^^^^^^ help: consider using: `CONTRACTOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:26:30
   |
26 |     address public immutable arbiter;
   |                              ^^^^^^^ help: consider using: `ARBITER`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:27:30
   |
27 |     uint256 public immutable amount;
   |                              ^^^^^^ help: consider using: `AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:46:5
   |
46 | /     modifier onlyClient() {
47 | |         if (msg.sender != client) revert Unauthorized();
48 | |         _;
49 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
46 ~     modifier onlyClient() {
47 +         _onlyClient();
48 +         _;
49 +     }
50 + 
51 +     function _onlyClient() internal {
52 +         if (msg.sender != client) revert Unauthorized();
53 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:51:5
   |
51 | /     modifier onlyContractor() {
52 | |         if (msg.sender != contractor) revert Unauthorized();
53 | |         _;
54 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
51 ~     modifier onlyContractor() {
52 +         _onlyContractor();
53 +         _;
54 +     }
55 + 
56 +     function _onlyContractor() internal {
57 +         if (msg.sender != contractor) revert Unauthorized();
58 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:56:5
   |
56 | /     modifier onlyParticipant() {
57 | |         if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
58 | |         _;
59 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
56 ~     modifier onlyParticipant() {
57 +         _onlyParticipant();
58 +         _;
59 +     }
60 + 
61 +     function _onlyParticipant() internal {
62 +         if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
63 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:61:5
   |
61 | /     modifier onlyArbiter() {
62 | |         if (msg.sender != arbiter) revert Unauthorized();
63 | |         _;
64 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
61 ~     modifier onlyArbiter() {
62 +         _onlyArbiter();
63 +         _;
64 +     }
65 + 
66 +     function _onlyArbiter() internal {
67 +         if (msg.sender != arbiter) revert Unauthorized();
68 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

?? .gitignore
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..10c796c059b95f893c1babffe574bd24344072ae
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0c260abc9c9c28517a816474fd5b209a32a7a147
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,158 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(
+        address indexed arbiter, uint256 clientAward, uint256 contractorAward
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (from, to, value))
+        );
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9e3b6def90a04085704b4bf143c0795aa2a270d1
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,105 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant CONTRACTOR = address(0xC0A7AC70);
+    address private constant ARBITER = address(0xA8B17E);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+        token.mint(CLIENT, AMOUNT);
+        vm.prank(CLIENT);
+        token.approve(address(escrow), AMOUNT);
+    }
+
+    function testClientCanFundAndReleaseAfterDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.markDelivered();
+        vm.prank(CLIENT);
+        escrow.release();
+
+        require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+    }
+
+    function testArbiterCanSplitDisputedFunds() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.raiseDispute();
+        vm.prank(ARBITER);
+        escrow.resolveDispute(4_000e6, 6_000e6);
+
+        require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testCannotReleaseBeforeDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        vm.expectRevert(FreelanceEscrow.InvalidStatus.selector);
+        escrow.release();
+    }
+
+    function testOnlyClientCanFund() public {
+        vm.prank(CONTRACTOR);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.fund();
+    }
+
+    function testRejectsOutOfRangeAmount() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+    }
+}

codex
The initial test run caught an assertion detail in the test harness (the contract correctly reverted with its state error, including the current state value). I’m tightening that test and adding the contractor-acceptance state so the documented workflow exactly matches the deployed behavior.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d945d1316cbd8f07b74931eda319157abb5f324e
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..472b61708dcedfcb92d2c17e1b89b0bb4117100a
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e5308bc5b1d293fac1e21bd7996c25323d6b98c5
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.acceptJob();
+        vm.prank(CONTRACTOR);
+        escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+        function testArbiterCanSplitDisputedFunds() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+            require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+        }
+
+        function testCannotReleaseBeforeDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        vm.expectRevert(
+            abi.encodeWithSelector(FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded)
+        );
+        escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

exec
/bin/bash -lc 'forge fmt && forge test -vvv && forge build --sizes && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 exited 1 in 63ms:
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 6.15ms
Error: Compiler run failed:
Error (9553): Invalid type for argument in function call. Invalid implicit conversion from bytes4 to bytes memory requested.
   --> test/FreelanceEscrow.t.sol:103:29:
    |
103 |             vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
    |                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Error (9553): Invalid type for argument in function call. Invalid implicit conversion from bytes4 to bytes memory requested.
   --> test/FreelanceEscrow.t.sol:108:29:
    |
108 |             vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
    |                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d945d1316cbd8f07b74931eda319157abb5f324e
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..472b61708dcedfcb92d2c17e1b89b0bb4117100a
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e5308bc5b1d293fac1e21bd7996c25323d6b98c5
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,109 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CONTRACTOR);
+        escrow.acceptJob();
+        vm.prank(CONTRACTOR);
+        escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+        function testArbiterCanSplitDisputedFunds() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+            require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+        }
+
+        function testCannotReleaseBeforeDelivery() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        vm.expectRevert(
+            abi.encodeWithSelector(FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded)
+        );
+        escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d945d1316cbd8f07b74931eda319157abb5f324e
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..472b61708dcedfcb92d2c17e1b89b0bb4117100a
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4cf6e269e7da044aaf5cb085cf42e9492da860f1
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+        function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+            require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+        }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

exec
/bin/bash -lc 'forge fmt --check && forge test -vvv && forge build --sizes && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 succeeded in 406ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 183.19ms
Compiler run successful!

Ran 5 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDisputedFunds() (gas: 83879)
[PASS] testCannotReleaseBeforeDelivery() (gas: 64090)
[PASS] testClientCanFundAndReleaseAfterDelivery() (gas: 82340)
[PASS] testOnlyClientCanFund() (gas: 8705)
[PASS] testRejectsOutOfRangeAmount() (gas: 39623)
Suite result: ok. 5 passed; 0 failed; 0 skipped; finished in 647.74µs (930.56µs CPU time)

Ran 1 test suite in 7.85ms (647.74µs CPU time): 5 tests passed, 0 failed, 0 skipped (5 total tests)
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 106.39ms
Compiler run successful!

╭-----------------------+------------------+-------------------+--------------------+---------------------╮
| Contract              | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+=========================================================================================================+
| DeployFreelanceEscrow | 6,114            | 6,143             | 18,462             | 43,009              |
|-----------------------+------------------+-------------------+--------------------+---------------------|
| FreelanceEscrow       | 3,997            | 4,689             | 20,579             | 44,463              |
|-----------------------+------------------+-------------------+--------------------+---------------------|
| MockUSDC              | 1,058            | 1,087             | 23,518             | 48,065              |
╰-----------------------+------------------+-------------------+--------------------+---------------------╯

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:24:29
   |
24 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/DeployFreelanceEscrow.s.sol:16:25
   |
16 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:47:29
   |
47 |         Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                             ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:25:30
   |
25 |     address public immutable client;
   |                              ^^^^^^ help: consider using: `CLIENT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:26:30
   |
26 |     address public immutable contractor;
   |                              ^^^^^^^^^^ help: consider using: `CONTRACTOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:27:30
   |
27 |     address public immutable arbiter;
   |                              ^^^^^^^ help: consider using: `ARBITER`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:28:30
   |
28 |     uint256 public immutable amount;
   |                              ^^^^^^ help: consider using: `AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:48:5
   |
48 | /     modifier onlyClient() {
49 | |         if (msg.sender != client) revert Unauthorized();
50 | |         _;
51 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
48 ~     modifier onlyClient() {
49 +         _onlyClient();
50 +         _;
51 +     }
52 + 
53 +     function _onlyClient() internal {
54 +         if (msg.sender != client) revert Unauthorized();
55 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:53:5
   |
53 | /     modifier onlyContractor() {
54 | |         if (msg.sender != contractor) revert Unauthorized();
55 | |         _;
56 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
53 ~     modifier onlyContractor() {
54 +         _onlyContractor();
55 +         _;
56 +     }
57 + 
58 +     function _onlyContractor() internal {
59 +         if (msg.sender != contractor) revert Unauthorized();
60 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:58:5
   |
58 | /     modifier onlyParticipant() {
59 | |         if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
60 | |         _;
61 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
58 ~     modifier onlyParticipant() {
59 +         _onlyParticipant();
60 +         _;
61 +     }
62 + 
63 +     function _onlyParticipant() internal {
64 +         if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
65 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:63:5
   |
63 | /     modifier onlyArbiter() {
64 | |         if (msg.sender != arbiter) revert Unauthorized();
65 | |         _;
66 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
63 ~     modifier onlyArbiter() {
64 +         _onlyArbiter();
65 +         _;
66 +     }
67 + 
68 +     function _onlyArbiter() internal {
69 +         if (msg.sender != arbiter) revert Unauthorized();
70 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

?? .gitignore
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d945d1316cbd8f07b74931eda319157abb5f324e
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..472b61708dcedfcb92d2c17e1b89b0bb4117100a
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4cf6e269e7da044aaf5cb085cf42e9492da860f1
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+        function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+            require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+        }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

codex
The contract now compiles cleanly and all five lifecycle/authorization tests pass. I’m doing a final deployment-readiness pass, including making the README’s mainnet token guidance explicit without embedding a command that depends on optional explorer-verification credentials.
web search: 
web search: site:developers.circle.com USDC Ethereum mainnet contract address
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..d945d1316cbd8f07b74931eda319157abb5f324e
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`. After funding, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="the-native-USDC-address-for-your-network"
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast --verify
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with a mock/test USDC, then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..472b61708dcedfcb92d2c17e1b89b0bb4117100a
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,169 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4cf6e269e7da044aaf5cb085cf42e9492da860f1
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,112 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+        function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+            require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+        }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a94a9507b91197b6562d52b6ccca6be8d26e3f8f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`; before acceptance, they can recover the funded amount with `refundUnaccepted()`. After acceptance, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # Ethereum native USDC
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Circle currently lists Ethereum native USDC at the address used above. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with Circle test USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..15995d893c3361d9e6aab145eaa9414f3ac42613
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_ || arbiter_ == client_
+                || arbiter_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Client recovers funds if the contractor has not yet accepted the funded job.
+    function refundUnaccepted() external onlyClient {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Refunded;
+        _safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..44f8a749d0987f3a81927a16ead88cde033a3d51
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+    function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testClientCanRecoverIfJobIsNotAccepted() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        escrow.refundUnaccepted();
+
+        require(token.balanceOf(CLIENT) == AMOUNT, "client refund missing");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Refunded), "wrong state");
+    }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

exec
/bin/bash -lc 'forge fmt && forge test -vvv && forge build --sizes && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 succeeded in 425ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 200.11ms
Compiler run successful!

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDisputedFunds() (gas: 83857)
[PASS] testCannotReleaseBeforeDelivery() (gas: 64068)
[PASS] testClientCanFundAndReleaseAfterDelivery() (gas: 82380)
[PASS] testClientCanRecoverIfJobIsNotAccepted() (gas: 60419)
[PASS] testOnlyClientCanFund() (gas: 8683)
[PASS] testRejectsOutOfRangeAmount() (gas: 39859)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 748.42µs (1.30ms CPU time)

Ran 1 test suite in 9.54ms (748.42µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 113.42ms
Compiler run successful!

╭-----------------------+------------------+-------------------+--------------------+---------------------╮
| Contract              | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
+=========================================================================================================+
| DeployFreelanceEscrow | 6,578            | 6,607             | 17,998             | 42,545              |
|-----------------------+------------------+-------------------+--------------------+---------------------|
| FreelanceEscrow       | 4,367            | 5,153             | 20,209             | 43,999              |
|-----------------------+------------------+-------------------+--------------------+---------------------|
| MockUSDC              | 1,058            | 1,087             | 23,518             | 48,065              |
╰-----------------------+------------------+-------------------+--------------------+---------------------╯

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:24:29
   |
24 |     IERC20 public immutable usdc;
   |                             ^^^^ help: consider using: `USDC`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/FreelanceEscrow.t.sol:47:29
   |
47 |         Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                             ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:25:30
   |
25 |     address public immutable client;
   |                              ^^^^^^ help: consider using: `CLIENT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:26:30
   |
26 |     address public immutable contractor;
   |                              ^^^^^^^^^^ help: consider using: `CONTRACTOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:27:30
   |
27 |     address public immutable arbiter;
   |                              ^^^^^^^ help: consider using: `ARBITER`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:28:30
   |
28 |     uint256 public immutable amount;
   |                              ^^^^^^ help: consider using: `AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/DeployFreelanceEscrow.s.sol:16:25
   |
16 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:48:5
   |
48 | /     modifier onlyClient() {
49 | |         if (msg.sender != client) revert Unauthorized();
50 | |         _;
51 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
48 ~     modifier onlyClient() {
49 +         _onlyClient();
50 +         _;
51 +     }
52 + 
53 +     function _onlyClient() internal {
54 +         if (msg.sender != client) revert Unauthorized();
55 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:53:5
   |
53 | /     modifier onlyContractor() {
54 | |         if (msg.sender != contractor) revert Unauthorized();
55 | |         _;
56 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
53 ~     modifier onlyContractor() {
54 +         _onlyContractor();
55 +         _;
56 +     }
57 + 
58 +     function _onlyContractor() internal {
59 +         if (msg.sender != contractor) revert Unauthorized();
60 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:58:5
   |
58 | /     modifier onlyParticipant() {
59 | |         if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
60 | |         _;
61 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
58 ~     modifier onlyParticipant() {
59 +         _onlyParticipant();
60 +         _;
61 +     }
62 + 
63 +     function _onlyParticipant() internal {
64 +         if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
65 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:63:5
   |
63 | /     modifier onlyArbiter() {
64 | |         if (msg.sender != arbiter) revert Unauthorized();
65 | |         _;
66 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
63 ~     modifier onlyArbiter() {
64 +         _onlyArbiter();
65 +         _;
66 +     }
67 + 
68 +     function _onlyArbiter() internal {
69 +         if (msg.sender != arbiter) revert Unauthorized();
70 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

?? .gitignore
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a94a9507b91197b6562d52b6ccca6be8d26e3f8f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`; before acceptance, they can recover the funded amount with `refundUnaccepted()`. After acceptance, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # Ethereum native USDC
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. Circle currently lists Ethereum native USDC at the address used above. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with Circle test USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..15995d893c3361d9e6aab145eaa9414f3ac42613
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_ || arbiter_ == client_
+                || arbiter_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Client recovers funds if the contractor has not yet accepted the funded job.
+    function refundUnaccepted() external onlyClient {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Refunded;
+        _safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..44f8a749d0987f3a81927a16ead88cde033a3d51
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+    function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testClientCanRecoverIfJobIsNotAccepted() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        escrow.refundUnaccepted();
+
+        require(token.balanceOf(CLIENT) == AMOUNT, "client refund missing");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Refunded), "wrong state");
+    }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/README.md
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..df8e6d45d8cac50f5fe04db0553680c777ebfd3f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`; before acceptance, they can recover the funded amount with `refundUnaccepted()`. After acceptance, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # Ethereum native USDC
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. [Circle currently lists Ethereum native USDC](https://developers.circle.com/stablecoins/usdc-contract-addresses) at the address used above. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with Circle test USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..15995d893c3361d9e6aab145eaa9414f3ac42613
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_ || arbiter_ == client_
+                || arbiter_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Client recovers funds if the contractor has not yet accepted the funded job.
+    function refundUnaccepted() external onlyClient {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Refunded;
+        _safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..44f8a749d0987f3a81927a16ead88cde033a3d51
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+    function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testClientCanRecoverIfJobIsNotAccepted() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        escrow.refundUnaccepted();
+
+        require(token.balanceOf(CLIENT) == AMOUNT, "client refund missing");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Refunded), "wrong state");
+    }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

exec
/bin/bash -lc 'forge fmt --check && forge test && git diff --check && find src script test -type f | sort' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001
 succeeded in 63ms:
No files changed, compilation skipped

Ran 6 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitDisputedFunds() (gas: 83857)
[PASS] testCannotReleaseBeforeDelivery() (gas: 64068)
[PASS] testClientCanFundAndReleaseAfterDelivery() (gas: 82380)
[PASS] testClientCanRecoverIfJobIsNotAccepted() (gas: 60419)
[PASS] testOnlyClientCanFund() (gas: 8683)
[PASS] testRejectsOutOfRangeAmount() (gas: 39859)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 715.30µs (1.14ms CPU time)

Ran 1 test suite in 7.80ms (715.30µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
script/DeployFreelanceEscrow.s.sol
src/FreelanceEscrow.sol
src/interfaces/IERC20.sol
test/FreelanceEscrow.t.sol

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..df8e6d45d8cac50f5fe04db0553680c777ebfd3f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`; before acceptance, they can recover the funded amount with `refundUnaccepted()`. After acceptance, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # Ethereum native USDC
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. [Circle currently lists Ethereum native USDC](https://developers.circle.com/stablecoins/usdc-contract-addresses) at the address used above. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with Circle test USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..15995d893c3361d9e6aab145eaa9414f3ac42613
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_ || arbiter_ == client_
+                || arbiter_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Client recovers funds if the contractor has not yet accepted the funded job.
+    function refundUnaccepted() external onlyClient {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Refunded;
+        _safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..44f8a749d0987f3a81927a16ead88cde033a3d51
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+    function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testClientCanRecoverIfJobIsNotAccepted() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        escrow.refundUnaccepted();
+
+        require(token.balanceOf(CLIENT) == AMOUNT, "client refund missing");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Refunded), "wrong state");
+    }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

codex
Built a Foundry-based USDC escrow service, ready to deploy.

- Core contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol)
- Deployment script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Deployment instructions and network rationale: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/README.md)

It enforces $2,000–$50,000 in six-decimal USDC and supports funding, contractor acceptance, delivery, release, pre-acceptance refund, and arbiter-controlled dispute splits. The recommended target is Ethereum mainnet with native USDC; the README includes the current official USDC address and a Sepolia test path.

Verified with `forge test`: 6 tests passed. Before accepting real funds, have the contract independently audited and use a multisig for the arbiter.
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..97544b8b4fa19d1a00d37b9435948c7ca2271390
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+out/
+cache/
+broadcast/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..df8e6d45d8cac50f5fe04db0553680c777ebfd3f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,40 @@
+# Freelance USDC Escrow
+
+This project deploys one escrow contract per job. It holds a fixed amount of a six-decimal USD stablecoin (intended for native USDC) between **$2,000 and $50,000**. The contract never takes a platform fee or has an owner who can withdraw funds.
+
+## Workflow
+
+1. Deploy with the client, contractor, arbitrator, USDC address, and agreed amount.
+2. The client approves USDC and calls `fund()`; the contractor calls `acceptJob()` before beginning work.
+3. The contractor calls `markDelivered()`; the client calls `release()` to pay them.
+4. Before funding, the client can `cancel()`; before acceptance, they can recover the funded amount with `refundUnaccepted()`. After acceptance, either party can call `raiseDispute()`; only the specified arbitrator can split the full balance with `resolveDispute(clientAward, contractorAward)`.
+
+The arbitrator is a meaningful trust role. Use a multisig or professional arbitration wallet, agree on the dispute process off-chain, and have this code independently audited before real funds are used.
+
+## Deploy
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run:
+
+```bash
+forge build
+forge test
+
+export RPC_URL="https://your-mainnet-rpc"
+export PRIVATE_KEY="your-deployer-private-key"
+export USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # Ethereum native USDC
+export CLIENT_ADDRESS="0x..."
+export CONTRACTOR_ADDRESS="0x..."
+export ARBITER_ADDRESS="0x..." # preferably a multisig
+export AMOUNT_USDC=10000000000 # $10,000.00 at 6 decimals
+
+forge script script/DeployFreelanceEscrow.s.sol:DeployFreelanceEscrow \
+  --rpc-url "$RPC_URL" --broadcast
+```
+
+Record the deployed address and verify it in the relevant block explorer. The client then approves exactly `AMOUNT_USDC` to that address and calls `fund()` through an explorer or a small frontend.
+
+## Recommended network
+
+Deploy on **Ethereum mainnet**, using Circle's native USDC, for this product's $2k–$50k, relatively low-frequency payments: its settlement security and USDC liquidity are the important fit. [Circle currently lists Ethereum native USDC](https://developers.circle.com/stablecoins/usdc-contract-addresses) at the address used above. Use a well-managed RPC provider and obtain current fee estimates from the target chain immediately before broadcasting; this project deliberately does not hard-code gas settings. Test the same deployment first on Sepolia with Circle test USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), then redeploy to mainnet with the actual native-USDC token address.
+
+The contract assumes the token has exactly six decimals and standard ERC-20 transfer behavior. Do not substitute a bridged, fee-on-transfer, rebasing, or non-six-decimal token.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..01569f612d02f1547a35035e7d5497ac3e3ce64d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+evm_version = "cancun"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/script/DeployFreelanceEscrow.s.sol b/script/DeployFreelanceEscrow.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8ac65ccf23ec4a6e5716175a705e6d225cdbfb47
--- /dev/null
+++ b/script/DeployFreelanceEscrow.s.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address value);
+    function envUint(string calldata name) external returns (uint256 value);
+    function startBroadcast(uint256 privateKey) external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
+contract DeployFreelanceEscrow {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (FreelanceEscrow escrow) {
+        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
+        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
+        address client = vm.envAddress("CLIENT_ADDRESS");
+        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
+        address arbiter = vm.envAddress("ARBITER_ADDRESS");
+        uint256 amount = vm.envUint("AMOUNT_USDC");
+
+        vm.startBroadcast(deployerKey);
+        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..15995d893c3361d9e6aab145eaa9414f3ac42613
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,178 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC amount for one freelance job until release, cancellation, or arbitration.
+/// @dev Amount limits assume a six-decimal USD stablecoin such as native USDC.
+contract FreelanceEscrow {
+    uint256 public constant MIN_JOB_AMOUNT = 2_000e6;
+    uint256 public constant MAX_JOB_AMOUNT = 50_000e6;
+
+    enum Status {
+        Created,
+        Funded,
+        Accepted,
+        Delivered,
+        Disputed,
+        Released,
+        Refunded,
+        Cancelled
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable contractor;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    Status public status;
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidStatus(Status current);
+    error InvalidAward();
+    error TokenTransferFailed();
+    error IncorrectFundingReceived();
+
+    event Funded(address indexed client, uint256 amount);
+    event Accepted(address indexed contractor);
+    event DeliveryMarked(address indexed contractor);
+    event Released(address indexed client, address indexed contractor, uint256 amount);
+    event Cancelled(address indexed client);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeRaised(address indexed raisedBy);
+    event DisputeResolved(address indexed arbiter, uint256 clientAward, uint256 contractorAward);
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyContractor() {
+        if (msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParticipant() {
+        if (msg.sender != client && msg.sender != contractor) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address contractor_,
+        address arbiter_,
+        uint256 amount_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || contractor_ == address(0)
+                || arbiter_ == address(0) || client_ == contractor_ || arbiter_ == client_
+                || arbiter_ == contractor_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_JOB_AMOUNT || amount_ > MAX_JOB_AMOUNT) revert InvalidAmount();
+
+        usdc = usdc_;
+        client = client_;
+        contractor = contractor_;
+        arbiter = arbiter_;
+        amount = amount_;
+        status = Status.Created;
+    }
+
+    /// @notice Client deposits the complete agreed amount after approving this contract.
+    function fund() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != balanceBefore + amount) {
+            revert IncorrectFundingReceived();
+        }
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Contractor accepts the funded job before beginning work.
+    function acceptJob() external onlyContractor {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Accepted;
+        emit Accepted(contractor);
+    }
+
+    /// @notice Contractor confirms that the agreed work has been delivered.
+    function markDelivered() external onlyContractor {
+        if (status != Status.Accepted) revert InvalidStatus(status);
+        status = Status.Delivered;
+        emit DeliveryMarked(contractor);
+    }
+
+    /// @notice Client releases the entire escrow to the contractor after reviewing delivery.
+    function release() external onlyClient {
+        if (status != Status.Delivered) revert InvalidStatus(status);
+        status = Status.Released;
+        _safeTransfer(contractor, amount);
+        emit Released(client, contractor, amount);
+    }
+
+    /// @notice Client cancels an unfunded job. No funds have entered the escrow.
+    function cancel() external onlyClient {
+        if (status != Status.Created) revert InvalidStatus(status);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    /// @notice Client recovers funds if the contractor has not yet accepted the funded job.
+    function refundUnaccepted() external onlyClient {
+        if (status != Status.Funded) revert InvalidStatus(status);
+        status = Status.Refunded;
+        _safeTransfer(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice Either participant can freeze a funded or delivered job for the designated arbiter.
+    function raiseDispute() external onlyParticipant {
+        if (status != Status.Funded && status != Status.Accepted && status != Status.Delivered) {
+            revert InvalidStatus(status);
+        }
+        status = Status.Disputed;
+        emit DisputeRaised(msg.sender);
+    }
+
+    /// @notice Arbiter distributes the full escrow; either award may be zero.
+    function resolveDispute(uint256 clientAward, uint256 contractorAward) external onlyArbiter {
+        if (status != Status.Disputed) revert InvalidStatus(status);
+        if (clientAward + contractorAward != amount) revert InvalidAward();
+
+        // Set a terminal state before interactions to prevent reentrancy through a malicious token.
+        status = clientAward == amount ? Status.Refunded : Status.Released;
+        if (clientAward != 0) _safeTransfer(client, clientAward);
+        if (contractorAward != 0) _safeTransfer(contractor, contractorAward);
+
+        emit DisputeResolved(arbiter, clientAward, contractorAward);
+    }
+
+    function _safeTransfer(address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 value) private {
+        (bool success, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
+        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
+            revert TokenTransferFailed();
+        }
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2a0e59dade0c0990b519607f23ef077f110ce909
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+
+    function transfer(address to, uint256 value) external returns (bool);
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..44f8a749d0987f3a81927a16ead88cde033a3d51
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,122 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+    function expectRevert(bytes calldata) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external {
+        balanceOf[to] += value;
+    }
+
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+
+    function transfer(address to, uint256 value) external returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= value, "allowance");
+        allowance[from][msg.sender] = allowed - value;
+        _transfer(from, to, value);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 value) private {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+    }
+}
+
+    contract FreelanceEscrowTest {
+        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+        address private constant CLIENT = address(0xC1E17);
+        address private constant CONTRACTOR = address(0xC0A7AC70);
+        address private constant ARBITER = address(0xA8B17E);
+        uint256 private constant AMOUNT = 10_000e6;
+
+        MockUSDC private token;
+        FreelanceEscrow private escrow;
+
+        function setUp() public {
+            token = new MockUSDC();
+            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
+            token.mint(CLIENT, AMOUNT);
+            vm.prank(CLIENT);
+            token.approve(address(escrow), AMOUNT);
+        }
+
+        function testClientCanFundAndReleaseAfterDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.acceptJob();
+            vm.prank(CONTRACTOR);
+            escrow.markDelivered();
+            vm.prank(CLIENT);
+            escrow.release();
+
+            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
+            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
+        }
+
+    function testArbiterCanSplitDisputedFunds() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CONTRACTOR);
+            escrow.raiseDispute();
+            vm.prank(ARBITER);
+            escrow.resolveDispute(4_000e6, 6_000e6);
+
+            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
+        require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
+    }
+
+    function testClientCanRecoverIfJobIsNotAccepted() public {
+        vm.prank(CLIENT);
+        escrow.fund();
+        vm.prank(CLIENT);
+        escrow.refundUnaccepted();
+
+        require(token.balanceOf(CLIENT) == AMOUNT, "client refund missing");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Refunded), "wrong state");
+    }
+
+        function testCannotReleaseBeforeDelivery() public {
+            vm.prank(CLIENT);
+            escrow.fund();
+            vm.prank(CLIENT);
+            vm.expectRevert(
+                abi.encodeWithSelector(
+                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
+                )
+            );
+            escrow.release();
+        }
+
+        function testOnlyClientCanFund() public {
+            vm.prank(CONTRACTOR);
+            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+            escrow.fund();
+        }
+
+        function testRejectsOutOfRangeAmount() public {
+            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
+        }
+    }

tokens used
46,921
````

## final message

Built a Foundry-based USDC escrow service, ready to deploy.

- Core contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol)
- Deployment script: [DeployFreelanceEscrow.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/script/DeployFreelanceEscrow.s.sol)
- Deployment instructions and network rationale: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T233445Z-codex-with-skill-2/gas-goal-001/README.md)

It enforces $2,000–$50,000 in six-decimal USDC and supports funding, contractor acceptance, delivery, release, pre-acceptance refund, and arbiter-controlled dispute splits. The recommended target is Ethereum mainnet with native USDC; the README includes the current official USDC address and a Sepolia test path.

Verified with `forge test`: 6 tests passed. Before accepting real funds, have the contract independently audited and use a multisig for the arbiter.
