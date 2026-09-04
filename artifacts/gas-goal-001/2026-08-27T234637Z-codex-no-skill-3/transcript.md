# Executor transcript — 2026-08-27T234637Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0459e-5353-7612-bbcd-5064eadcefda
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-27T23:46:39.276846Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a0459e-5353-7612-bbcd-5064eadcefda.tmp-1787874399066729052: line 2547: syntax error near unexpected token `('

codex
I’ll build a deployable, test-covered escrow contract with explicit payer/payee acceptance and a bounded, owner-mediated dispute path. I’ll first inspect the workspace so the tooling fits what’s already here.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001
 succeeded in 3ms:
exec
/bin/bash -lc "sed -n '1,240p' TASK.md && sed -n '1,240p' package.json && find . -maxdepth 2 -type f -not -path './.git/*' -print" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.
{
  "name": "eval-workspace",
  "private": true
}
./package.json
./TASK.md

exec
/bin/bash -lc 'command -v forge || true; command -v solc || true; command -v npx || true; node --version; npm --version; git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001
 succeeded in 300ms:
10.9.7

codex
I’m using Foundry and a USDC-style ERC-20 amount model rather than native ETH, since dollar-denominated escrow needs a stable settlement asset. The contract will enforce the $2,000–$50,000 range in the token’s smallest units and reject fee-on-transfer deposits.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/package.json
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/EscrowFactory.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/interfaces/IERC20.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/.env.example
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/.gitignore
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/README.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/script/Deploy.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/test/Escrow.t.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/test/MockUSDC.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b2a52cf22251f7fe28acfec790029cfe02bc8216
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,103 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(FreelanceEscrow.InvalidState.selector);
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(FreelanceEscrow.InvalidState.selector);
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b2a52cf22251f7fe28acfec790029cfe02bc8216
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,103 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(FreelanceEscrow.InvalidState.selector);
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(FreelanceEscrow.InvalidState.selector);
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

exec
/bin/bash -lc 'forge test && forge build && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001
 exited 1 in 263ms:
Compiling 5 files with Solc 0.8.24
Solc 0.8.24 finished in 219.82ms
Compiler run successful!

Ran 6 tests for test/Escrow.t.sol:EscrowTest
[PASS] testArbitratorCanSplitDisputedEscrow() (gas: 808374)
[FAIL: Error != expected error: InvalidState(0, 1) != custom error 0x77e5c5f2] testClientCanRefundBeforeDeliveryButNotAfter() (gas: 1574118)
[FAIL: Error != expected error: InvalidState(1, 0) != custom error 0x77e5c5f2] testClientReleasesOnlyAfterDelivery() (gas: 791642)
[PASS] testCreatesAndFundsEscrow() (gas: 770416)
[PASS] testNonClientCannotRelease() (gas: 795061)
[PASS] testOutOfRangeEscrowCannotBeCreated() (gas: 47370)
Suite result: FAILED. 4 passed; 2 failed; 0 skipped; finished in 844.51µs (1.79ms CPU time)

Ran 1 test suite in 7.54ms (844.51µs CPU time): 4 tests passed, 2 failed, 0 skipped (6 total tests)

Failing tests:
Encountered 2 failing tests in test/Escrow.t.sol:EscrowTest
[FAIL: Error != expected error: InvalidState(0, 1) != custom error 0x77e5c5f2] testClientCanRefundBeforeDeliveryButNotAfter() (gas: 1574118)
[FAIL: Error != expected error: InvalidState(1, 0) != custom error 0x77e5c5f2] testClientReleasesOnlyAfterDelivery() (gas: 791642)

Encountered a total of 2 failing tests, 4 tests succeeded

Tip: Run `forge test --rerun` to retry only the 2 failed tests

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b2a52cf22251f7fe28acfec790029cfe02bc8216
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,103 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(FreelanceEscrow.InvalidState.selector);
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(FreelanceEscrow.InvalidState.selector);
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

codex
The first test pass exposed a test-harness detail: the state error includes its expected and actual enum values, so I’m tightening those assertions to check the complete revert payload rather than just the error selector.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/test/Escrow.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9d652a7a2497d44040e0d8838e88504340ecd26a
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,116 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+    function expectRevert(bytes calldata revertData) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Delivered,
+                FreelanceEscrow.Status.Funded
+            )
+        );
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Funded,
+                FreelanceEscrow.Status.Delivered
+            )
+        );
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9d652a7a2497d44040e0d8838e88504340ecd26a
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,116 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+    function expectRevert(bytes calldata revertData) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Delivered,
+                FreelanceEscrow.Status.Funded
+            )
+        );
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Funded,
+                FreelanceEscrow.Status.Delivered
+            )
+        );
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

exec
/bin/bash -lc 'forge test && forge build && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001
 succeeded in 451ms:
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 233.10ms
Compiler run successful!

Ran 6 tests for test/Escrow.t.sol:EscrowTest
[PASS] testArbitratorCanSplitDisputedEscrow() (gas: 808374)
[PASS] testClientCanRefundBeforeDeliveryButNotAfter() (gas: 1552125)
[PASS] testClientReleasesOnlyAfterDelivery() (gas: 825410)
[PASS] testCreatesAndFundsEscrow() (gas: 770416)
[PASS] testNonClientCannotRelease() (gas: 795061)
[PASS] testOutOfRangeEscrowCannotBeCreated() (gas: 47370)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 1.01ms (1.72ms CPU time)

Ran 1 test suite in 10.14ms (1.01ms CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 114.02ms
Compiler run successful!
note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> script/Deploy.s.sol:13:25
   |
13 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-const]: constants should use SCREAMING_SNAKE_CASE
  --> test/Escrow.t.sol:15:25
   |
15 |     Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
   |                         ^^ help: consider using: `VM`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-const

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:28:29
   |
28 |     IERC20 public immutable token;
   |                             ^^^^^ help: consider using: `TOKEN`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> test/Escrow.t.sol:32:93
   |
32 |         FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
   |                                                                                             ^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'bytes32' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> test/Escrow.t.sol:35:40
   |
35 |         _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
   |                                        ^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'bytes32' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> test/Escrow.t.sol:62:32
   |
62 |         escrow = _createWithId(bytes32("job-2"));
   |                                ^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'bytes32' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> test/Escrow.t.sol:89:69
   |
89 |         factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
   |                                                                     ^^^^^^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'bytes32' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

warning[unsafe-typecast]: typecasts that can truncate values should be checked
   --> test/Escrow.t.sol:102:30
    |
102 |         return _createWithId(bytes32("job-1"));
    |                              ^^^^^^^^^^^^^^^^
    |
    = note: consider disabling this lint if you're certain the cast is safe
            
            // casting to 'bytes32' is safe because [explain why]
            // forge-lint: disable-next-line(unsafe-typecast)
            
            
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:29:30
   |
29 |     address public immutable client;
   |                              ^^^^^^ help: consider using: `CLIENT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:30:30
   |
