Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0357b-c16b-73c3-8299-5a9fc69de4f9
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
2026-08-24T20:34:58.237471Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a0357b-c16b-73c3-8299-5a9fc69de4f9.tmp-1787603698036826120: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the starter workspace and its existing conventions first, then I’ll implement the smallest complete on-chain/app version and verify the documented run path.
exec
/bin/bash -lc "pwd && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,160p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && command -v forge || true && command -v node || true && command -v yarn || true && git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace
 succeeded in 8ms:
 M ../../../../skills/ship/SKILL.md
 M ../../../../tasks/ship-quiz-001.yaml
 M ../../../../tasks/ship-quiz-002.yaml
 M ../../../../tasks/ship-quiz-004.yaml
?? ../../../../.pnp.cjs
?? ../../../../.pnp.loader.mjs
?? ../../../building-blocks-goal-001/
?? ../../../building-blocks-quiz-001/
?? ../../../building-blocks-quiz-002/
?? ../../../building-blocks-quiz-003/
?? ../../../building-blocks-quiz-004/
?? ../../../indexing-goal-001/
?? ../../../indexing-quiz-001/
?? ../../../indexing-quiz-002/
?? ../../../indexing-quiz-003/
?? ../../2026-08-24T195338Z-codex-no-skill-1/
?? ../../2026-08-24T195350Z-codex-no-skill-2/
?? ../../2026-08-24T195402Z-codex-no-skill-3/
?? ../../2026-08-24T195416Z-codex-with-skill-1/
?? ../../2026-08-24T195427Z-codex-with-skill-2/
?? ../../2026-08-24T195439Z-codex-with-skill-3/
?? ../../2026-08-24T202239Z-codex-no-skill-1/
?? ../../2026-08-24T202707Z-codex-no-skill-2/
?? ../
?? ../../../ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/
?? ../../../ship-quiz-001/2026-08-24T195005Z-codex-no-skill-2/
?? ../../../ship-quiz-001/2026-08-24T195008Z-codex-no-skill-3/
?? ../../../ship-quiz-001/2026-08-24T195016Z-codex-with-skill-1/
?? ../../../ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/
?? ../../../ship-quiz-001/2026-08-24T195026Z-codex-with-skill-2/
?? ../../../ship-quiz-001/2026-08-24T195035Z-codex-with-skill-3/
?? ../../../ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/
?? ../../../ship-quiz-001/2026-08-24T195357Z-codex-with-skill-1/
?? ../../../ship-quiz-001/2026-08-24T195542Z-codex-with-skill-2/
?? ../../../ship-quiz-001/2026-08-24T195725Z-codex-with-skill-3/
?? ../../../ship-quiz-002/2026-08-24T195044Z-codex-no-skill-1/
?? ../../../ship-quiz-002/2026-08-24T195055Z-codex-no-skill-2/
?? ../../../ship-quiz-002/2026-08-24T195105Z-codex-no-skill-3/
?? ../../../ship-quiz-002/2026-08-24T195115Z-codex-with-skill-1/
?? ../../../ship-quiz-002/2026-08-24T195125Z-codex-with-skill-2/
?? ../../../ship-quiz-002/2026-08-24T195134Z-codex-with-skill-3/
?? ../../../ship-quiz-002/2026-08-24T195901Z-codex-no-skill-1/
?? ../../../ship-quiz-002/2026-08-24T200010Z-codex-no-skill-2/
?? ../../../ship-quiz-002/2026-08-24T200119Z-codex-no-skill-3/
?? ../../../ship-quiz-002/2026-08-24T200240Z-codex-with-skill-1/
?? ../../../ship-quiz-002/2026-08-24T200401Z-codex-with-skill-2/
?? ../../../ship-quiz-002/2026-08-24T200511Z-codex-with-skill-3/
?? ../../../ship-quiz-003/2026-08-24T195144Z-codex-no-skill-1/
?? ../../../ship-quiz-003/2026-08-24T195154Z-codex-no-skill-2/
?? ../../../ship-quiz-003/2026-08-24T195203Z-codex-no-skill-3/
?? ../../../ship-quiz-003/2026-08-24T195212Z-codex-with-skill-1/
?? ../../../ship-quiz-003/2026-08-24T195220Z-codex-with-skill-2/
?? ../../../ship-quiz-003/2026-08-24T195229Z-codex-with-skill-3/
?? ../../../ship-quiz-003/2026-08-24T200631Z-codex-no-skill-1/
?? ../../../ship-quiz-003/2026-08-24T200905Z-codex-no-skill-2/
?? ../../../ship-quiz-003/2026-08-24T201021Z-codex-no-skill-3/
?? ../../../ship-quiz-003/2026-08-24T201156Z-codex-with-skill-1/
?? ../../../ship-quiz-003/2026-08-24T201319Z-codex-with-skill-2/
?? ../../../ship-quiz-003/2026-08-24T201438Z-codex-with-skill-3/
?? ../../../ship-quiz-004/2026-08-24T195238Z-codex-no-skill-1/
?? ../../../ship-quiz-004/2026-08-24T195248Z-codex-no-skill-2/
?? ../../../ship-quiz-004/2026-08-24T195257Z-codex-no-skill-3/
?? ../../../ship-quiz-004/2026-08-24T195307Z-codex-with-skill-1/
?? ../../../ship-quiz-004/2026-08-24T195317Z-codex-with-skill-2/
?? ../../../ship-quiz-004/2026-08-24T195328Z-codex-with-skill-3/
?? ../../../ship-quiz-004/2026-08-24T201550Z-codex-no-skill-1/
?? ../../../ship-quiz-004/2026-08-24T201702Z-codex-no-skill-2/
?? ../../../ship-quiz-004/2026-08-24T201807Z-codex-no-skill-3/
?? ../../../ship-quiz-004/2026-08-24T201922Z-codex-with-skill-1/
?? ../../../ship-quiz-004/2026-08-24T202023Z-codex-with-skill-2/
?? ../../../ship-quiz-004/2026-08-24T202129Z-codex-with-skill-3/
?? ../../../tools-goal-001/
?? ../../../tools-quiz-001/
?? ../../../tools-quiz-003/

