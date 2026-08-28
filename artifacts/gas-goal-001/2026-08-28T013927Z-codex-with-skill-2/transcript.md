# Executor transcript — 2026-08-28T013927Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04605-a218-7f92-88bd-ec95296f1531
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Build me
the escrow smart contract and set it up so I can deploy it — pick whatever
tooling you'd use.

Work in this directory. Include a short README.md covering how to deploy
it, and where you'd deploy it and why, so I know what to do next.

2026-08-28T01:39:29.654445Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a04605-a218-7f92-88bd-ec95296f1531.tmp-1787881169465561440: line 2547: syntax error near unexpected token `('

codex
I’ll build this as a Solidity project with deployment and tests. Because the request involves transaction/deployment cost and network selection, I’m using the gas guidance to make that choice responsibly.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -160" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001
 succeeded in 2ms:
exec
/bin/bash -lc "sed -n '1,240p' TASK.md; printf '\\n--- package ---\\n'; sed -n '1,200p' package.json; printf '\\n--- git ---\\n'; git status --short; printf '\\n--- tools ---\\n'; command -v forge || true; command -v solc || true; command -v npx || true; command -v cast || true" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001
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

--- git ---

--- tools ---
/home/damu/.foundry/bin/forge
/home/damu/.local/bin/solc
/home/damu/.nvm/versions/node/v22.22.2/bin/npx
/home/damu/.foundry/bin/cast

exec
/bin/bash -lc "printf 'ethereum-mainnet base fee (wei): '; cast base-fee --rpc-url https://ethereum-rpc.publicnode.com; printf 'ethereum-mainnet gas price (wei): '; cast gas-price --rpc-url https://ethereum-rpc.publicnode.com; printf 'base-mainnet base fee (wei): '; cast base-fee --rpc-url https://mainnet.base.org; printf 'base-mainnet gas price (wei): '; cast gas-price --rpc-url https://mainnet.base.org" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001
 succeeded in 1342ms:
49519046
ethereum-mainnet gas price (wei): 49680232
base-mainnet base fee (wei): 5000000
base-mainnet gas price (wei): 6000000

codex
I’m using Foundry and an ERC-20 (such as USDC) rather than native ETH: it avoids exchange-rate ambiguity for USD-denominated jobs. The contract will use a client, freelancer, and independent arbitrator, with explicit delivery, release, dispute, and refund paths.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/script/Deploy.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/EscrowFactory.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/interfaces/IERC20.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0503ebbbd5991793a9f757cc4250b377846c5fb5
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
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
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
index 0000000000000000000000000000000000000000..8392af8390a5d2d36ebaa0f2c7afb0de07cb384f
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(token), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0503ebbbd5991793a9f757cc4250b377846c5fb5
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
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
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
index 0000000000000000000000000000000000000000..8392af8390a5d2d36ebaa0f2c7afb0de07cb384f
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(token), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

2026-08-28T01:41:18.965810Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid patch: multiple operations target /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/script/Deploy.s.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..0503ebbbd5991793a9f757cc4250b377846c5fb5
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
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
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
index 0000000000000000000000000000000000000000..8392af8390a5d2d36ebaa0f2c7afb0de07cb384f
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,30 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    function createEscrow(
+        IERC20 token,
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(token), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/script/Deploy.s.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/EscrowFactory.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge test -vvv' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001
 exited 1 in 8ms:
Diff in src/EscrowFactory.sol:
37  37   |         bytes32 jobReference
38  38   |     ) external returns (FreelanceEscrow escrow) {
39  39   |         if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
40       |-        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
41       |-        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
    40   |+        escrow = new FreelanceEscrow(
    41   |+            usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference
    42   |+        );
    43   |+        emit EscrowCreated(
    44   |+            address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference
    45   |+        );
42  46   |     }
43  47   | }

Diff in src/FreelanceEscrow.sol:
42  42   |     event Released(address indexed freelancer, uint256 amount);
43  43   |     event Refunded(address indexed client, uint256 amount);
44  44   |     event Disputed(address indexed raisedBy, bytes32 reasonReference);
45       |-    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
    45   |+    event Resolved(
    46   |+        address indexed arbitrator,
    47   |+        address indexed recipient,
    48   |+        uint256 amount,
    49   |+        bytes32 resolutionReference
    50   |+    );
46  51   |     event Cancelled(address indexed client);
47  52   | 
48  53   |     modifier nonReentrant() {
--------------------------------------------------------------------------------61  66   |         uint256 fundingDeadline_,
62  67   |         bytes32 jobReference_
63  68   |     ) {
64       |-        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
    69   |+        if (
    70   |+            address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0)
    71   |+                || arbitrator_ == address(0)
    72   |+        ) {
    73   |+            revert InvalidAddress();
    74   |+        }
    75   |+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) {
65  76   |             revert InvalidAddress();
66  77   |         }
67       |-        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
68  78   |         if (amount_ == 0) revert InvalidAmount();
69  79   |         if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
70  80   | 
--------------------------------------------------------------------------------114 124  |     /// @notice Either party escalates a funded engagement to the designated arbitrator.
115 125  |     function dispute(bytes32 reasonReference) external {
116 126  |         if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
117      |-        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
    127  |+        if (status != Status.Funded && status != Status.Delivered) {
    128  |+            revert InvalidStatus(Status.Funded, status);
    129  |+        }
118 130  | 
119 131  |         status = Status.Disputed;
120 132  |         emit Disputed(msg.sender, reasonReference);

Diff in test/FreelanceEscrow.t.sol:
9   9    |     mapping(address => uint256) public override balanceOf;
10  10   |     mapping(address => mapping(address => uint256)) public allowance;
11  11   | 
12       |-    function mint(address to, uint256 value) external { balanceOf[to] += value; }
    12   |+    function mint(address to, uint256 value) external {
    13   |+        balanceOf[to] += value;
    14   |+    }
    15   |+
13  16   |     function approve(address spender, uint256 value) external returns (bool) {
14  17   |         allowance[msg.sender][spender] = value;
15  18   |         return true;
16  19   |     }
    20   |+
17  21   |     function transfer(address to, uint256 value) external returns (bool) {
18  22   |         if (balanceOf[msg.sender] < value) return false;
19  23   |         balanceOf[msg.sender] -= value;
20  24   |         balanceOf[to] += value;
21  25   |         return true;
22  26   |     }
    27   |+
23  28   |     function transferFrom(address from, address to, uint256 value) external returns (bool) {
24  29   |         if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
25  30   |         allowance[from][msg.sender] -= value;
--------------------------------------------------------------------------------29  34   |     }
30  35   | }
31  36   | 
32       |-contract FreelanceEscrowTest {
33       |-    MockUSDC private usdc;
34       |-    EscrowFactory private factory;
35       |-    address private constant FREELANCER = address(0xBEEF);
36       |-    address private constant ARBITRATOR = address(0xA11CE);
37       |-    uint256 private constant AMOUNT = 2_000e6;
    37   |+    contract FreelanceEscrowTest {
    38   |+        MockUSDC private usdc;
    39   |+        EscrowFactory private factory;
    40   |+        address private constant FREELANCER = address(0xBEEF);
    41   |+        address private constant ARBITRATOR = address(0xA11CE);
    42   |+        uint256 private constant AMOUNT = 2_000e6;
38  43   | 
39       |-    function setUp() public {
40       |-        usdc = new MockUSDC();
41       |-        factory = new EscrowFactory(usdc);
42       |-        usdc.mint(address(this), AMOUNT);
43       |-    }
    44   |+        function setUp() public {
    45   |+            usdc = new MockUSDC();
    46   |+            factory = new EscrowFactory(usdc);
    47   |+            usdc.mint(address(this), AMOUNT);
    48   |+        }
44  49   | 
45       |-    function testFundEscrow() public {
46       |-        FreelanceEscrow escrow = _create();
47       |-        usdc.approve(address(escrow), AMOUNT);
48       |-        escrow.fund();
49       |-        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
50       |-        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
51       |-    }
    50   |+        function testFundEscrow() public {
    51   |+            FreelanceEscrow escrow = _create();
    52   |+            usdc.approve(address(escrow), AMOUNT);
    53   |+            escrow.fund();
    54   |+            require(
    55   |+                uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded"
    56   |+            );
    57   |+            require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
    58   |+        }
52  59   | 
53       |-    function testRejectsAmountOutsideRange() public {
54       |-        (bool ok,) = address(factory).call(
55       |-            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
56       |-        );
57       |-        require(!ok, "accepted below-minimum amount");
58       |-    }
    60   |+        function testRejectsAmountOutsideRange() public {
    61   |+            (bool ok,) = address(factory)
    62   |+                .call(
    63   |+                    abi.encodeCall(
    64   |+                        factory.createEscrow,
    65   |+                        (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0))
    66   |+                    )
    67   |+                );
    68   |+            require(!ok, "accepted below-minimum amount");
    69   |+        }
59  70   | 
60       |-    function _create() private returns (FreelanceEscrow) {
61       |-        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
    71   |+        function _create() private returns (FreelanceEscrow) {
    72   |+            return factory.createEscrow(
    73   |+                FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1")
    74   |+            );
    75   |+        }
62  76   |     }
63       |-}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge test -vvv' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001
 succeeded in 232ms:
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/EscrowFactory.sol
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/test/FreelanceEscrow.t.sol
Formatted /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol
Compiling 4 files with Solc 0.8.24
Solc 0.8.24 finished in 175.81ms
Compiler run successful!

Ran 2 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testFundEscrow() (gas: 904947)
[PASS] testRejectsAmountOutsideRange() (gas: 6595)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 1.01ms (624.95µs CPU time)

Ran 1 test suite in 7.57ms (1.01ms CPU time): 2 tests passed, 0 failed, 0 skipped (2 total tests)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

web search: 
web search: site:developers.circle.com USDC Ethereum Mainnet contract address
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

web search: 
web search: site:developers.circle.com USDC Ethereum Mainnet contract address
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/README.md
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4e0c23bb75c32790c9e1120442ca496d7c64710
--- /dev/null
+++ b/README.md
@@ -0,0 +1,66 @@
+# Freelance USDC Escrow
+
+A small, non-upgradeable Foundry project for fixed-price freelance jobs. The factory creates one escrow per job and accepts **native USDC with six decimals** only. Each job must be from **$2,000 (`2_000e6`) through $50,000 (`50_000e6`)**, inclusive.
+
+## Lifecycle
+
+1. The client creates a job escrow with a freelancer, an arbitrator, a funding deadline, and a hash of the off-chain agreement.
+2. The client approves USDC and calls `fund`.
+3. The freelancer calls `markDelivered` with a hash of the delivered work.
+4. The client calls `release`, sending all USDC to the freelancer.
+5. Either party can call `dispute` before release. The designated arbitrator then calls `resolve` to send the whole balance to one party.
+
+The contract has no platform fee and no unilateral recovery of a funded escrow. That is intentional: the arbitrator is the recovery path if a client disappears or the parties disagree. Choose and document that arbitrator before creating a job.
+
+## Local setup and tests
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```bash
+forge test
+forge build
+```
+
+## Deploy
+
+First deploy to Ethereum Sepolia using Circle's Sepolia USDC address. Put a funded test-wallet key in an environment variable; never commit it.
+
+```bash
+export RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
+export PRIVATE_KEY="0x..."
+export USDC_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+Save the `EscrowFactory` address printed by Foundry. To create a $2,000 job after deployment (replace the placeholders), use a future Unix timestamp and an agreement hash:
+
+```bash
+export FACTORY="0x..."
+export FREELANCER="0x..."
+export ARBITRATOR="0x..."
+export DEADLINE="$(( $(date +%s) + 604800 ))"
+export JOB_REFERENCE="$(cast keccak 'freelance-job:your-internal-id')"
+
+cast send "$FACTORY" \
+  'createEscrow(address,address,uint256,uint256,bytes32)' \
+  "$FREELANCER" "$ARBITRATOR" 2000000000 "$DEADLINE" "$JOB_REFERENCE" \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+Read the `EscrowCreated` event in that transaction receipt to get the job escrow address. The client must then approve the exact amount and fund it:
+
+```bash
+export ESCROW="0x..."
+cast send "$USDC_ADDRESS" 'approve(address,uint256)' "$ESCROW" 2000000000 \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+cast send "$ESCROW" 'fund()' --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+For Ethereum mainnet, change `RPC_URL` to your authenticated Ethereum RPC endpoint and set `USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. Verify the USDC address against [Circle's official contract-address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) immediately before broadcasting.
+
+## Recommended production network
+
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are infrequent, high-value custody actions ($2k–$50k), where Ethereum's settlement security, USDC liquidity, and easy counterparty access are more important than optimizing a few execution steps. Current measurements also keep mainnet viable for this workload: at build time the public RPC returned a 49,519,046-wei base fee and a 49,680,232-wei gas price. Do not reuse those values for a deployment; wallets should derive fees from the target network at broadcast time.
+
+Before holding customer funds: commission an independent security audit, define the arbitrator's legal/operational process, use a multisig for that arbitrator, verify source code, and obtain legal and compliance advice for your operating jurisdictions. This repository is a technical starting point, not a custody or regulatory solution.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4e0c23bb75c32790c9e1120442ca496d7c64710
--- /dev/null
+++ b/README.md
@@ -0,0 +1,66 @@
+# Freelance USDC Escrow
+
+A small, non-upgradeable Foundry project for fixed-price freelance jobs. The factory creates one escrow per job and accepts **native USDC with six decimals** only. Each job must be from **$2,000 (`2_000e6`) through $50,000 (`50_000e6`)**, inclusive.
+
+## Lifecycle
+
+1. The client creates a job escrow with a freelancer, an arbitrator, a funding deadline, and a hash of the off-chain agreement.
+2. The client approves USDC and calls `fund`.
+3. The freelancer calls `markDelivered` with a hash of the delivered work.
+4. The client calls `release`, sending all USDC to the freelancer.
+5. Either party can call `dispute` before release. The designated arbitrator then calls `resolve` to send the whole balance to one party.
+
+The contract has no platform fee and no unilateral recovery of a funded escrow. That is intentional: the arbitrator is the recovery path if a client disappears or the parties disagree. Choose and document that arbitrator before creating a job.
+
+## Local setup and tests
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```bash
+forge test
+forge build
+```
+
+## Deploy
+
+First deploy to Ethereum Sepolia using Circle's Sepolia USDC address. Put a funded test-wallet key in an environment variable; never commit it.
+
+```bash
+export RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
+export PRIVATE_KEY="0x..."
+export USDC_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+Save the `EscrowFactory` address printed by Foundry. To create a $2,000 job after deployment (replace the placeholders), use a future Unix timestamp and an agreement hash:
+
+```bash
+export FACTORY="0x..."
+export FREELANCER="0x..."
+export ARBITRATOR="0x..."
+export DEADLINE="$(( $(date +%s) + 604800 ))"
+export JOB_REFERENCE="$(cast keccak 'freelance-job:your-internal-id')"
+
+cast send "$FACTORY" \
+  'createEscrow(address,address,uint256,uint256,bytes32)' \
+  "$FREELANCER" "$ARBITRATOR" 2000000000 "$DEADLINE" "$JOB_REFERENCE" \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+Read the `EscrowCreated` event in that transaction receipt to get the job escrow address. The client must then approve the exact amount and fund it:
+
+```bash
+export ESCROW="0x..."
+cast send "$USDC_ADDRESS" 'approve(address,uint256)' "$ESCROW" 2000000000 \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+cast send "$ESCROW" 'fund()' --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+For Ethereum mainnet, change `RPC_URL` to your authenticated Ethereum RPC endpoint and set `USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. Verify the USDC address against [Circle's official contract-address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) immediately before broadcasting.
+
+## Recommended production network
+
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are infrequent, high-value custody actions ($2k–$50k), where Ethereum's settlement security, USDC liquidity, and easy counterparty access are more important than optimizing a few execution steps. Current measurements also keep mainnet viable for this workload: at build time the public RPC returned a 49,519,046-wei base fee and a 49,680,232-wei gas price. Do not reuse those values for a deployment; wallets should derive fees from the target network at broadcast time.
+
+Before holding customer funds: commission an independent security audit, define the arbitrator's legal/operational process, use a multisig for that arbitrator, verify source code, and obtain legal and compliance advice for your operating jurisdictions. This repository is a technical starting point, not a custody or regulatory solution.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

codex
The project is now deployable and tested locally. I’ve also pinned it to native six-decimal USDC so the $2k–$50k constraint is enforced on-chain instead of being just a UI convention.
exec
/bin/bash -lc 'forge fmt --check && forge test -vvv && git diff --check && git status --short && git diff --stat' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001
 succeeded in 55ms:
No files changed, compilation skipped

Ran 2 tests for test/FreelanceEscrow.t.sol:FreelanceEscrowTest
[PASS] testFundEscrow() (gas: 904947)
[PASS] testRejectsAmountOutsideRange() (gas: 6595)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 551.27µs (296.82µs CPU time)

Ran 1 test suite in 7.57ms (551.27µs CPU time): 2 tests passed, 0 failed, 0 skipped (2 total tests)
?? README.md
?? foundry.toml
?? script/
?? src/
?? test/

diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4e0c23bb75c32790c9e1120442ca496d7c64710
--- /dev/null
+++ b/README.md
@@ -0,0 +1,66 @@
+# Freelance USDC Escrow
+
+A small, non-upgradeable Foundry project for fixed-price freelance jobs. The factory creates one escrow per job and accepts **native USDC with six decimals** only. Each job must be from **$2,000 (`2_000e6`) through $50,000 (`50_000e6`)**, inclusive.
+
+## Lifecycle
+
+1. The client creates a job escrow with a freelancer, an arbitrator, a funding deadline, and a hash of the off-chain agreement.
+2. The client approves USDC and calls `fund`.
+3. The freelancer calls `markDelivered` with a hash of the delivered work.
+4. The client calls `release`, sending all USDC to the freelancer.
+5. Either party can call `dispute` before release. The designated arbitrator then calls `resolve` to send the whole balance to one party.
+
+The contract has no platform fee and no unilateral recovery of a funded escrow. That is intentional: the arbitrator is the recovery path if a client disappears or the parties disagree. Choose and document that arbitrator before creating a job.
+
+## Local setup and tests
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```bash
+forge test
+forge build
+```
+
+## Deploy
+
+First deploy to Ethereum Sepolia using Circle's Sepolia USDC address. Put a funded test-wallet key in an environment variable; never commit it.
+
+```bash
+export RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
+export PRIVATE_KEY="0x..."
+export USDC_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+Save the `EscrowFactory` address printed by Foundry. To create a $2,000 job after deployment (replace the placeholders), use a future Unix timestamp and an agreement hash:
+
+```bash
+export FACTORY="0x..."
+export FREELANCER="0x..."
+export ARBITRATOR="0x..."
+export DEADLINE="$(( $(date +%s) + 604800 ))"
+export JOB_REFERENCE="$(cast keccak 'freelance-job:your-internal-id')"
+
+cast send "$FACTORY" \
+  'createEscrow(address,address,uint256,uint256,bytes32)' \
+  "$FREELANCER" "$ARBITRATOR" 2000000000 "$DEADLINE" "$JOB_REFERENCE" \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+Read the `EscrowCreated` event in that transaction receipt to get the job escrow address. The client must then approve the exact amount and fund it:
+
+```bash
+export ESCROW="0x..."
+cast send "$USDC_ADDRESS" 'approve(address,uint256)' "$ESCROW" 2000000000 \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+cast send "$ESCROW" 'fund()' --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+For Ethereum mainnet, change `RPC_URL` to your authenticated Ethereum RPC endpoint and set `USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. Verify the USDC address against [Circle's official contract-address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) immediately before broadcasting.
+
+## Recommended production network
+
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are infrequent, high-value custody actions ($2k–$50k), where Ethereum's settlement security, USDC liquidity, and easy counterparty access are more important than optimizing a few execution steps. Current measurements also keep mainnet viable for this workload: at build time the public RPC returned a 49,519,046-wei base fee and a 49,680,232-wei gas price. Do not reuse those values for a deployment; wallets should derive fees from the target network at broadcast time.
+
+Before holding customer funds: commission an independent security audit, define the arbitrator's legal/operational process, use a multisig for that arbitrator, verify source code, and obtain legal and compliance advice for your operating jurisdictions. This repository is a technical starting point, not a custody or regulatory solution.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

codex
Built the Foundry escrow project.

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol): USDC funding, delivery, release, disputes, arbitrator resolution, and reentrancy protection.
- [EscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/EscrowFactory.sol): creates one escrow per job and enforces $2,000–$50,000 USDC limits.
- [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/README.md): local test, Sepolia deployment, mainnet deployment, and job-creation commands.
- Deployment script: [Deploy.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/script/Deploy.s.sol).

Verified with `forge test`: 2 passing tests.

Recommended production network: Ethereum mainnet with native USDC, appropriate for infrequent $2k–$50k custody actions. The README includes Circle’s official USDC addresses for Sepolia and mainnet; verify them before deploy. [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

Before real funds: have the contracts independently audited and establish the arbitrator’s legal and operational process.
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4e0c23bb75c32790c9e1120442ca496d7c64710
--- /dev/null
+++ b/README.md
@@ -0,0 +1,66 @@
+# Freelance USDC Escrow
+
+A small, non-upgradeable Foundry project for fixed-price freelance jobs. The factory creates one escrow per job and accepts **native USDC with six decimals** only. Each job must be from **$2,000 (`2_000e6`) through $50,000 (`50_000e6`)**, inclusive.
+
+## Lifecycle
+
+1. The client creates a job escrow with a freelancer, an arbitrator, a funding deadline, and a hash of the off-chain agreement.
+2. The client approves USDC and calls `fund`.
+3. The freelancer calls `markDelivered` with a hash of the delivered work.
+4. The client calls `release`, sending all USDC to the freelancer.
+5. Either party can call `dispute` before release. The designated arbitrator then calls `resolve` to send the whole balance to one party.
+
+The contract has no platform fee and no unilateral recovery of a funded escrow. That is intentional: the arbitrator is the recovery path if a client disappears or the parties disagree. Choose and document that arbitrator before creating a job.
+
+## Local setup and tests
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation).
+
+```bash
+forge test
+forge build
+```
+
+## Deploy
+
+First deploy to Ethereum Sepolia using Circle's Sepolia USDC address. Put a funded test-wallet key in an environment variable; never commit it.
+
+```bash
+export RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
+export PRIVATE_KEY="0x..."
+export USDC_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
+
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+```
+
+Save the `EscrowFactory` address printed by Foundry. To create a $2,000 job after deployment (replace the placeholders), use a future Unix timestamp and an agreement hash:
+
+```bash
+export FACTORY="0x..."
+export FREELANCER="0x..."
+export ARBITRATOR="0x..."
+export DEADLINE="$(( $(date +%s) + 604800 ))"
+export JOB_REFERENCE="$(cast keccak 'freelance-job:your-internal-id')"
+
+cast send "$FACTORY" \
+  'createEscrow(address,address,uint256,uint256,bytes32)' \
+  "$FREELANCER" "$ARBITRATOR" 2000000000 "$DEADLINE" "$JOB_REFERENCE" \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+Read the `EscrowCreated` event in that transaction receipt to get the job escrow address. The client must then approve the exact amount and fund it:
+
+```bash
+export ESCROW="0x..."
+cast send "$USDC_ADDRESS" 'approve(address,uint256)' "$ESCROW" 2000000000 \
+  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+cast send "$ESCROW" 'fund()' --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
+```
+
+For Ethereum mainnet, change `RPC_URL` to your authenticated Ethereum RPC endpoint and set `USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. Verify the USDC address against [Circle's official contract-address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) immediately before broadcasting.
+
+## Recommended production network
+
+Deploy the production version to **Ethereum mainnet**, using native USDC. These are infrequent, high-value custody actions ($2k–$50k), where Ethereum's settlement security, USDC liquidity, and easy counterparty access are more important than optimizing a few execution steps. Current measurements also keep mainnet viable for this workload: at build time the public RPC returned a 49,519,046-wei base fee and a 49,680,232-wei gas price. Do not reuse those values for a deployment; wallets should derive fees from the target network at broadcast time.
+
+Before holding customer funds: commission an independent security audit, define the arbitrator's legal/operational process, use a multisig for that arbitrator, verify source code, and obtain legal and compliance advice for your operating jurisdictions. This repository is a technical starting point, not a custody or regulatory solution.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..868d1b3ecaa205c56556ac01bf98366549951264
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,12 @@
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
+[fmt]
+line_length = 100
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..741fc66ec5eb3cd3ec7c09cff2be681c04b27dcf
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,23 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+import {IERC20} from "../src/interfaces/IERC20.sol";
+
+interface Vm {
+    function startBroadcast() external;
+    function stopBroadcast() external;
+    function envAddress(string calldata name) external returns (address value);
+}
+
+/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (EscrowFactory factory) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        factory = new EscrowFactory(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/EscrowFactory.sol b/src/EscrowFactory.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8c775ecb5605f7bf2e369b272849102f7a74c7f3
--- /dev/null
+++ b/src/EscrowFactory.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {FreelanceEscrow} from "./FreelanceEscrow.sol";
+
+/// @title EscrowFactory
+/// @notice Permissionless factory that creates an auditable escrow contract per job.
+contract EscrowFactory {
+    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
+    uint256 public constant MIN_AMOUNT = 2_000e6;
+    uint256 public constant MAX_AMOUNT = 50_000e6;
+
+    IERC20 public immutable usdc;
+
+    error InvalidAmount();
+
+    event EscrowCreated(
+        address indexed escrow,
+        address indexed client,
+        address indexed freelancer,
+        address token,
+        uint256 amount,
+        bytes32 jobReference
+    );
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
+        usdc = usdc_;
+    }
+
+    function createEscrow(
+        address freelancer,
+        address arbitrator,
+        uint256 amount,
+        uint256 fundingDeadline,
+        bytes32 jobReference
+    ) external returns (FreelanceEscrow escrow) {
+        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
+        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference);
+        emit EscrowCreated(address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference);
+    }
+}
diff --git a/src/FreelanceEscrow.sol b/src/FreelanceEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f95d832bfcd77549e8c526f99205a5ecad8c5747
--- /dev/null
+++ b/src/FreelanceEscrow.sol
@@ -0,0 +1,146 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+
+/// @title FreelanceEscrow
+/// @notice Holds a fixed ERC-20 payment for one freelance engagement.
+/// @dev This contract deliberately supports only standard, non-rebasing ERC-20s.
+contract FreelanceEscrow {
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
+    error Unauthorized();
+    error InvalidAddress();
+    error InvalidAmount();
+    error InvalidDeadline();
+    error InvalidStatus(Status expected, Status actual);
+    error TransferFailed();
+    error UnsupportedToken();
+    error ReentrantCall();
+
+    IERC20 public immutable token;
+    address public immutable client;
+    address public immutable freelancer;
+    address public immutable arbitrator;
+    uint256 public immutable amount;
+    uint256 public immutable fundingDeadline;
+    bytes32 public immutable jobReference;
+
+    Status public status;
+    uint256 private locked = 1;
+
+    event Funded(address indexed client, uint256 amount);
+    event WorkDelivered(address indexed freelancer, bytes32 deliverableReference);
+    event Released(address indexed freelancer, uint256 amount);
+    event Refunded(address indexed client, uint256 amount);
+    event Disputed(address indexed raisedBy, bytes32 reasonReference);
+    event Resolved(address indexed arbitrator, address indexed recipient, uint256 amount, bytes32 resolutionReference);
+    event Cancelled(address indexed client);
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    constructor(
+        IERC20 token_,
+        address client_,
+        address freelancer_,
+        address arbitrator_,
+        uint256 amount_,
+        uint256 fundingDeadline_,
+        bytes32 jobReference_
+    ) {
+        if (address(token_) == address(0) || client_ == address(0) || freelancer_ == address(0) || arbitrator_ == address(0)) {
+            revert InvalidAddress();
+        }
+        if (client_ == freelancer_ || client_ == arbitrator_ || freelancer_ == arbitrator_) revert InvalidAddress();
+        if (amount_ == 0) revert InvalidAmount();
+        if (fundingDeadline_ <= block.timestamp) revert InvalidDeadline();
+
+        token = token_;
+        client = client_;
+        freelancer = freelancer_;
+        arbitrator = arbitrator_;
+        amount = amount_;
+        fundingDeadline = fundingDeadline_;
+        jobReference = jobReference_;
+    }
+
+    /// @notice Client deposits the agreed amount after approving this escrow.
+    function fund() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+        if (block.timestamp > fundingDeadline) revert InvalidDeadline();
+
+        uint256 balanceBefore = token.balanceOf(address(this));
+        if (!token.transferFrom(client, address(this), amount)) revert TransferFailed();
+        // Reject fee-on-transfer tokens so the stated amount is always escrowed.
+        if (token.balanceOf(address(this)) != balanceBefore + amount) revert UnsupportedToken();
+
+        status = Status.Funded;
+        emit Funded(client, amount);
+    }
+
+    /// @notice Freelancer records delivery. Store the deliverable off-chain and put its hash here.
+    function markDelivered(bytes32 deliverableReference) external {
+        if (msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Delivered;
+        emit WorkDelivered(freelancer, deliverableReference);
+    }
+
+    /// @notice Client accepts the work and pays the freelancer.
+    function release() external nonReentrant {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Delivered) revert InvalidStatus(Status.Delivered, status);
+
+        status = Status.Released;
+        _pay(freelancer);
+        emit Released(freelancer, amount);
+    }
+
+    /// @notice Either party escalates a funded engagement to the designated arbitrator.
+    function dispute(bytes32 reasonReference) external {
+        if (msg.sender != client && msg.sender != freelancer) revert Unauthorized();
+        if (status != Status.Funded && status != Status.Delivered) revert InvalidStatus(Status.Funded, status);
+
+        status = Status.Disputed;
+        emit Disputed(msg.sender, reasonReference);
+    }
+
+    /// @notice Arbitrator pays the full escrow to exactly one party. Split awards require separate escrows.
+    function resolve(address recipient, bytes32 resolutionReference) external nonReentrant {
+        if (msg.sender != arbitrator) revert Unauthorized();
+        if (status != Status.Disputed) revert InvalidStatus(Status.Disputed, status);
+        if (recipient != client && recipient != freelancer) revert Unauthorized();
+
+        status = recipient == freelancer ? Status.Released : Status.Refunded;
+        _pay(recipient);
+        emit Resolved(arbitrator, recipient, amount, resolutionReference);
+    }
+
+    /// @notice Client can cancel only before funding, or reclaim an unfunded proposal after expiry.
+    function cancel() external {
+        if (msg.sender != client) revert Unauthorized();
+        if (status != Status.Created) revert InvalidStatus(Status.Created, status);
+
+        status = Status.Cancelled;
+        emit Cancelled(client);
+    }
+
+    function _pay(address recipient) private {
+        if (!token.transfer(recipient, amount)) revert TransferFailed();
+    }
+}
diff --git a/src/interfaces/IERC20.sol b/src/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3de599df22fdc990b4da1662822fe8481ea1af9b
--- /dev/null
+++ b/src/interfaces/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
diff --git a/test/FreelanceEscrow.t.sol b/test/FreelanceEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..395aea99acf5ffecf9942b9c912483c52190ddd4
--- /dev/null
+++ b/test/FreelanceEscrow.t.sol
@@ -0,0 +1,63 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {IERC20} from "../src/interfaces/IERC20.sol";
+import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
+import {EscrowFactory} from "../src/EscrowFactory.sol";
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public override balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 value) external { balanceOf[to] += value; }
+    function approve(address spender, uint256 value) external returns (bool) {
+        allowance[msg.sender][spender] = value;
+        return true;
+    }
+    function transfer(address to, uint256 value) external returns (bool) {
+        if (balanceOf[msg.sender] < value) return false;
+        balanceOf[msg.sender] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 value) external returns (bool) {
+        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
+        allowance[from][msg.sender] -= value;
+        balanceOf[from] -= value;
+        balanceOf[to] += value;
+        return true;
+    }
+}
+
+contract FreelanceEscrowTest {
+    MockUSDC private usdc;
+    EscrowFactory private factory;
+    address private constant FREELANCER = address(0xBEEF);
+    address private constant ARBITRATOR = address(0xA11CE);
+    uint256 private constant AMOUNT = 2_000e6;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        factory = new EscrowFactory(usdc);
+        usdc.mint(address(this), AMOUNT);
+    }
+
+    function testFundEscrow() public {
+        FreelanceEscrow escrow = _create();
+        usdc.approve(address(escrow), AMOUNT);
+        escrow.fund();
+        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded");
+        require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
+    }
+
+    function testRejectsAmountOutsideRange() public {
+        (bool ok,) = address(factory).call(
+            abi.encodeCall(factory.createEscrow, (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0)))
+        );
+        require(!ok, "accepted below-minimum amount");
+    }
+
+    function _create() private returns (FreelanceEscrow) {
+        return factory.createEscrow(FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1"));
+    }
+}

tokens used
37,670
````

## final message

Built the Foundry escrow project.

- [FreelanceEscrow.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/FreelanceEscrow.sol): USDC funding, delivery, release, disputes, arbitrator resolution, and reentrancy protection.
- [EscrowFactory.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/src/EscrowFactory.sol): creates one escrow per job and enforces $2,000–$50,000 USDC limits.
- [README.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/README.md): local test, Sepolia deployment, mainnet deployment, and job-creation commands.
- Deployment script: [Deploy.s.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T013927Z-codex-with-skill-2/gas-goal-001/script/Deploy.s.sol).

Verified with `forge test`: 2 passing tests.

Recommended production network: Ethereum mainnet with native USDC, appropriate for infrequent $2k–$50k custody actions. The README includes Circle’s official USDC addresses for Sepolia and mainnet; verify them before deploy. [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

Before real funds: have the contracts independently audited and establish the arbitrator’s legal and operational process.