30 |     address public immutable freelancer;
   |                              ^^^^^^^^^^ help: consider using: `FREELANCER`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:31:30
   |
31 |     address public immutable arbitrator;
   |                              ^^^^^^^^^^ help: consider using: `ARBITRATOR`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:32:30
   |
32 |     uint256 public immutable amount;
   |                              ^^^^^^ help: consider using: `AMOUNT`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
  --> src/FreelanceEscrow.sol:33:30
   |
33 |     bytes32 public immutable jobId;
   |                              ^^^^^ help: consider using: `JOB_ID`
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:45:5
   |
45 | /     modifier onlyClient() {
46 | |         if (msg.sender != client) revert Unauthorized();
47 | |         _;
48 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
45 ~     modifier onlyClient() {
46 +         _onlyClient();
47 +         _;
48 +     }
49 + 
50 +     function _onlyClient() internal {
51 +         if (msg.sender != client) revert Unauthorized();
52 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:50:5
   |
50 | /     modifier onlyParty() {
51 | |         if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
52 | |         _;
53 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
50 ~     modifier onlyParty() {
51 +         _onlyParty();
52 +         _;
53 +     }
54 + 
55 +     function _onlyParty() internal {
56 +         if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
57 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/FreelanceEscrow.sol:55:5
   |
55 | /     modifier nonReentrant() {
56 | |         if (locked) revert Reentrancy();
57 | |         locked = true;
58 | |         _;
59 | |         locked = false;
60 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
55 ~     modifier nonReentrant() {
56 +         _nonReentrantBefore();
57 +         _;
58 +         _nonReentrantAfter();
59 +     }
60 + 
61 +     function _nonReentrantBefore() internal {
62 +         if (locked) revert Reentrancy();
63 +         locked = true;
64 +     }
65 + 
66 +     function _nonReentrantAfter() internal {
67 +         locked = false;
68 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

 M package.json
?? .env.example
?? .gitignore
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9d652a7a2497d44040e0d8838e88504340ecd26a
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,116 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+    function expectRevert(bytes calldata revertData) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Delivered,
+                FreelanceEscrow.Status.Funded
+            )
+        );
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Funded,
+                FreelanceEscrow.Status.Delivered
+            )
+        );
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

exec
/bin/bash -lc 'forge fmt --check || forge fmt && forge test && git diff --check && git diff --stat' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001
 succeeded in 306ms:
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/EscrowFactory.sol
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/FreelanceEscrow.sol
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/test/Escrow.t.sol
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 240.56ms
Compiler run successful!

Ran 6 tests for test/Escrow.t.sol:EscrowTest
[PASS] testArbitratorCanSplitDisputedEscrow() (gas: 808374)
[PASS] testClientCanRefundBeforeDeliveryButNotAfter() (gas: 1552125)
[PASS] testClientReleasesOnlyAfterDelivery() (gas: 825410)
[PASS] testCreatesAndFundsEscrow() (gas: 770416)
[PASS] testNonClientCannotRelease() (gas: 795061)
[PASS] testOutOfRangeEscrowCannotBeCreated() (gas: 47370)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 854.76µs (1.53ms CPU time)

Ran 1 test suite in 7.61ms (854.76µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
 package.json | 8 +++++++-
 1 file changed, 7 insertions(+), 1 deletion(-)

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9d652a7a2497d44040e0d8838e88504340ecd26a
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,116 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+    function expectRevert(bytes calldata revertData) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Delivered,
+                FreelanceEscrow.Status.Funded
+            )
+        );
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Funded,
+                FreelanceEscrow.Status.Delivered
+            )
+        );
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