2026-08-24T20:35:11.109748Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
The workspace is intentionally bare, so I’m treating this as a compact reference implementation: a Solidity escrow contract for membership, listings, requests, deposits, returns, late fees, and borrower reputation; plus a small TypeScript client layer that reconstructs the browse view and ranks listings by owner reliability. I’ll keep metadata off-chain via URIs while all money and loan state remain on-chain.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..77ba02870914b9df5ab8e79a6ef7c7a4668f503d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,33 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};

diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..77ba02870914b9df5ab8e79a6ef7c7a4668f503d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,33 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};

2026-08-24T20:36:17.125604Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ea331d034dd4928be6a69d3a74993de3f1e14853
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,76 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(usdc, address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure { require(actual == expected, "not equal"); }
+}

diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ea331d034dd4928be6a69d3a74993de3f1e14853
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,76 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(usdc, address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure { require(actual == expected, "not equal"); }
+}

2026-08-24T20:37:05.046718Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
The core flow is now implemented, including the subtle accounting rules: the loan duration starts when the owner accepts, partial late days round up, fees are capped at the escrow, and reputation updates only after a completed return. I’m compiling and running settlement tests now.
exec
/bin/bash -lc 'forge fmt --check && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace
 exited 1 in 11ms:
Diff in contracts/Toolshed.sol:
8   8    | 
9   9    | /// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
10  10   | contract Toolshed {
11       |-    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
    11   |+    enum LoanStatus {
    12   |+        None,
    13   |+        Requested,
    14   |+        Active,
    15   |+        Returned,
    16   |+        Rejected,
    17   |+        Cancelled
    18   |+    }
12  19   | 
13  20   |     struct Tool {
14  21   |         address owner;
--------------------------------------------------------------------------------28  35   |         LoanStatus status;
29  36   |     }
30  37   | 
31       |-    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
    38   |+    struct Reputation {
    39   |+        uint64 completedLoans;
    40   |+        uint64 lateReturns;
    41   |+    }
32  42   | 
33  43   |     uint256 public constant DAY = 1 days;
34  44   |     IERC20 public immutable usdc;
--------------------------------------------------------------------------------44  54   |     event MemberSet(address indexed member, bool enabled);
45  55   |     event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
46  56   |     event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
47       |-    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
    57   |+    event LoanRequested(
    58   |+        uint256 indexed loanId,
    59   |+        uint256 indexed toolId,
    60   |+        address indexed borrower,
    61   |+        uint64 dueAt,
    62   |+        uint256 deposit,
    63   |+        uint256 lateFeePerDay
    64   |+    );
48  65   |     event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
49  66   |     event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
50  67   |     event LoanRejected(uint256 indexed loanId);
--------------------------------------------------------------------------------55  72   |     error InvalidState();
56  73   |     error TransferFailed();
57  74   | 
58       |-    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
59       |-    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
    75   |+    modifier onlyAdmin() {
    76   |+        if (msg.sender != admin) revert Unauthorized();
    77   |+        _;
    78   |+    }
    79   |+    modifier onlyMember() {
    80   |+        if (!members[msg.sender]) revert Unauthorized();
    81   |+        _;
    82   |+    }
60  83   | 
61  84   |     constructor(IERC20 usdc_, address admin_) {
62  85   |         if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
--------------------------------------------------------------------------------94  117  |     }
95  118  | 
96  119  |     /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
97       |-    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
    120  |+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay)
    121  |+        external
    122  |+        onlyMember
    123  |+        returns (uint256 loanId)
    124  |+    {
98  125  |         Tool storage tool = tools[toolId];
99  126  |         if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
100 127  |         if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
101 128  |         if (activeLoanForTool[toolId] != 0) revert InvalidState();
102 129  |         loanId = nextLoanId++;
103 130  |         uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
104      |-        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
    131  |+        loans[loanId] = Loan(
    132  |+            toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested
    133  |+        );
105 134  |         activeLoanForTool[toolId] = loanId;
106 135  |         _safeTransferFrom(msg.sender, address(this), deposit);
107 136  |         emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);

