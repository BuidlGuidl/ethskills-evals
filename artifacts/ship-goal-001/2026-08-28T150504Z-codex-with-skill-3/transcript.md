OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048e7-2cc5-7891-a425-4803fa474d84
--------
user
Build the first version of Toolshed, a lending library for a neighborhood
association with about 300 members.

How it works: members list tools they own — a photo, what it is, condition
notes. Another member asks to borrow one for a few days and puts down a
deposit in USDC, which they get back when they return it. Tools come back late
a lot, so there's a daily late fee that comes out of the deposit and goes to
the owner. Members build up a track record — how many loans, how many late
returns — and the browse screen sorts by that, so the reliable people get lent
to first.

Work in this directory. Ship what a developer needs to run this: the code, and
a README.md covering the architecture, how to deploy it, and what a developer
has to do to get it running. Keep everything you write in ordinary source
folders here — nothing you want us to read should end up under lib/, dist/,
build/ or out/, which we treat as generated.

2026-08-28T15:05:05.216546Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048e7-2cc5-7891-a425-4803fa474d84.tmp-1787929504971721156: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this MVP needs explicit choices about what belongs onchain, who can transition loan state, incentives, one launch chain, and a deployment runbook. I’ll apply those decisions directly to the implementation and README.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: ship
description: "Scope a dApp or MVP and make it ready to build and release: decide the onchain boundary, minimal contract surface, state-transition callers and incentives, one launch chain, and the deployment runbook. Use before implementation or when a build lacks these decisions. Route detailed implementation, deployment, and audit work to their focused skills."
---

# Ship a dApp

Before coding, write down the smallest vertical slice that can ship. Decide what
is onchain, how many custom contracts it needs, who advances every state
transition, and one deployment target. Do not expand into a full application or
fetch every related skill before this plan is concrete.

## Architecture

Put only trustless ownership, value transfer, composability, censorship
resistance, or permanent commitments onchain. Keep profiles, descriptions,
media, search, filtering, and frequently changing rules in an offchain store;
put a content hash or URI onchain only when verification needs it.

Treat reputation and rankings as derived data. Emit the facts needed to compute
them, then calculate and sort offchain. Do not maintain a computed score,
leaderboard, or paginated ranking in contract storage merely to serve a browse
screen. Recording counters that settlement already needs is fine.

Prefer existing audited protocols and primitives. Most MVPs need zero to two
custom contracts, and three is the upper bound before reducing scope. Do not add a
factory, escrow, router, or fee-splitter unless its separate trust boundary is
required by the product.

When integrating a deployed protocol, use a verified address from the relevant
chain's official documentation or the `addresses` skill. Never invent or infer
an address: a wrong address can send approvals or funds to an attacker.

## State transitions

Contracts do not run on schedules. For each state-changing function, record:

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `claimPayout()` | recipient | receives the payout | funds remain claimable |
| permissionless settlement | keeper or participant | explicit fee or direct benefit | settlement waits |

Naming a permissionless caller is not an incentive. Identify the caller's
benefit and the source of any keeper fee. Prefer self-serve or permissionless
paths over an owner-only cron job; automation may be a convenience, but it must
not be the only liveness path.

Include the completed transition table in the project README, especially for
every function that moves funds.

## Chain and deployment decision

Choose one target chain for the first release and state why its capabilities fit
the product. Measure current fees when cost affects the decision; do not rely on
remembered gas prices. An L2 should be selected for a concrete product fit such
as its distribution, liquidity, account abstraction, or ecosystem—not merely
because “Ethereum is expensive.”

Before calling the MVP shippable, the README must name the target and contain
the exact deploy and verification commands, required environment variables,
contract ownership destination, and a small post-deploy transaction to verify
the path end to end. Do not leave the network or deployment procedure as TBD.

## Minimal ship checklist

- Onchain/offchain boundary is explicit, including where rankings are computed.
- Custom contract list is concrete and no larger than the MVP requires.
- Every state transition has a caller, incentive, and safe no-caller outcome.
- One target chain is selected for a product-specific reason.
- Tests cover custom logic and external integrations use a fork.
- README contains the transition table and executable deployment runbook.
- Contracts are verified and production ownership goes to the intended multisig.
- A fresh reviewer checks the finished vertical slice before launch.

Fetch another focused skill only when the plan reaches that phase and needs its
details—for example `addresses`, `l2s`, `gas`, `security`, `testing`,
`frontend-ux`, `frontend-playbook`, or `qa`. Skills are available at
`https://ethskills.com/<skill>/SKILL.md`. `ship` owns the product and release
decisions; use `frontend-playbook` for detailed hosting/deployment mechanics and
`qa` for the independent pre-launch review. Stop when the requested vertical
slice and its runbook are complete.

