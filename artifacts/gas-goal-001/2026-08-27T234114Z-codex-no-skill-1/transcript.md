# Executor transcript — 2026-08-27T234114Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04599-65b6-7f50-a5e6-b123184771d3
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-27T23:41:16.297489Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a04599-65b6-7f50-a5e6-b123184771d3.tmp-1787874076093616433: line 2547: syntax error near unexpected token `('

codex
I’ll build this as a single-job, stablecoin-denominated escrow with explicit release/refund/dispute paths, deployment scripts, tests, and a concise deployment guide. I’ll target a low-cost EVM network and keep the funds logic deliberately small and auditable.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200 && find . -maxdepth 2 -name AGENTS.md -print" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001
 succeeded in 11ms:
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && sed -n '1,240p' package.json && find . -name AGENTS.md -print" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001
 succeeded in 1ms:
exec
/bin/bash -lc 'command -v forge || true
command -v solc || true
command -v npm || true
node --version || true' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001
 succeeded in 3ms:
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/.env.example
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/.gitignore
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/script/deploy.sh
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/src/EscrowFactory.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/src/interfaces/IERC20.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/test/FreelanceEscrow.t.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/test/mocks/MockUSDC.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1cf8a3a8194126b6f933d5627fd239786b8c140f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1cf8a3a8194126b6f933d5627fd239786b8c140f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

codex
The project scaffold is in place: it locks to six-decimal USDC, enforces the $2k–$50k range, and uses an independent arbiter for dispute splits. I’m compiling and exercising the core release, refund, and arbitration paths now.
exec
/bin/bash -lc 'chmod +x script/deploy.sh && forge test -vvv && forge fmt --check && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001
 exited 1 in 266ms:
Compiling 5 files with Solc 0.8.28
Solc 0.8.28 finished in 203.45ms
Compiler run successful!

Ran 4 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitFunds() (gas: 101854)
[PASS] testCannotCreateEscrowOutsideAllowedRange() (gas: 65458)
[PASS] testClientCanFundThenReleaseDeliveredWork() (gas: 102034)
[PASS] testClientCanRefundOnlyAfterDeadline() (gas: 84744)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 1.06ms (1.60ms CPU time)

Ran 1 test suite in 8.35ms (1.06ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
Diff in src/EscrowFactory.sol:
18  18   |     );
19  19   | 
20  20   |     constructor(IERC20 usdc_, address arbiter_) {
21       |-        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
    21   |+        if (address(usdc_) == address(0) || arbiter_ == address(0)) {
    22   |+            revert FreelanceEscrow.InvalidAddress();
    23   |+        }
22  24   |         if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
23  25   |         usdc = usdc_;
24  26   |         arbiter = arbiter_;

Diff in src/FreelanceEscrow.sol:
32  32   |     event WorkDelivered(address indexed freelancer, string deliveryReference);
33  33   |     event Released(address indexed freelancer, uint256 amount);
34  34   |     event Refunded(address indexed client, uint256 amount);
35       |-    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
    35   |+    event DisputeResolved(
    36   |+        uint256 clientAmount, uint256 freelancerAmount, string resolutionReference
    37   |+    );
36  38   |     event Cancelled(address indexed client);
37  39   | 
38  40   |     IERC20 public immutable usdc;
--------------------------------------------------------------------------------160 162  |     }
161 163  | 
162 164  |     function _safeTransfer(address recipient, uint256 payoutAmount) private {
163      |-        (bool ok, bytes memory data) = address(usdc).call(
164      |-            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
165      |-        );
    165  |+        (bool ok, bytes memory data) =
    166  |+            address(usdc).call(abi.encodeCall(IERC20.transfer, (recipient, payoutAmount)));
166 167  |         if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
167 168  |     }
168 169  | 
169 170  |     function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
170      |-        (bool ok, bytes memory data) = address(usdc).call(
171      |-            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
172      |-        );
    171  |+        (bool ok, bytes memory data) = address(usdc)
    172  |+            .call(abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount)));
173 173  |         if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
174 174  |     }
175 175  | 

Diff in test/mocks/MockUSDC.sol:
10  10   |     mapping(address => uint256) public override balanceOf;
11  11   |     mapping(address => mapping(address => uint256)) public allowance;
12  12   | 
13       |-    function mint(address to, uint256 value) external { balanceOf[to] += value; }
14       |-    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
15       |-    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
    13   |+    function mint(address to, uint256 value) external {
    14   |+        balanceOf[to] += value;
    15   |+    }
    16   |+
    17   |+    function approve(address spender, uint256 value) external returns (bool) {
    18   |+        allowance[msg.sender][spender] = value;
    19   |+        return true;
    20   |+    }
    21   |+
    22   |+    function transfer(address to, uint256 value) external returns (bool) {
    23   |+        return _transfer(msg.sender, to, value);
    24   |+    }
    25   |+
16  26   |     function transferFrom(address from, address to, uint256 value) external returns (bool) {
17  27   |         uint256 approved = allowance[from][msg.sender];
18  28   |         require(approved >= value, "allowance");
19  29   |         allowance[from][msg.sender] = approved - value;
20  30   |         return _transfer(from, to, value);
21  31   |     }
    32   |+
22  33   |     function _transfer(address from, address to, uint256 value) private returns (bool) {
23  34   |         require(balanceOf[from] >= value, "balance");
24       |-        balanceOf[from] -= value; balanceOf[to] += value; return true;
    35   |+        balanceOf[from] -= value;
    36   |+        balanceOf[to] += value;
    37   |+        return true;
25  38   |     }
26  39   | }

Diff in test/FreelanceEscrow.t.sol:
4   4    | import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
5   5    | import {MockUSDC} from "./mocks/MockUSDC.sol";
6   6    | 
7        |-interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
    7    |+interface Vm {
    8    |+    function prank(address) external;
    9    |+    function warp(uint256) external;
    10   |+    function expectRevert(bytes4) external;
    11   |+}
8   12   | 
9   13   | contract FreelanceEscrowTest {
10  14   |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
--------------------------------------------------------------------------------18  22   | 
19  23   |     function setUp() public {
20  24   |         token = new MockUSDC();
21       |-        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
    25   |+        escrow = new FreelanceEscrow(
    26   |+            token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days
    27   |+        );
22  28   |         token.mint(CLIENT, AMOUNT);
23  29   |     }
24  30   | 
25  31   |     function testClientCanFundThenReleaseDeliveredWork() public {
26       |-        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
27       |-        vm.prank(CLIENT); escrow.fund();
28       |-        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
29       |-        vm.prank(CLIENT); escrow.release();
    32   |+        vm.prank(CLIENT);
    33   |+        token.approve(address(escrow), AMOUNT);
    34   |+        vm.prank(CLIENT);
    35   |+        escrow.fund();
    36   |+        vm.prank(FREELANCER);
    37   |+        escrow.markDelivered("ipfs://delivery");
    38   |+        vm.prank(CLIENT);
    39   |+        escrow.release();
30  40   |         require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
31  41   |         require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
32  42   |     }
33  43   | 
34  44   |     function testArbiterCanSplitFunds() public {
35       |-        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
36       |-        vm.prank(CLIENT); escrow.fund();
37       |-        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
    45   |+        vm.prank(CLIENT);
    46   |+        token.approve(address(escrow), AMOUNT);
    47   |+        vm.prank(CLIENT);
    48   |+        escrow.fund();
    49   |+        vm.prank(ARBITER);
    50   |+        escrow.resolveDispute(4_000_000_000, "case-42");
38  51   |         require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
39  52   |         require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
40  53   |     }
41  54   | 
42  55   |     function testClientCanRefundOnlyAfterDeadline() public {
43       |-        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
44       |-        vm.prank(CLIENT); escrow.fund();
45       |-        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
    56   |+        vm.prank(CLIENT);
    57   |+        token.approve(address(escrow), AMOUNT);
    58   |+        vm.prank(CLIENT);
    59   |+        escrow.fund();
    60   |+        vm.prank(CLIENT);
    61   |+        vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector);
    62   |+        escrow.refundAfterDeadline();
46  63   |         vm.warp(block.timestamp + 30 days);
47       |-        vm.prank(CLIENT); escrow.refundAfterDeadline();
    64   |+        vm.prank(CLIENT);
    65   |+        escrow.refundAfterDeadline();
48  66   |         require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
49  67   |     }
50  68   | 
51  69   |     function testCannotCreateEscrowOutsideAllowedRange() public {
52  70   |         vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
53       |-        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
    71   |+        new FreelanceEscrow(
    72   |+            token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days
    73   |+        );
54  74   |     }
55  75   | }

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1cf8a3a8194126b6f933d5627fd239786b8c140f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge test -vvv && git diff --check && git status --short && git diff --stat' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001
 succeeded in 257ms:
Compiling 4 files with Solc 0.8.28
Solc 0.8.28 finished in 192.20ms
Compiler run successful!

Ran 4 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitFunds() (gas: 101854)
[PASS] testCannotCreateEscrowOutsideAllowedRange() (gas: 65458)
[PASS] testClientCanFundThenReleaseDeliveredWork() (gas: 102034)
[PASS] testClientCanRefundOnlyAfterDeadline() (gas: 84744)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 693.28µs (814.87µs CPU time)

Ran 1 test suite in 8.13ms (693.28µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
?? .env.example
?? .gitignore
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1cf8a3a8194126b6f933d5627fd239786b8c140f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

codex
All local tests pass. I’m doing a final deployment-readiness check, including the network recommendation and script inputs, so the README doesn’t hardcode a token address that could be wrong for the selected network.
web search: 
web search: https://docs.base.org/chain/using-base
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1cf8a3a8194126b6f933d5627fd239786b8c140f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

web search: 
web search: https://docs.base.org/chain/using-base
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..1cf8a3a8194126b6f933d5627fd239786b8c140f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/README.md
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a8041db9148aac56af435619783e000bcd0df4a4
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`. The public Base RPC is fine for a test deployment; use a managed RPC provider in production because Base documents its public endpoints as rate-limited.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a8041db9148aac56af435619783e000bcd0df4a4
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`. The public Base RPC is fine for a test deployment; use a managed RPC provider in production because Base documents its public endpoints as rate-limited.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge test -vvv && git diff --check && find . -maxdepth 3 -type f | sort' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001
 succeeded in 78ms:
No files changed, compilation skipped

Ran 4 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testArbiterCanSplitFunds() (gas: 101854)
[PASS] testCannotCreateEscrowOutsideAllowedRange() (gas: 65458)
[PASS] testClientCanFundThenReleaseDeliveredWork() (gas: 102034)
[PASS] testClientCanRefundOnlyAfterDeadline() (gas: 84744)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 673.50µs (763.97µs CPU time)

Ran 1 test suite in 8.09ms (673.50µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
./.env.example
./.git/COMMIT_EDITMSG
./.git/HEAD
./.git/config
./.git/description
./.git/hooks/applypatch-msg.sample
./.git/hooks/commit-msg.sample
./.git/hooks/fsmonitor-watchman.sample
./.git/hooks/post-update.sample
./.git/hooks/pre-applypatch.sample
./.git/hooks/pre-commit.sample
./.git/hooks/pre-merge-commit.sample
./.git/hooks/pre-push.sample
./.git/hooks/pre-rebase.sample
./.git/hooks/pre-receive.sample
./.git/hooks/prepare-commit-msg.sample
./.git/hooks/push-to-checkout.sample
./.git/hooks/sendemail-validate.sample
./.git/hooks/update.sample
./.git/index
./.git/info/exclude
./.git/logs/HEAD
./.gitignore
./README.md
./TASK.md
./cache/solidity-files-cache.json
./foundry.toml
./out/EscrowFactory.sol/EscrowFactory.json
./out/FreelanceEscrow.sol/FreelanceEscrow.json
./out/FreelanceEscrow.t.sol/FreelanceEscrowTest.json
./out/FreelanceEscrow.t.sol/Vm.json
./out/IERC20.sol/IERC20.json
./out/MockUSDC.sol/MockUSDC.json
./out/build-info/3a0d7a23977c6f2c.json
./out/build-info/6af3c8ea1734f7f4.json
./package.json
./script/deploy.sh
./src/EscrowFactory.sol
./src/FreelanceEscrow.sol
./src/interfaces/IERC20.sol
./test/FreelanceEscrow.t.sol
./test/mocks/MockUSDC.sol

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a8041db9148aac56af435619783e000bcd0df4a4
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`. The public Base RPC is fine for a test deployment; use a managed RPC provider in production because Base documents its public endpoints as rate-limited.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