Diff in contracts/MockUSDC.sol:
8   8    |     mapping(address => uint256) public balanceOf;
9   9    |     mapping(address => mapping(address => uint256)) public allowance;
10  10   | 
11       |-    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
12       |-    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
13       |-    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
    11   |+    function mint(address to, uint256 amount) external {
    12   |+        balanceOf[to] += amount;
    13   |+    }
    14   |+
    15   |+    function approve(address spender, uint256 amount) external returns (bool) {
    16   |+        allowance[msg.sender][spender] = amount;
    17   |+        return true;
    18   |+    }
    19   |+
    20   |+    function transfer(address to, uint256 amount) external returns (bool) {
    21   |+        _move(msg.sender, to, amount);
    22   |+        return true;
    23   |+    }
    24   |+
14  25   |     function transferFrom(address from, address to, uint256 amount) external returns (bool) {
15  26   |         uint256 allowed = allowance[from][msg.sender];
16  27   |         require(allowed >= amount, "allowance");
--------------------------------------------------------------------------------18  29   |         _move(from, to, amount);
19  30   |         return true;
20  31   |     }
    32   |+
21  33   |     function _move(address from, address to, uint256 amount) private {
22  34   |         require(balanceOf[from] >= amount, "balance");
23  35   |         balanceOf[from] -= amount;

Diff in test/Toolshed.t.sol:
72  72   |         id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
73  73   |     }
74  74   | 
75       |-    function _assertEq(uint256 actual, uint256 expected) private pure { require(actual == expected, "not equal"); }
    75   |+    function _assertEq(uint256 actual, uint256 expected) private pure {
    76   |+        require(actual == expected, "not equal");
    77   |+    }