exec
/bin/bash -lc "pwd && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,240p' && find . -maxdepth 2 -type f -name 'AGENTS.md' -print" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
TASK.md

codex
The workspace is effectively empty, so I’m treating this as a greenfield vertical slice. The smallest coherent version will use one escrow contract for USDC/deadlines/late-fee settlement, while tool photos, descriptions, requests, and browse ranking stay in the web app’s database and reputation is derived from emitted loan events.
exec
/bin/bash -lc "sed -n '1,240p' TASK.md && node --version && npm --version && forge --version || true && git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 91ms:
10.9.7
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/.env.example
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/.gitignore
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/package.json
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/contracts/ToolshedEscrow.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}

codex
The contract lifecycle is now concrete: borrower funds, owner activates at handoff, owner confirms the return, and a neighborhood multisig can arbitrate a disputed return. Late fees are capped by the deposit, and all payout state is finalized before token transfers. I’m now wiring the runnable member/listing/request experience around that boundary.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/public/index.html
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/server.js
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/store.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..ad03b1b55bf6a4c956aef03bb255f502eb106e32
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..ad03b1b55bf6a4c956aef03bb255f502eb106e32
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}

exec
/bin/bash -lc "cast sig 'approve(address,uint256)' && cast sig 'fundLoan(bytes32,address,uint64,uint128,uint128,bytes32)' && cast sig 'activateLoan(bytes32)' && cast sig 'cancelLoan(bytes32)' && cast sig 'confirmReturn(bytes32)'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 32ms:
0x7091ebc2
0x59694e14
0xd12c1201
0x82aaabb7

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..ad03b1b55bf6a4c956aef03bb255f502eb106e32
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/public/app.js
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/public/style.css
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/server.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/test/contracts/ToolshedEscrow.t.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/test/store.test.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

codex
The full vertical slice is in place: listings and requests, reliability ordering, wallet-driven USDC escrow actions, contract tests, local run instructions, and an exact Base Sepolia deployment path. I’m at the verification pass now, including contract compilation and end-to-end API checks; I’ll fix anything those expose rather than hand off an untested scaffold.
exec
/bin/bash -lc 'npm test && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 415ms:

> toolshed@0.1.0 test
> node --test test/*.test.js

TAP version 13
# Subtest: reliability counts completed loans and late returns
ok 1 - reliability counts completed loans and late returns
  ---
  duration_ms: 1.039218
  type: 'test'
  ...
# Subtest: new members have no manufactured score
ok 2 - new members have no manufactured score
  ---
  duration_ms: 0.123902
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 53.849828
Compiling 2 files with Solc 0.8.26
Solc 0.8.26 finished in 187.77ms
Compiler run successful!
2026-08-28T15:09:33.687054Z  WARN evm::traces::external: etherscan config not found

Ran 7 tests for test/contracts/ToolshedEscrow.t.sol:ToolshedEscrowTest
[PASS] testAdminCanResolveDisputeAtDocumentedTime() (gas: 186604)
[PASS] testBorrowerCanCancelBeforeHandoff() (gas: 131856)
[PASS] testCannotCancelActiveLoan() (gas: 171307)
[PASS] testLateFeeIsCappedAtDeposit() (gas: 184085)
[PASS] testOnTimeReturnRefundsFullDeposit() (gas: 160648)
[PASS] testPartialDayRoundsUpAndPaysOwner() (gas: 185717)
[PASS] testStrangerCannotSettle() (gas: 171166)
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 1.05ms (1.93ms CPU time)

Ran 1 test suite in 7.77ms (1.05ms CPU time): 7 tests passed, 0 failed, 0 skipped (7 total tests)
2026-08-28T15:09:33.695636Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

exec
/bin/bash -lc 'PORT=3217 DATA_FILE=/tmp/toolshed-smoke.json INVITE_CODE=test node src/server.js' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

exec
/bin/bash -lc "curl -sS http://localhost:3217/api/config && curl -sS -X POST http://localhost:3217/api/join -H 'content-type: application/json' --data '{\"name\":\"Sam\",\"inviteCode\":\"test\",\"wallet\":\"0x1111111111111111111111111111111111111111\"}'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 12ms:
{"token":"12c8faf2d953342ec4c77475340cbaee2e9eb389c37ee781","member":{"id":"4d81ddbb-3d8f-410c-aa20-d77f4a5a06ca","name":"Sam","wallet":"0x1111111111111111111111111111111111111111","joinedAt":"2026-08-28T15:09:47.034Z"}}
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

 exited 1 in 11423ms:
Toolshed running at http://localhost:3217
^C
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

exec
/bin/bash -lc 'git status --short && git diff --check && find . -maxdepth 3 -type f | sort' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 0ms:
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..492ff515eff3d70344e5cdcff2d714d07fe3f30d
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});return ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]})}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval submitted; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.createdAt).getTime()-r.days*86400000)/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..20fa2c767d9830a5647c823015a28f62caec0cee
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/public/app.js
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/server.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..05c276abc541d39ebde4eacf9556a2ed439ab78c
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.dueAt)r.dueAt=clean(input.dueAt);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..05c276abc541d39ebde4eacf9556a2ed439ab78c
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.dueAt)r.dueAt=clean(input.dueAt);if(input.status==='returned')r.lateDays=Math.max(0,Number(input.lateDays)||0);await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/server.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..8611f5b5788f7dd1dc951277c19c8fc7135f1b26
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.dueAt)r.dueAt=clean(input.dueAt);if(input.status==='returned')r.lateDays=Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000));await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..8611f5b5788f7dd1dc951277c19c8fc7135f1b26
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.dueAt)r.dueAt=clean(input.dueAt);if(input.status==='returned')r.lateDays=Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000));await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/src/server.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..d53e67fe1009f533761ba37493784018ae576fef
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='funded')r.dueAt=new Date(Date.now()+r.days*86400000).toISOString();if(input.status==='returned')r.lateDays=Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000));await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..d53e67fe1009f533761ba37493784018ae576fef
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='funded')r.dueAt=new Date(Date.now()+r.days*86400000).toISOString();if(input.status==='returned')r.lateDays=Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000));await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

exec
/bin/bash -lc 'npm test && forge test && git diff --check' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace
 succeeded in 225ms:

> toolshed@0.1.0 test
> node --test test/*.test.js

TAP version 13
# Subtest: reliability counts completed loans and late returns
ok 1 - reliability counts completed loans and late returns
  ---
  duration_ms: 1.098111
  type: 'test'
  ...
# Subtest: new members have no manufactured score
ok 2 - new members have no manufactured score
  ---
  duration_ms: 0.126612
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 55.850592
No files changed, compilation skipped
2026-08-28T15:10:51.461432Z  WARN evm::traces::external: etherscan config not found

Ran 7 tests for test/contracts/ToolshedEscrow.t.sol:ToolshedEscrowTest
[PASS] testAdminCanResolveDisputeAtDocumentedTime() (gas: 186604)
[PASS] testBorrowerCanCancelBeforeHandoff() (gas: 131856)
[PASS] testCannotCancelActiveLoan() (gas: 171307)
[PASS] testLateFeeIsCappedAtDeposit() (gas: 184085)
[PASS] testOnTimeReturnRefundsFullDeposit() (gas: 160648)
[PASS] testPartialDayRoundsUpAndPaysOwner() (gas: 185717)
[PASS] testStrangerCannotSettle() (gas: 171166)
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 721.16µs (1.73ms CPU time)

Ran 1 test suite in 7.98ms (721.16µs CPU time): 7 tests passed, 0 failed, 0 skipped (7 total tests)
2026-08-28T15:10:51.470430Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..d53e67fe1009f533761ba37493784018ae576fef
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='funded')r.dueAt=new Date(Date.now()+r.days*86400000).toISOString();if(input.status==='returned')r.lateDays=Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000));await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

codex
Built the first Toolshed MVP.

Included:

- Member onboarding via association invite code and wallet
- Tool listings with photo URLs and condition notes
- Borrow requests and owner dashboards
- Reliability tracking and sorting
- Browser wallet integration
- USDC escrow contract with deposits, daily late fees, refunds, cancellation, and multisig dispute resolution
- Base Sepolia deployment and verification scripts
- Responsive frontend
- Solidity and Node tests

Start locally:

```bash
cp .env.example .env
set -a && source .env && set +a
npm test
forge test
npm run dev
```

See [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/README.md) for architecture, trust assumptions, deployment commands, lifecycle responsibilities, and the production-readiness checklist.

Verification completed successfully: 2 application tests and 7 contract tests pass.
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..2670f1cb256957d24fa249a5f450b1449c8e9579
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,10 @@
+PORT=3000
+DATA_FILE=./data/toolshed.json
+INVITE_CODE=change-me
+CHAIN_ID=84532
+TOOLSHED_ADDRESS=
+USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7c
+ADMIN_ADDRESS=
+BASE_SEPOLIA_RPC_URL=
+BASESCAN_API_KEY=
+PRIVATE_KEY=
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..a86148fbc8f63000248494bb9e94405218bc90c3
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,6 @@
+.env
+data/
+out/
+cache/
+broadcast/
+node_modules/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a364bcbf5d17c42eacd9dc5c17a60fd75791c91f
--- /dev/null
+++ b/README.md
@@ -0,0 +1,85 @@
+# Toolshed
+
+Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.
+
+## Run locally
+
+Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.
+
+```bash
+cp .env.example .env
+set -a && source .env && set +a
+npm test
+forge test
+npm run dev
+```
+
+Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.
+
+This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.
+
+## Architecture and trust boundary
+
+The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.
+
+`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.
+
+Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.
+
+The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
+| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
+| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
+| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
+| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |
+
+Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.
+
+## Base Sepolia deployment
+
+The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.
+
+Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://…'
+export BASESCAN_API_KEY='…'
+export PRIVATE_KEY='0x…'                 # deployer only
+export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
+export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
+```
+
+Build, test, deploy, and verify in one command:
+
+```bash
+forge test
+npm run deploy:sepolia
+```
+
+The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:
+
+```bash
+npm run verify:sepolia
+```
+
+Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.
+
+### Post-deploy smoke transaction
+
+Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.
+
+## Production checklist
+
+- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
+- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
+- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
+- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
+- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
+- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.
+
+This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1ac41c84fbb42a731afc848254cef4ba8896630d
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,15 @@
+[profile.default]
+src = "src/contracts"
+test = "test/contracts"
+script = "script"
+out = "out"
+libs = []
+solc_version = "0.8.26"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}" }
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..3f133c4b2b4c628586a2ea9701537f8ce311b205
--- /dev/null
+++ b/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "toolshed",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "node --watch src/server.js",
+    "start": "node src/server.js",
+    "test": "node --test test/*.test.js",
+    "test:contracts": "forge test",
+    "deploy:sepolia": "forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify",
+    "verify:sepolia": "forge verify-contract --chain base-sepolia $TOOLSHED_ADDRESS src/contracts/ToolshedEscrow.sol:ToolshedEscrow --constructor-args $(cast abi-encode 'constructor(address,address)' $USDC_ADDRESS $ADMIN_ADDRESS)"
+  },
+  "engines": { "node": ">=22.5" }
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..7d2db8e523b1cbd2a40fd42504474e58b8f92184
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,18 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (ToolshedEscrow deployed) {
+        uint256 key = vm.envUint("PRIVATE_KEY");
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast(key);
+        deployed = new ToolshedEscrow(usdc, admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts/ToolshedEscrow.sol b/src/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..83d54f156c4d242d74e0f66d398b3c42b0d9e469
--- /dev/null
+++ b/src/contracts/ToolshedEscrow.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow for Toolshed. Listings and member data intentionally live offchain.
+contract ToolshedEscrow {
+    enum Status { None, Funded, Active, Settled, Cancelled }
+
+    struct Loan {
+        address borrower;
+        address owner;
+        uint64 dueAt;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        bytes32 metadataHash;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public immutable admin;
+    mapping(bytes32 => Loan) public loans;
+
+    event LoanFunded(bytes32 indexed loanId, address indexed borrower, address indexed owner, uint64 dueAt, uint256 deposit, uint256 dailyLateFee, bytes32 metadataHash);
+    event LoanActivated(bytes32 indexed loanId);
+    event LoanCancelled(bytes32 indexed loanId);
+    event LoanSettled(bytes32 indexed loanId, uint64 returnedAt, uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund, bool arbitrated);
+
+    error Unauthorized();
+    error InvalidLoan();
+    error InvalidTerms();
+    error TransferFailed();
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidTerms();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    function fundLoan(bytes32 loanId, address owner, uint64 dueAt, uint128 deposit, uint128 dailyLateFee, bytes32 metadataHash) external {
+        if (loans[loanId].status != Status.None || owner == address(0) || owner == msg.sender || dueAt <= block.timestamp || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        loans[loanId] = Loan(msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash, Status.Funded);
+        if (!usdc.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();
+        emit LoanFunded(loanId, msg.sender, owner, dueAt, deposit, dailyLateFee, metadataHash);
+    }
+
+    function activateLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelLoan(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Funded) revert InvalidLoan();
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(bytes32 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert Unauthorized();
+        _settle(loanId, uint64(block.timestamp), false);
+    }
+
+    /// @notice Neighborhood multisig resolves a disputed return using the documented handoff time.
+    function resolveReturn(bytes32 loanId, uint64 returnedAt) external {
+        if (msg.sender != admin) revert Unauthorized();
+        if (returnedAt > block.timestamp) revert InvalidTerms();
+        _settle(loanId, returnedAt, true);
+    }
+
+    function previewSettlement(bytes32 loanId, uint64 returnedAt) external view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        return _amounts(loan, returnedAt);
+    }
+
+    function _settle(bytes32 loanId, uint64 returnedAt, bool arbitrated) private {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert InvalidLoan();
+        (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) = _amounts(loan, returnedAt);
+        loan.status = Status.Settled;
+        if (ownerPayout > 0 && !usdc.transfer(loan.owner, ownerPayout)) revert TransferFailed();
+        if (borrowerRefund > 0 && !usdc.transfer(loan.borrower, borrowerRefund)) revert TransferFailed();
+        emit LoanSettled(loanId, returnedAt, lateDays, ownerPayout, borrowerRefund, arbitrated);
+    }
+
+    function _amounts(Loan storage loan, uint64 returnedAt) private view returns (uint256 lateDays, uint256 ownerPayout, uint256 borrowerRefund) {
+        if (returnedAt > loan.dueAt) lateDays = (uint256(returnedAt) - loan.dueAt + 1 days - 1) / 1 days;
+        ownerPayout = lateDays * loan.dailyLateFee;
+        if (ownerPayout > loan.deposit) ownerPayout = loan.deposit;
+        borrowerRefund = loan.deposit - ownerPayout;
+    }
+}
diff --git a/src/public/app.js b/src/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f5e3a464d847b663d7401c7da386dd1cc2a55abd
--- /dev/null
+++ b/src/public/app.js
@@ -0,0 +1,24 @@
+let token=localStorage.toolshedToken||'', me=null, tools=[], config={};
+const $=s=>document.querySelector(s), api=async(path,options={})=>{const res=await fetch(path,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error);return data};
+const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
+const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
+const rep=r=>r.loans?`${r.score}% reliable · ${r.loans} loan${r.loans===1?'':'s'} · ${r.late} late`:'New borrower';
+async function connect(){if(!window.ethereum)throw new Error('Install a wallet extension first');const [account]=await ethereum.request({method:'eth_requestAccounts'});$('#walletInput').value=account;$('#wallet').textContent=`${account.slice(0,6)}…${account.slice(-4)}`;return account.toLowerCase()}
+$('#wallet').onclick=()=>connect().catch(e=>toast(e.message));
+$('#joinForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));const out=await api('/api/join',{method:'POST',body:JSON.stringify(d)});token=out.token;localStorage.toolshedToken=token;await boot()}catch(e){toast(e.message)}};
+async function boot(){config=await api('/api/config');try{me=await api('/api/me')}catch{return}$('#join').hidden=true;$('#app').hidden=false;$('#identity').textContent=`${me.name} · ${rep(me.reputation)}`;await Promise.all([loadTools(),loadRequests()])}
+async function loadTools(){tools=await api('/api/tools');renderTools()}
+function renderTools(){const q=$('#search').value.toLowerCase();$('#tools').innerHTML=tools.filter(t=>t.name.toLowerCase().includes(q)).map(t=>`<article class="card"><img src="${esc(t.photoUrl)}" alt=""><div class="cardbody"><p class="eyebrow">${esc(t.condition)}</p><h2>${esc(t.name)}</h2><p>Owned by ${esc(t.owner.name)}</p><p class="reputation">${rep(t.ownerReputation)}</p>${t.ownerId===me.id?'<span class="tag">Your tool</span>':`<button onclick="borrow('${t.id}')">Request tool</button>`}</div></article>`).join('')||'<p>No matching tools yet.</p>'}
+$('#search').oninput=renderTools;
+window.borrow=id=>{const f=$('#borrowForm');f.reset();f.toolId.value=id;$('#borrowDialog').showModal()};
+$('#borrowForm').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));d.days=Number(d.days);d.deposit=Number(d.deposit);d.dailyLateFee=Number(d.dailyLateFee);await api('/api/requests',{method:'POST',body:JSON.stringify(d)});$('#borrowDialog').close();toast('Request sent to the owner');await loadRequests()}catch(e){toast(e.message)}};
+$('#toolForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/tools',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();toast('Tool listed');document.querySelector('[data-tab=browse]').click();await loadTools()}catch(e){toast(e.message)}};
+document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['browse','list','loans'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab);if(b.dataset.tab==='loans')loadRequests()});
+const word=v=>BigInt(v).toString(16).padStart(64,'0'), addr=a=>a.toLowerCase().replace('0x','').padStart(64,'0'), bytes32=s=>s.replace('0x','').padStart(64,'0');
+async function tx(to,data){if(!config.contract)throw new Error('TOOLSHED_ADDRESS is not configured');const account=await connect();const chain='0x'+config.chainId.toString(16);if(await ethereum.request({method:'eth_chainId'})!==chain)await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:chain}]});const hash=await ethereum.request({method:'eth_sendTransaction',params:[{from:account,to,data}]});for(let i=0;i<120;i++){const receipt=await ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});if(receipt){if(BigInt(receipt.status)!==1n)throw new Error('Transaction reverted');return hash}await new Promise(r=>setTimeout(r,1000))}throw new Error('Transaction is still pending; refresh before trying again')}
+async function fund(r){try{const account=await connect();if(account!==me.wallet)throw new Error('Connect your registered wallet');const units=BigInt(Math.round(r.deposit*1e6)),fee=BigInt(Math.round(r.dailyLateFee*1e6));await tx(config.usdc,'0x095ea7b3'+addr(config.contract)+word(units));toast('Approval confirmed; confirm funding next');const loanId='0x'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');const due=Math.floor(Date.now()/1000)+r.days*86400;const meta=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id)));const hash='0x'+[...meta].map(x=>x.toString(16).padStart(2,'0')).join('');await tx(config.contract,'0x7091ebc2'+bytes32(loanId)+addr(r.owner.wallet)+word(due)+word(units)+word(fee)+bytes32(hash));await status(r.id,'funded',{loanId,dueAt:new Date(due*1000).toISOString()});}catch(e){toast(e.message)}}
+async function contractAction(r,next,selector){try{await tx(config.contract,selector+bytes32(r.loanId));await status(r.id,next,next==='returned'?{lateDays:Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000))}:{})}catch(e){toast(e.message)}}
+async function status(id,next,extra={}){await api(`/api/requests/${id}/status`,{method:'PATCH',body:JSON.stringify({status:next,...extra})});toast(`Loan ${next}`);await loadRequests()}
+window.loanAction=(id,action)=>{const r=window.requests.find(x=>x.id===id);if(action==='fund')return fund(r);if(action==='decline')return status(id,'declined');if(action==='activate')return contractAction(r,'active','0x59694e14');if(action==='cancel')return contractAction(r,'cancelled','0xd12c1201');if(action==='return')return contractAction(r,'returned','0x82aaabb7')};
+async function loadRequests(){window.requests=await api('/api/requests');$('#loanCount').textContent=window.requests.length||'';$('#requests').innerHTML=window.requests.map(r=>{let actions='';if(r.status==='requested'&&r.borrowerId===me.id)actions=`<button onclick="loanAction('${r.id}','fund')">Fund ${r.deposit} USDC</button>`;if(r.status==='requested'&&r.ownerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','decline')">Decline</button>`;if(r.status==='funded'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','activate')">Confirm handoff</button>`;if(r.status==='funded'&&r.borrowerId===me.id)actions=`<button class="secondary" onclick="loanAction('${r.id}','cancel')">Cancel & refund</button>`;if(r.status==='active'&&r.ownerId===me.id)actions=`<button onclick="loanAction('${r.id}','return')">Confirm return</button>`;return `<article class="loan"><div><span class="tag">${esc(r.status)}</span><h2>${esc(r.tool.name)}</h2><p>${r.borrowerId===me.id?'Borrowing from '+esc(r.owner.name):'Requested by '+esc(r.borrower.name)}</p><p class="reputation">Borrower: ${rep(r.borrowerReputation)}</p></div><div><strong>${r.days} days · ${r.deposit} USDC</strong><p>${r.dailyLateFee} USDC / late day</p>${actions}</div></article>`}).join('')||'<p>No loan activity yet.</p>'}
+boot().catch(e=>toast(e.message));
diff --git a/src/public/index.html b/src/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c60f50d219574cc783148533103fb1d0f1650fb2
--- /dev/null
+++ b/src/public/index.html
@@ -0,0 +1,9 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/style.css"></head><body>
+<header><a class="brand" href="#">Toolshed</a><span>Neighborhood tools, shared with trust.</span><button id="wallet">Connect wallet</button></header>
+<main><section id="join" class="panel"><p class="eyebrow">MEMBERS ONLY</p><h1>Borrow the tool.<br>Return the favor.</h1><p>Join with your neighborhood association invite code and wallet.</p><form id="joinForm"><label>Name<input name="name" required></label><label>Invite code<input name="inviteCode" type="password" required></label><label>Wallet<input name="wallet" id="walletInput" placeholder="0x…" required></label><button>Enter Toolshed</button></form></section>
+<div id="app" hidden><nav><button data-tab="browse" class="active">Browse</button><button data-tab="list">List a tool</button><button data-tab="loans">Loans <span id="loanCount"></span></button><span id="identity"></span></nav>
+<section id="browse"><div class="title"><div><p class="eyebrow">AVAILABLE NEARBY</p><h1>What do you need?</h1></div><input id="search" placeholder="Search tools"></div><div id="tools" class="grid"></div></section>
+<section id="list" hidden class="panel narrow"><h2>List a tool</h2><form id="toolForm"><label>What is it?<input name="name" required></label><label>Photo URL<input name="photoUrl" type="url" required></label><label>Condition notes<textarea name="condition" required></textarea></label><button>Publish listing</button></form></section>
+<section id="loans" hidden><div class="title"><div><p class="eyebrow">YOUR ACTIVITY</p><h1>Loans & requests</h1></div></div><div id="requests"></div></section></div></main>
+<dialog id="borrowDialog"><form method="dialog" id="borrowForm"><button class="close" value="cancel">×</button><h2>Request to borrow</h2><input name="toolId" type="hidden"><label>Days<input name="days" type="number" min="1" max="30" value="3" required></label><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" value="25" required></label><label>Late fee / day (USDC)<input name="dailyLateFee" type="number" min="0" step="0.01" value="3" required></label><button value="default">Send request</button><p class="hint">Deposit is funded onchain only after the owner agrees.</p></form></dialog>
+<div id="toast"></div><script type="module" src="/app.js"></script></body></html>
diff --git a/src/public/style.css b/src/public/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..88ae44b563ea560db63ee2c95b908ccb364b6b30
--- /dev/null
+++ b/src/public/style.css
@@ -0,0 +1 @@
+:root{--ink:#17251d;--paper:#f3f0e6;--green:#245b3b;--lime:#d9f36b;--line:#c8c8b9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,sans-serif}header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:25px;padding:0 5vw}.brand{font:bold 25px Georgia;color:var(--ink);text-decoration:none}header span{color:#657067;flex:1}button{background:var(--green);color:white;border:0;border-radius:4px;padding:11px 17px;font-weight:700;cursor:pointer}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}main{max-width:1200px;margin:auto;padding:45px 28px}.panel{background:#fff;border:1px solid var(--line);padding:45px;max-width:680px;margin:30px auto}.narrow{max-width:620px}h1{font:clamp(42px,7vw,82px)/.98 Georgia;margin:8px 0 25px;letter-spacing:-3px}h2{font:29px/1.1 Georgia;margin:8px 0}.eyebrow{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#667368}form{display:grid;gap:16px;margin-top:28px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;padding:12px;border:1px solid var(--line);background:#faf9f5;border-radius:3px}textarea{min-height:110px}nav{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);margin-bottom:55px}nav button{background:transparent;color:#647067;border-radius:0;padding:14px}nav button.active{color:var(--ink);border-bottom:3px solid var(--green)}#identity{margin-left:auto;color:#647067;font-size:13px}.title{display:flex;align-items:end;justify-content:space-between}.title h1{font-size:56px}.title input{margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}.card{background:white;border:1px solid var(--line)}.card img{width:100%;height:190px;object-fit:cover;background:#ddd}.cardbody{padding:20px}.cardbody button{width:100%;margin-top:10px}.reputation{color:#607067;font-size:13px}.tag{display:inline-block;background:var(--lime);color:var(--ink);padding:4px 8px;font-size:11px;font-weight:bold;text-transform:uppercase}.loan{background:white;border:1px solid var(--line);display:flex;justify-content:space-between;gap:25px;padding:25px;margin:12px 0}.loan>div:last-child{text-align:right}dialog{border:1px solid var(--line);padding:30px;width:min(480px,90vw)}dialog::backdrop{background:#17251daa}.close{background:transparent;color:var(--ink);float:right;font-size:24px}.hint{font-size:12px;color:#68736c}#toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,100px);background:var(--ink);color:white;padding:12px 20px;transition:.2s}#toast.show{transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:650px){header>span{display:none}main{padding:25px 15px}.panel{padding:25px}.title{display:block}.title h1{font-size:44px}.loan{display:block}.loan>div:last-child{text-align:left}nav{overflow:auto}#identity{display:none}}
diff --git a/src/server.js b/src/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..d53e67fe1009f533761ba37493784018ae576fef
--- /dev/null
+++ b/src/server.js
@@ -0,0 +1,57 @@
+import http from 'node:http';
+import { readFile } from 'node:fs/promises';
+import { extname, join, resolve } from 'node:path';
+import { randomBytes } from 'node:crypto';
+import { Store, reliability } from './store.js';
+
+const port = Number(process.env.PORT || 3000);
+const publicDir = resolve('src/public');
+const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
+const sessions = new Map();
+await store.load();
+
+const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
+const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
+const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
+const clean = value => String(value || '').trim();
+
+async function api(req, res, path) {
+  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
+  if (req.method === 'POST' && path === '/api/join') {
+    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
+    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
+    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
+    let member = store.data.members.find(m => m.wallet === wallet);
+    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
+    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
+  }
+  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
+  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
+  if (req.method === 'GET' && path === '/api/tools') {
+    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
+    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
+    return json(res, 200, tools);
+  }
+  if (req.method === 'POST' && path === '/api/tools') {
+    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
+    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
+  }
+  if (req.method === 'GET' && path === '/api/requests') {
+    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
+    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
+  }
+  if (req.method === 'POST' && path === '/api/requests') {
+    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
+    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
+    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
+  }
+  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
+  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
+    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
+    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
+    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='funded')r.dueAt=new Date(Date.now()+r.days*86400000).toISOString();if(input.status==='returned')r.lateDays=Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000));await store.save();return json(res,200,r);}
+  return json(res,404,{error:'Not found'});
+}
+
+const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
+server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
diff --git a/src/store.js b/src/store.js
new file mode 100644
index 0000000000000000000000000000000000000000..7ba886114a09fb107f79464d755eff6b28e03e1d
--- /dev/null
+++ b/src/store.js
@@ -0,0 +1,23 @@
+import { mkdir, readFile, writeFile } from 'node:fs/promises';
+import { dirname } from 'node:path';
+import { randomUUID } from 'node:crypto';
+
+export class Store {
+  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
+  async load() {
+    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
+    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
+  }
+  async save() {
+    await mkdir(dirname(this.file), { recursive: true });
+    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
+    return this.queue;
+  }
+  id() { return randomUUID(); }
+}
+
+export function reliability(member, requests) {
+  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
+  const late = completed.filter(r => r.lateDays > 0).length;
+  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
+}
diff --git a/test/contracts/ToolshedEscrow.t.sol b/test/contracts/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2908cbcf2987020c8396b3e4ff5cdaf3ddd92ace
--- /dev/null
+++ b/test/contracts/ToolshedEscrow.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.26;
+
+import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address=>uint256) public balanceOf;
+    mapping(address=>mapping(address=>uint256)) public allowance;
+    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
+    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
+    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
+    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token; ToolshedEscrow escrow;
+    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
+    bytes32 id=keccak256("loan-1");
+
+    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
+    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}
+
+    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
+    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
+    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
+    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
+    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
+    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
+    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
+}
diff --git a/test/store.test.js b/test/store.test.js
new file mode 100644
index 0000000000000000000000000000000000000000..e9fbff36ff8e60908fc7ab201bedac7a6d4d2ef2
--- /dev/null
+++ b/test/store.test.js
@@ -0,0 +1,6 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { reliability } from '../src/store.js';
+
+test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
+test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));

tokens used
68,109
Built the first Toolshed MVP.

Included:

- Member onboarding via association invite code and wallet
- Tool listings with photo URLs and condition notes
- Borrow requests and owner dashboards
- Reliability tracking and sorting
- Browser wallet integration
- USDC escrow contract with deposits, daily late fees, refunds, cancellation, and multisig dispute resolution
- Base Sepolia deployment and verification scripts
- Responsive frontend
- Solidity and Node tests

Start locally:

```bash
cp .env.example .env
set -a && source .env && set +a
npm test
forge test
npm run dev
```

See [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-3/workspace/README.md) for architecture, trust assumptions, deployment commands, lifecycle responsibilities, and the production-readiness checklist.

Verification completed successfully: 2 application tests and 7 contract tests pass.