codex
Built a Foundry-based USDC escrow service.

- Contracts: [EscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/EscrowFactory.sol) and [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/FreelanceEscrow.sol)
- Enforces $2,000–$50,000 (6-decimal USDC), atomic funding, delivery/release flow, pre-delivery refunds, and arbitrated disputes with exact splits.
- Added deployment script, environment template, and tests.
- Deployment guidance and Base Sepolia/Base mainnet rationale are in [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/README.md).

Verified: `forge test` passes all 6 tests.

Before holding real funds, get an independent security audit and finalize the arbitrator/governance process.
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..81d9a827f2eb58d0aa0bad9a7e9710abf6a80bb0
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+# Never commit your real key. Use a dedicated deployer wallet with a small native-token balance.
+PRIVATE_KEY=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..de0c692d630d30335699698d6d7de4d9866c16f5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+.env
+out/
+cache/
+broadcast/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f74da268ced3b85cc21a890196d589a11fd3ff3c
--- /dev/null
+++ b/README.md
@@ -0,0 +1,38 @@
+# Freelance escrow
+
+This is a Foundry project for USDC-denominated freelance-payment escrow. `EscrowFactory` creates one isolated `FreelanceEscrow` per job and atomically pulls the approved amount from the client.
+
+The escrow is deliberately simple:
+
+- Only an exact amount from **$2,000 to $50,000** is accepted, assuming a 6-decimal USDC token.
+- The freelancer marks work delivered; only the client can release payment after that.
+- The client can cancel before delivery. Either party can open a dispute, and the pre-agreed arbitrator can split the amount exactly.
+- The contract rejects deposits that arrive short (for example fee-on-transfer tokens). Use official USDC only.
+
+## Recommended network
+
+Deploy first to **Base Sepolia**. It is an inexpensive EVM testnet with a close operational match to Base mainnet. For production, use **Base mainnet** with official USDC: low fees make per-job contracts practical, while USDC keeps the contract amount dollar-denominated. Do not deploy on mainnet until an independent smart-contract security audit, operational review of arbitrator governance, and end-to-end testnet acceptance are complete.
+
+## Deploy
+
+1. Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then run `forge test`.
+2. Copy `.env.example` to `.env`, set a dedicated deployer `PRIVATE_KEY` and Base Sepolia RPC URL, then load it with `source .env`.
+3. Deploy and verify:
+
+   ```sh
+   forge script script/Deploy.s.sol:Deploy \
+     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+     --private-key "$PRIVATE_KEY" \
+     --broadcast --verify --etherscan-api-key "$BASESCAN_API_KEY"
+   ```
+
+4. Record the emitted factory address. For each job, the client approves that factory to spend the exact 6-decimal USDC amount, then calls `createEscrow(token, freelancer, arbitrator, amount, jobId)`. `jobId` must be unique (for example, a keccak256 hash of your off-chain job UUID).
+
+## Commands
+
+```sh
+forge build
+forge test
+```
+
+This repository ships its own minimal ERC-20 interface rather than a full token implementation. Use the official USDC address for the network you choose; independently verify it from Circle's official documentation before funding any escrow.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..f0a99504823fd74d538ad46bafa323bf9b88570d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "src"
+test = "test"
+script = "script"
+out = "out"
+libs = ["lib"]
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+# See https://book.getfoundry.sh/reference/config/ for all options.
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..09e76cf045b0a4ccb28c6e675f4ea98f541011b7
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "description": "USDC-denominated freelance escrow contracts",
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  }
 }
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c03466b3b0d3de7d11d2b57a4a9acccf732be5a2
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        vm.startBroadcast();
+        factory = new EscrowFactory();
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4e3439f6466e681cc9d834c7f3257b7ce8200112
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
+contract EscrowFactory {
+    error FundingFailed();
+    error IncorrectFundingReceived();
+
+    event EscrowCreated(
+        bytes32 indexed jobId,
+        address indexed escrow,
+        address indexed client,
+        address freelancer,
+        address arbitrator,
+        address token,
+        uint256 amount
+    );
+
+    mapping(bytes32 jobId => address escrow) public escrowForJob;
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        bytes32 jobId
+    ) external returns (FreelanceEscrow escrow) {
+        if (escrowForJob[jobId] != address(0)) revert FundingFailed();
+
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
+        uint256 balanceBefore = token.balanceOf(address(escrow));
+        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
+        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();
+
+        escrowForJob[jobId] = address(escrow);
+        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bf5f9234fd651327fde901cc7090f9f3b49986b9
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,134 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed USDC-style ERC-20 amount for one freelance engagement.
+/// @dev `amount` is denominated in the token's smallest unit. For 6-decimal USDC,
+///      $2,000 is 2_000e6 and $50,000 is 50_000e6.
+contract FreelanceEscrow {
+    uint256 public constant MIN_ESCROW = 2_000e6;
+    uint256 public constant MAX_ESCROW = 50_000e6;
+
+    enum Status {
+        Funded,
+        Delivered,
+        Disputed,
+        Resolved
+    }
+
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidState(Status expected, Status actual);
+    error TransferFailed();
+    error Reentrancy();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    bytes32 public immutable jobId;
+    Status public status;
+    bool private locked;
+
+    event WorkDelivered(bytes32 indexed jobId, string deliverableURI);
+    event PaymentReleased(bytes32 indexed jobId, address indexed freelancer, uint256 amount);
+    event PaymentRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);
+    event DisputeOpened(bytes32 indexed jobId, address indexed openedBy, string evidenceURI);
+    event DisputeResolved(
+        bytes32 indexed jobId, uint256 clientAmount, uint256 freelancerAmount, string resolutionURI
+    );
+
+    modifier onlyClient() {
+        if (msg.sender != client) revert Unauthorized();
+        _;
+    }
+
+    modifier onlyParty() {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked) revert Reentrancy();
+        locked = true;
+        _;
+        locked = false;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        bytes32 jobId_
+    ) {
+        if (
+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
+                || arbitrator_ == address(0) || client_ == freelancer_
+        ) revert InvalidAddress();
+        if (amount_ < MIN_ESCROW || amount_ > MAX_ESCROW) revert InvalidAmount();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        jobId = jobId_;
+        status = Status.Funded;
+    }
+
+    /// @notice Records delivery. The client may then release payment or either party may open a dispute.
+    function markDelivered(string calldata deliverableURI) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Delivered;
+        emit WorkDelivered(jobId, deliverableURI);
+    }
+
+    /// @notice Releases the entire escrow to the freelancer after delivery.
+    function releaseToFreelancer() external onlyClient nonReentrant {
+        if (status != Status.Delivered) revert InvalidState(Status.Delivered, status);
+        status = Status.Resolved;
+        _send(freelancer, amount);
+        emit PaymentReleased(jobId, freelancer, amount);
+    }
+
+    /// @notice Lets the client cancel and recover escrow before work is marked delivered.
+    function refundClient() external onlyClient nonReentrant {
+        if (status != Status.Funded) revert InvalidState(Status.Funded, status);
+        status = Status.Resolved;
+        _send(client, amount);
+        emit PaymentRefunded(jobId, client, amount);
+    }
+
+    /// @notice Escalates the engagement to the agreed independent arbitrator.
+    function openDispute(string calldata evidenceURI) external onlyParty {
+        if (status != Status.Funded && status != Status.Delivered) revert Unauthorized();
+        status = Status.Disputed;
+        emit DisputeOpened(jobId, msg.sender, evidenceURI);
+    }
+
+    /// @notice The designated arbitrator splits the escrow. Amounts must total exactly the escrowed amount.
+    function resolveDispute(uint256 clientAmount, uint256 freelancerAmount, string calldata resolutionURI)
+        external
+        nonReentrant
+    {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidState(Status.Disputed, status);
+        if (clientAmount + freelancerAmount != amount) revert InvalidAmount();
+
+        status = Status.Resolved;
+        if (clientAmount != 0) _send(client, clientAmount);
+        if (freelancerAmount != 0) _send(freelancer, freelancerAmount);
+        emit DisputeResolved(jobId, clientAmount, freelancerAmount, resolutionURI);
+    }
+
+    function _send(address recipient, uint256 value) private {
+        if (!token.transfer(recipient, value)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a60bf00ffc34dc3fb48ebd23800d6a416fe12e8
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+    function balanceOf(address account) external view returns (uint256);
+}
diff --git a/test/Escrow.t.sol b/test/Escrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9d652a7a2497d44040e0d8838e88504340ecd26a
--- /dev/null
+++ b/test/Escrow.t.sol
@@ -0,0 +1,116 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {MockUSDC} from "./MockUSDC.sol";
+
+interface Vm {
+    function prank(address caller) external;
+    function expectRevert(bytes4 selector) external;
+    function expectRevert(bytes calldata revertData) external;
+}
+
+contract EscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    address private constant CLIENT = address(0xCAFE);
+    uint256 private constant AMOUNT = 10_000e6;
+
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory();
+        usdc.mint(address(this), 100_000e6);
+        usdc.approve(address(factory), type(uint256).max);
+    }
+
+    function testCreatesAndFundsEscrow() public {
+        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
+        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
+        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
+    }
+
+    function testClientReleasesOnlyAfterDelivery() public {
+        FreelanceEscrow escrow = _create();
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Delivered,
+                FreelanceEscrow.Status.Funded
+            )
+        );
+        escrow.releaseToFreelancer();
+
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        escrow.releaseToFreelancer();
+        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
+        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
+    }
+
+    function testClientCanRefundBeforeDeliveryButNotAfter() public {
+        FreelanceEscrow escrow = _create();
+        uint256 balanceBefore = usdc.balanceOf(address(this));
+        escrow.refundClient();
+        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);
+
+        escrow = _createWithId(bytes32("job-2"));
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.expectRevert(
+            abi.encodeWithSelector(
+                FreelanceEscrow.InvalidState.selector,
+                FreelanceEscrow.Status.Funded,
+                FreelanceEscrow.Status.Delivered
+            )
+        );
+        escrow.refundClient();
+    }
+
+    function testArbitratorCanSplitDisputedEscrow() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.openDispute("ipfs://evidence");
+
+        vm.prank(ARBITRATOR);
+        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
+        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
+        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
+        _assertEq(usdc.balanceOf(address(escrow)), 0);
+    }
+
+    function testOutOfRangeEscrowCannotBeCreated() public {
+        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
+        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
+    }
+
+    function testNonClientCannotRelease() public {
+        FreelanceEscrow escrow = _create();
+        vm.prank(FREELANCER);
+        escrow.markDelivered("ipfs://deliverable");
+        vm.prank(FREELANCER);
+        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
+        escrow.releaseToFreelancer();
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return _createWithId(bytes32("job-1"));
+    }
+
+    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
+        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
+    }
+
+    function _assertEq(uint256 a, uint256 b) private pure {
+        require(a == b, "assertion failed");
+    }
+
+    function _assertEq(address a, address b) private pure {
+        require(a == b, "assertion failed");
+    }
+}
diff --git a/test/MockUSDC.sol b/test/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c5bc8218140a6a3778a98c8297594d981e5e41f7
--- /dev/null
+++ b/test/MockUSDC.sol
@@ -0,0 +1,37 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
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
+    function transfer(address to, uint256 value) external override returns (bool) {
+        _transfer(msg.sender, to, value);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
+        uint256 permitted = allowance[from][msg.sender];
+        require(permitted >= value, "allowance");
+        allowance[from][msg.sender] = permitted - value;
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

tokens used
30,958
````

## final message

Built a Foundry-based USDC escrow service.

- Contracts: [EscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/EscrowFactory.sol) and [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/src/FreelanceEscrow.sol)
- Enforces $2,000–$50,000 (6-decimal USDC), atomic funding, delivery/release flow, pre-delivery refunds, and arbitrated disputes with exact splits.
- Added deployment script, environment template, and tests.
- Deployment guidance and Base Sepolia/Base mainnet rationale are in [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234637Z-codex-no-skill-3/gas-goal-001/README.md).

Verified: `forge test` passes all 6 tests.

Before holding real funds, get an independent security audit and finalize the arbitrator/governance process.