76  78   | }

Diff in script/Deploy.s.sol:
3   3    | 
4   4    | import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
5   5    | 
6        |-interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
    6    |+interface Vm {
    7    |+    function envAddress(string calldata) external returns (address);
    8    |+    function startBroadcast() external;
    9    |+    function stopBroadcast() external;
    10   |+}
7   11   | 
8   12   | contract Deploy {
9   13   |     Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    14   |+
10  15   |     function run() external returns (Toolshed deployed) {
11  16   |         address usdc = vm.envAddress("USDC_ADDRESS");
12  17   |         address admin = vm.envAddress("ADMIN_ADDRESS");

diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ea331d034dd4928be6a69d3a74993de3f1e14853
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,76 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(usdc, address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure { require(actual == expected, "not equal"); }
+}

2026-08-24T20:37:11.766022Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc 'forge fmt && forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace
 exited 1 in 54ms:
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 6.85ms
Error: Compiler run failed:
Error (9553): Invalid type for argument in function call. Invalid implicit conversion from contract MockUSDC to contract IERC20 requested.
  --> test/Toolshed.t.sol:22:33:
   |
22 |         toolshed = new Toolshed(usdc, address(this));
   |                                 ^^^^

diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ea331d034dd4928be6a69d3a74993de3f1e14853
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,76 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(usdc, address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure { require(actual == expected, "not equal"); }
+}

2026-08-24T20:37:15.411039Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c909fb9af66d79ea84282beb4bd822f12bb2a5de
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)), address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c909fb9af66d79ea84282beb4bd822f12bb2a5de
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)), address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

2026-08-24T20:37:19.544598Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc 'forge fmt --check && forge test -vv && git diff --stat -- .' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace
 succeeded in 347ms:
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 287.48ms
Compiler run successful!
2026-08-24T20:37:22.741548Z  WARN evm::traces::external: etherscan config not found

Ran 3 tests for test/Toolshed.t.sol:ToolshedTest
[PASS] testLateFeeRoundsUpAndIsCappedByDeposit() (gas: 243542)
[PASS] testOnTimeReturnRefundsEntireDeposit() (gas: 219834)
[PASS] testRejectedRequestRefundsAndUnlocksTool() (gas: 186238)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 752.83µs (841.07µs CPU time)

Ran 1 test suite in 7.25ms (752.83µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
2026-08-24T20:37:22.749805Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c909fb9af66d79ea84282beb4bd822f12bb2a5de
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)), address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

2026-08-24T20:37:22.787299Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
Implemented the first Toolshed version with:

- Member-managed tool listings and URI metadata.
- USDC deposit escrow.
- Owner approval/rejection and borrower cancellation.
- Late fees rounded to started late days and capped by the deposit.
- Completed-loan and late-return reputation.
- Reliability sorting utilities for browse/request screens.
- Local mock USDC and deployment script.
- Architecture, setup, deployment, and frontend integration documentation.

Key files:

- [Toolshed.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol)
- [browse.ts](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md)
- [Toolshed.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol)