codex
Built a Foundry-based USDC freelance escrow, ready to test and deploy.

- Core contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/src/FreelanceEscrow.sol)
- Per-job factory: [EscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/src/EscrowFactory.sol)
- Deployment script/config: [deploy.sh](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/script/deploy.sh), [.env.example](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/.env.example)
- Deployment guidance: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/README.md)

It enforces $2,000–$50,000 USDC jobs, exact funding, delivery confirmation, client release, deadline-based refund, and arbiter-controlled dispute splits.

Verified with `forge test`: 4 passing tests covering release, refund timing, arbitration, and amount bounds.

Recommendation: test on Base Sepolia, then deploy production to Base mainnet for EVM compatibility and lower transaction fees. Base’s official docs list both networks and caution that public RPC endpoints are rate-limited, so use a managed RPC provider in production. [Base network docs](https://docs.base.org/base-chain/quickstart/connecting-to-base)
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..17e1cd300f7006f99168e4e9cf82d8e97bd69498
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+# RPC endpoint for Base Sepolia while testing, then Base mainnet for production.
+RPC_URL=https://sepolia.base.org
+# Private key for the account deploying the factory. Never commit a real value.
+PRIVATE_KEY=
+# Official USDC address for the network selected by RPC_URL. Verify it with Circle
+# before mainnet deployment.
+USDC_ADDRESS=
+# An independent, trusted dispute-resolution wallet or multisig.
+ARBITER_ADDRESS=
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..75623fc07233d37908d7f5927d740a6b759551a0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+.env
+out/
+cache/
+broadcast/
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a8041db9148aac56af435619783e000bcd0df4a4
--- /dev/null
+++ b/README.md
@@ -0,0 +1,27 @@
+# Freelance USDC Escrow
+
+This is a fixed-price, one-job-per-contract escrow for **$2,000–$50,000 USDC**. A client creates a job through `EscrowFactory`, approves USDC, and funds it. The freelancer marks delivery; the client releases payment. If there is a dispute, an independent arbiter can split the balance. After the agreed deadline, the client may refund the job if it remains unresolved.
+
+## Why Base
+
+Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees and native, widely supported USDC. Start on **Base Sepolia** to test the full workflow with test tokens first. Before any mainnet deployment, confirm the USDC contract address from [Circle's official USDC network list](https://www.circle.com/multi-chain-usdc) and use a separate, trusted multisig as the arbiter.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env` and fill in `RPC_URL`, `PRIVATE_KEY`, the official six-decimal USDC address, and `ARBITER_ADDRESS`. The public Base RPC is fine for a test deployment; use a managed RPC provider in production because Base documents its public endpoints as rate-limited.
+3. Load it and deploy the factory:
+
+   ```bash
+   set -a; source .env; set +a
+   chmod +x script/deploy.sh
+   script/deploy.sh
+   ```
+
+The command prints the factory address. Each client calls `createEscrow(freelancer, amount, refundDeadline)` on that factory. Amounts use USDC's six decimals: for example, `10000000000` is 10,000 USDC. The client then approves that new escrow for the exact amount and calls `fund()`.
+
+## Important operating notes
+
+- The arbiter has powerful authority to decide the split; use an independent multisig with documented procedures, not an individual wallet.
+- Contract metadata only stores delivery/dispute references. Keep sensitive work and personal data off-chain.
+- This code is tested locally, but it is not a substitute for a professional security audit, legal review, sanctions/KYC controls, and production monitoring before real funds are held.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..025221e8f3a4b7e285fe858de9f41bb143490e87
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,13 @@
+[profile.default]
+src = "src"
+test = "test"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 10_000
+evm_version = "cancun"
+
+[fmt]
+line_length = 100
+
diff --git a/script/deploy.sh b/script/deploy.sh
new file mode 100644
index 0000000000000000000000000000000000000000..cfd66fda2163461d5bf62a1766f13e018f9b09f7
--- /dev/null
+++ b/script/deploy.sh
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+: "${RPC_URL:?Set RPC_URL in .env}"
+: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
+: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
+: "${ARBITER_ADDRESS:?Set ARBITER_ADDRESS in .env}"
+
+forge create src/EscrowFactory.sol:EscrowFactory \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS" "$ARBITER_ADDRESS"
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7107bf530cfc11a2bd1e39e5f2430bcfccadb489
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
+contract EscrowFactory {
+    IERC20 public immutable usdc;
+    address public immutable arbiter;
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        uint256 amount,
+        uint256 refundDeadline
+    );
+
+    constructor(IERC20 usdc_, address arbiter_) {
+        if (address(usdc_) == address(0) || arbiter_ == address(0)) revert FreelanceEscrow.InvalidAddress();
+        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
+        usdc = usdc_;
+        arbiter = arbiter_;
+    }
+
+    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
+        external
+        returns (FreelanceEscrow escrow)
+    {
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
+    }
+}
+
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d0af1fb1127d950e745a4330adedf0cd3e08c491
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,180 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @notice Holds one fixed-price USDC freelance job until release, refund, or arbitration.
+/// @dev USDC must use six decimals. The arbiter should be an independent multisig in production.
+contract FreelanceEscrow {
+    uint256 public constant MIN_AMOUNT = 2_000_000_000; // 2,000 USDC (6 decimals)
+    uint256 public constant MAX_AMOUNT = 50_000_000_000; // 50,000 USDC (6 decimals)
+
+    enum Status {
+        AwaitingFunding,
+        Funded,
+        Delivered,
+        Resolved,
+        Cancelled
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error DeadlineNotReached();
+    error InvalidResolution();
+    error Reentrancy();
+    error TokenTransferFailed();
+    error UnsupportedToken();
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, string deliveryReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event DisputeResolved(uint256 clientAmount, uint256 freelancerAmount, string resolutionReference);
+    event Cancelled(address indexed client);
+
+    IERC20 public immutable usdc;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbiter;
+    uint256 public immutable amount;
+    uint256 public immutable refundDeadline;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyFreelancer() {
+        if (msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyArbiter() {
+        if (msg.sender != arbiter) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 usdc_,
+        address client_,
+        address freelancer_,
+        address arbiter_,
+        uint256 amount_,
+        uint256 refundDeadline_
+    ) {
+        if (
+            address(usdc_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbiter_ == address(0) || client_ == freelancer_ || client_ == arbiter_
+                || freelancer_ == arbiter_
+        ) revert InvalidAddress();
+        if (usdc_.decimals() != 6) revert UnsupportedToken();
+        if (amount_ < MIN_AMOUNT || amount_ > MAX_AMOUNT) revert InvalidAmount();
+        if (refundDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        usdc = usdc_;
+        client = client_;
+        freelancer = freelancer_;
+        arbiter = arbiter_;
+        amount = amount_;
+        refundDeadline = refundDeadline_;
+        status = Status.AwaitingFunding;
+    }
+
+    /// @notice Pull the exact agreed USDC amount after this contract is approved by the client.
+    function fund() external onlyClient nonReentrant {
+        _requireStatus(Status.AwaitingFunding);
+        uint256 beforeBalance = usdc.balanceOf(address(this));
+        _safeTransferFrom(client, address(this), amount);
+        if (usdc.balanceOf(address(this)) != beforeBalance + amount) revert TokenTransferFailed();
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    function markDelivered(string calldata deliveryReference) external onlyFreelancer {
+        _requireStatus(Status.Funded);
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliveryReference);
+    }
+
+    /// @notice Client accepts the delivered work and releases the entire balance.
+    function release() external onlyClient nonReentrant {
+        _requireStatus(Status.Delivered);
+        status = Status.Resolved;
+        _payout(freelancer, amount);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Client can recover funds after the agreed deadline if no arbiter has resolved it.
+    function refundAfterDeadline() external onlyClient nonReentrant {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (block.timestamp < refundDeadline) revert DeadlineNotReached();
+        status = Status.Resolved;
+        _payout(client, amount);
+        emit Refunded(client, amount);
+    }
+
+    /// @notice The independent arbiter can split the locked funds after reviewing a dispute.
+    function resolveDispute(uint256 clientAmount, string calldata resolutionReference)
+        external
+        onlyArbiter
+        nonReentrant
+    {
+        Status current = status;
+        if (current != Status.Funded && current != Status.Delivered) {
+            revert InvalidStatus(Status.Funded, current);
+        }
+        if (clientAmount > amount) revert InvalidResolution();
+
+        uint256 freelancerAmount = amount - clientAmount;
+        status = Status.Resolved;
+        if (clientAmount != 0) _payout(client, clientAmount);
+        if (freelancerAmount != 0) _payout(freelancer, freelancerAmount);
+        emit DisputeResolved(clientAmount, freelancerAmount, resolutionReference);
+    }
+
+    /// @notice Cancels an unfunded job. No party can change its terms after creation.
+    function cancelUnfunded() external onlyClient {
+        _requireStatus(Status.AwaitingFunding);
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _payout(address recipient, uint256 payoutAmount) private {
+        _safeTransfer(recipient, payoutAmount);
+    }
+
+    function _safeTransfer(address recipient, uint256 payoutAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transfer, (recipient, payoutAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _safeTransferFrom(address sender, address recipient, uint256 transferAmount) private {
+        (bool ok, bytes memory data) = address(usdc).call(
+            abi.encodeCall(IERC20.transferFrom, (sender, recipient, transferAmount))
+        );
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _requireStatus(Status expected) private view {
+        if (status != expected) revert InvalidStatus(expected, status);
+    }
+}
+
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e9b4d8ab61ecaaae5608e867f4dc86b05ecc45e5
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function decimals() external view returns (uint8);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7f664bfa5f81045f40b7f510536e229552c1a381
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./mocks/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }
+
+contract FreelanceEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant CLIENT = address(0xC1E17);
+    address private constant FREELANCER = address(0xFEE1);
+    address private constant ARBITER = address(0xA8B17E2);
+    uint256 private constant AMOUNT = 10_000_000_000;
+
+    MockUSDC private token;
+    FreelanceEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days);
+        token.mint(CLIENT, AMOUNT);
+    }
+
+    function testClientCanFundThenReleaseDeliveredWork() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(FREELANCER); escrow.markDelivered("ipfs://delivery");
+        vm.prank(CLIENT); escrow.release();
+        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
+        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
+    }
+
+    function testArbiterCanSplitFunds() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(ARBITER); escrow.resolveDispute(4_000_000_000, "case-42");
+        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
+        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
+    }
+
+    function testClientCanRefundOnlyAfterDeadline() public {
+        vm.prank(CLIENT); token.approve(address(escrow), AMOUNT);
+        vm.prank(CLIENT); escrow.fund();
+        vm.prank(CLIENT); vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector); escrow.refundAfterDeadline();
+        vm.warp(block.timestamp + 30 days);
+        vm.prank(CLIENT); escrow.refundAfterDeadline();
+        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
+    }
+
+    function testCannotCreateEscrowOutsideAllowedRange() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days);
+    }
+}
diff --git a/test/mocks/MockUSDC.sol b/test/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fdbd5fc7f40d8593ae6c192694cbe0990bffdef5
--- /dev/null
+++ b/test/mocks/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {IERC20} from "../../src/interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
+    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        require(approved >= value, "allowance");
+        allowance[from][msg.sender] = approved - value;
+        return _transfer(from, to, value);
+    }
+    function _transfer(address from, address to, uint256 value) private returns (bool) {
+        require(balanceOf[from] >= value, "balance");
+        balanceOf[from] -= value; balanceOf[to] += value; return true;
+    }
+}

tokens used
28,706
````

## final message

Built a Foundry-based USDC freelance escrow, ready to test and deploy.

- Core contract: [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/src/FreelanceEscrow.sol)
- Per-job factory: [EscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/src/EscrowFactory.sol)
- Deployment script/config: [deploy.sh](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/script/deploy.sh), [.env.example](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/.env.example)
- Deployment guidance: [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234114Z-codex-no-skill-1/gas-goal-001/README.md)

It enforces $2,000–$50,000 USDC jobs, exact funding, delivery confirmation, client release, deadline-based refund, and arbiter-controlled dispute splits.

Verified with `forge test`: 4 passing tests covering release, refund timing, arbitration, and amount bounds.

Recommendation: test on Base Sepolia, then deploy production to Base mainnet for EVM compatibility and lower transaction fees. Base’s official docs list both networks and caution that public RPC endpoints are rate-limited, so use a managed RPC provider in production. [Base network docs](https://docs.base.org/base-chain/quickstart/connecting-to-base)