Verification: `forge test -vv` passes all 3 tests.
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..219462186685dff3e8476f3694233df9dcb0ec61
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+RPC_URL=http://127.0.0.1:8545
+DEPLOYER_PRIVATE_KEY=
+USDC_ADDRESS=
+ADMIN_ADDRESS=
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..bf310203ab85b007547900802ec7d5563230783d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,5 @@
+lib/
+out/
+cache/
+broadcast/
+.env
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..f69acafe94f10922e968b87d642e8e589950c50c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,59 @@
+# Toolshed
+
+Toolshed is a first-version, on-chain lending ledger for a neighborhood association. It supports an admin-managed member list, URI-backed tool listings, owner-approved loan requests, USDC deposits, late-fee settlement, and borrower reliability records.
+
+## Architecture
+
+- `contracts/Toolshed.sol` is the source of truth. A borrower deposits USDC when requesting a tool. The owner accepts or rejects the request and confirms the physical return. On return, the contract pays the owner one configured fee for each started 24-hour period past the deadline (never more than the deposit) and refunds the remainder.
+- Tool name, photo, description, and condition live in a small JSON document referenced by `metadataURI`; this avoids storing images and frequently edited prose on-chain. `src/browse.ts` defines and validates that document.
+- `src/browse.ts` contains deterministic view-model sorting for available tool cards and, importantly, an owner's request inbox. Requests with more completed loans rank first, then fewer late returns, then earlier requests. A production UI should derive these views from contract events with an indexer (Ponder, Envio, or a small database worker); scanning every ID from a browser is acceptable only for a local demo.
+- `contracts/MockUSDC.sol` is for local development only. `script/Deploy.s.sol` deploys against the real USDC address supplied by the operator.
+
+The owner confirms returns because the contract cannot observe a physical handoff. This v1 deliberately has no dispute resolver: association administrators must handle disputes operationally. Membership removal prevents new actions but does not confiscate or strand an existing escrow. Photos should be uploaded to IPFS or another durable HTTPS host before listing.
+
+## Prerequisites and local run
+
+Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then from this directory run:
+
+```sh
+forge build
+forge test -vv
+```
+
+For a local chain, start `anvil`, deploy `MockUSDC`, mint six-decimal test balances, then deploy `Toolshed` with the mock token and association admin addresses. Example using Cast (replace the printed token address):
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+export USDC_ADDRESS=0xYourMockAddress
+export ADMIN_ADDRESS=0xYourAdminAddress
+forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --private-key "$ANVIL_PRIVATE_KEY" --broadcast
+```
+
+The admin calls `setMember(address,true)` for the association's approximately 300 wallets. A member uploads metadata such as the following, then passes its URI to `listTool`:
+
+```json
+{
+  "name": "18V cordless drill",
+  "description": "Drill, two batteries, charger and case",
+  "image": "ipfs://bafy.../drill.jpg",
+  "condition": "Working; chuck is scratched"
+}
+```
+
+Before `requestLoan`, the borrower must call USDC `approve(toolshedAddress, deposit)`. USDC uses 6 decimals: `25_000000` base units is 25 USDC. The owner then calls `acceptLoan`; the due time starts at acceptance, not request. On physical return the owner calls `confirmReturn`.
+
+## Network deployment
+
+1. Select an EVM network with native USDC and obtain its official token address from Circle. Use a multisig as `ADMIN_ADDRESS`.
+2. Copy `.env.example` to `.env`, fill the values, and load it into your shell. Never commit the private key.
+3. Simulate first: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"`.
+4. Broadcast: `forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify` (add the explorer API options required by the target chain).
+5. Record the deployment address, chain ID, block number, USDC address, and verified source. Transfer operational admin control to the association multisig if it was not used at deployment.
+
+The contract has tests but has not been audited. Before holding real member deposits, add an emergency/dispute policy, multisig governance, monitoring for open loans, a security review, and UI transaction simulations.
+
+## Frontend integration
+
+Use any viem/wagmi client generated from the compiled ABI. Subscribe to `ToolListed`, `ToolUpdated`, `LoanRequested`, `LoanStarted`, and the terminal loan events. Fetch and validate each listing's metadata, read `reputation(borrower)` for request cards, and apply `sortBorrowRequests`. Transaction buttons map directly to `approve`, `requestLoan`, `acceptLoan`/`rejectLoan`, and `confirmReturn`. Do not infer token decimals; read them from the configured token or lock the UI configuration to USDC's 6 decimals.
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..86bc31e326431b76c7e24b5eff6efee585000d5a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _move(from, to, amount);
+        return true;
+    }
+    function _move(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5b344c58a98f25a1ae33f82587e35157a494b0c0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and lending ledger for a permissioned neighborhood association.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Returned, Rejected, Cancelled }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 startedAt;
+        uint64 returnedAt;
+        uint256 deposit;
+        uint256 lateFeePerDay;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint64 completedLoans; uint64 lateReturns; }
+
+    uint256 public constant DAY = 1 days;
+    IERC20 public immutable usdc;
+    address public admin;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256) public activeLoanForTool;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, bool active);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanStarted(uint256 indexed loanId, uint64 startedAt, uint64 dueAt);
+    event LoanClosed(uint256 indexed loanId, uint64 returnedAt, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+    modifier onlyMember() { if (!members[msg.sender]) revert Unauthorized(); _; }
+
+    constructor(IERC20 usdc_, address admin_) {
+        if (address(usdc_) == address(0) || admin_ == address(0)) revert InvalidInput();
+        usdc = usdc_;
+        admin = admin_;
+        members[admin_] = true;
+        emit MemberSet(admin_, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        if (member == address(0)) revert InvalidInput();
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function transferAdmin(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidInput();
+        admin = nextAdmin;
+    }
+
+    function listTool(string calldata metadataURI) external onlyMember returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0) revert InvalidInput();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, true);
+        emit ToolListed(toolId, msg.sender, metadataURI);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, bool active) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || (!active && activeLoanForTool[toolId] != 0)) revert InvalidState();
+        tool.metadataURI = metadataURI;
+        tool.active = active;
+        emit ToolUpdated(toolId, metadataURI, active);
+    }
+
+    /// @dev Borrower escrows deposit at request time. Duration is capped to avoid timestamp overflow and accidental long locks.
+    function requestLoan(uint256 toolId, uint32 durationDays, uint256 deposit, uint256 lateFeePerDay) external onlyMember returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.active || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidInput();
+        if (durationDays == 0 || durationDays > 90 || deposit == 0 || lateFeePerDay > deposit) revert InvalidInput();
+        if (activeLoanForTool[toolId] != 0) revert InvalidState();
+        loanId = nextLoanId++;
+        uint64 dueAt = uint64(block.timestamp + uint256(durationDays) * DAY);
+        loans[loanId] = Loan(toolId, msg.sender, uint64(block.timestamp), dueAt, 0, 0, deposit, lateFeePerDay, LoanStatus.Requested);
+        activeLoanForTool[toolId] = loanId;
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        uint256 duration = loan.dueAt - loan.requestedAt;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + duration);
+        loan.status = LoanStatus.Active;
+        emit LoanStarted(loanId, loan.startedAt, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        activeLoanForTool[loan.toolId] = 0;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner confirms physical return. Each started 24h late period is charged, capped by deposit.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        address owner = tools[loan.toolId].owner;
+        if (owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + DAY - 1) / DAY : 0;
+        uint256 fee = lateDays * loan.lateFeePerDay;
+        if (fee > loan.deposit) fee = loan.deposit;
+        uint256 refund = loan.deposit - fee;
+        loan.status = LoanStatus.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        activeLoanForTool[loan.toolId] = 0;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+        if (fee != 0) _safeTransfer(owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanClosed(loanId, loan.returnedAt, fee, refund, late);
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..6dd315d0adfeba45c40d788bb4eedd552ec3a375
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..0255fc2f74d562e52a14a72380fb9563372b1cb1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "build": "forge build",
+    "test": "forge test -vv"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3fc5e1d928d9ca646ca15b2bc1d95008a2b947c4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        address admin = vm.envAddress("ADMIN_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc), admin);
+        vm.stopBroadcast();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a11253084cca8b94b6e24fe8185873bee46ff3cb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts
@@ -0,0 +1,52 @@
+export type Reputation = { completedLoans: bigint; lateReturns: bigint };
+export type ToolCard = {
+  id: bigint;
+  owner: `0x${string}`;
+  metadataURI: string;
+  available: boolean;
+  reputation: Reputation;
+};
+
+/** Higher completed-loan count wins; at equal experience, fewer late returns wins. */
+export const reliabilityCompare = (a: ToolCard, b: ToolCard) => {
+  if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+    return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+  }
+  if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+    return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+  }
+  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
+};
+
+export const sortBrowseTools = (tools: ToolCard[]) =>
+  tools.filter(tool => tool.available).toSorted(reliabilityCompare);
+
+export type ToolMetadata = { name: string; description: string; image: string; condition: string };
+
+export type BorrowRequest = {
+  loanId: bigint;
+  borrower: `0x${string}`;
+  requestedAt: bigint;
+  reputation: Reputation;
+};
+
+/** Owner inbox ordering: proven borrowers first, then fewer late returns, then oldest request. */
+export const sortBorrowRequests = (requests: BorrowRequest[]) =>
+  requests.toSorted((a, b) => {
+    if (a.reputation.completedLoans !== b.reputation.completedLoans) {
+      return a.reputation.completedLoans > b.reputation.completedLoans ? -1 : 1;
+    }
+    if (a.reputation.lateReturns !== b.reputation.lateReturns) {
+      return a.reputation.lateReturns < b.reputation.lateReturns ? -1 : 1;
+    }
+    return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
+  });
+
+export const validateMetadata = (value: unknown): ToolMetadata => {
+  if (!value || typeof value !== "object") throw new Error("Invalid tool metadata");
+  const candidate = value as Record<string, unknown>;
+  for (const key of ["name", "description", "image", "condition"]) {
+    if (typeof candidate[key] !== "string" || candidate[key].length === 0) throw new Error(`Missing ${key}`);
+  }
+  return candidate as ToolMetadata;
+};
diff --git a/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c909fb9af66d79ea84282beb4bd822f12bb2a5de
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant OWNER = address(0xA11CE);
+    address constant BORROWER = address(0xB0B);
+    MockUSDC usdc;
+    Toolshed toolshed;
+    uint256 toolId;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)), address(this));
+        toolshed.setMember(OWNER, true);
+        toolshed.setMember(BORROWER, true);
+        vm.prank(OWNER);
+        toolId = toolshed.listTool("ipfs://tool-metadata");
+        usdc.mint(BORROWER, 100_000000);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsEntireDeposit() public {
+        uint256 loanId = _requestAndAccept(3, 50_000000, 5_000000);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(usdc.balanceOf(OWNER), 0);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCappedByDeposit() public {
+        uint256 loanId = _requestAndAccept(2, 20_000000, 7_000000);
+        vm.warp(block.timestamp + 4 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        _assertEq(usdc.balanceOf(OWNER), 20_000000);
+        _assertEq(usdc.balanceOf(BORROWER), 80_000000);
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 loanId = _request(3, 50_000000, 5_000000);
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100_000000);
+        _assertEq(toolshed.activeLoanForTool(toolId), 0);
+    }
+
+    function _requestAndAccept(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        id = _request(daysRequested, deposit, fee);
+        vm.prank(OWNER);
+        toolshed.acceptLoan(id);
+    }
+
+    function _request(uint32 daysRequested, uint256 deposit, uint256 fee) private returns (uint256 id) {
+        vm.prank(BORROWER);
+        id = toolshed.requestLoan(toolId, daysRequested, deposit, fee);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

tokens used
31,817
Implemented the first Toolshed version with:

- Member-managed tool listings and URI metadata.
- USDC deposit escrow.
- Owner approval/rejection and borrower cancellation.
- Late fees rounded to started late days and capped by the deposit.
- Completed-loan and late-return reputation.
- Reliability sorting utilities for browse/request screens.
- Local mock USDC and deployment script.
- Architecture, setup, deployment, and frontend integration documentation.

Key files:

- [Toolshed.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/contracts/Toolshed.sol)
- [browse.ts](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/src/browse.ts)
- [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/README.md)
- [Toolshed.t.sol](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-24T203457Z-codex-no-skill-3/workspace/test/Toolshed.t.sol)

Verification: `forge test -vv` passes all 3 tests.
