Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4c0-155c-78e0-bf0b-fa16993d995e
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
codex
I’ll inspect the starter repo, then implement the smallest complete lending flow and document deployment/run steps.
exec
/bin/bash -lc "pwd && rg --files -g '"'!lib'"' -g '"'!dist'"' -g '"'!build'"' -g '"'!out'"' | sed -n '1,160p' && find . -maxdepth 2 -type f -name AGENTS.md -print" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
TASK.md

exec
/bin/bash -lc 'cat TASK.md && command -v forge || true && command -v solc || true && git status --short' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
 succeeded in 0ms:
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
/home/matt/.foundry/bin/forge
?? ../../
?? ../../../ship-quiz-001/
?? ../../../ship-quiz-002/
?? ../../../ship-quiz-003/
?? ../../../ship-quiz-004/

codex
The workspace is empty. I’m using a dependency-light Foundry contract plus a small React/Vite client: escrow and reputation stay onchain; photos remain URI-based so deployment stays cheap.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

codex
Core flow is in place, including rejection/cancellation refunds, owner-confirmed returns, capped late fees, and reputation. I’m validating contract behavior and client compilation now.
exec
/bin/bash -lc 'forge test -vv && npm install --ignore-scripts && npm run build' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
 exited 1 in 271ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

exec
/bin/bash -lc 'env HOME=/tmp/toolshed-home FOUNDRY_CACHE_PATH=/tmp/toolshed-forge-cache forge test -vv' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
 succeeded in 510ms:
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 228.40ms
Compiler run successful!

Ran 3 tests for test/Toolshed.t.sol:ToolshedTest
[PASS] testLateFeeIsCappedAtDeposit() (gas: 370090)
[PASS] testOnTimeReturnRefundsDepositAndUpdatesReputation() (gas: 340246)
[PASS] testRejectedRequestRefundsEscrow() (gas: 308244)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 760.96µs (816.25µs CPU time)

Ran 1 test suite in 6.04ms (760.96µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)

diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

exec
/bin/bash -lc 'env HOME=/tmp/toolshed-home npm install --ignore-scripts && env HOME=/tmp/toolshed-home npm run build' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

 exited 1 in 7243ms:

added 24 packages, and audited 25 packages in 6s

13 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 moderate, 1 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm notice
npm notice New minor version of npm available! 11.6.2 -> 11.19.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.19.0
npm notice To update run: npm install -g npm@11.19.0
npm notice

> toolshed@0.1.0 build
> tsc -b && vite build

src/main.ts(70,31): error TS2345: Argument of type 'EventTarget | null' is not assignable to parameter of type 'HTMLFormElement | undefined'.
  Type 'null' is not assignable to type 'HTMLFormElement | undefined'.
src/main.ts(76,38): error TS18047: 'event.currentTarget' is possibly 'null'.
src/main.ts(76,58): error TS2339: Property 'reset' does not exist on type 'EventTarget'.

diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..9fe3bca3ce05233a145e3aef720e693baeaac11c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+document.querySelector<HTMLFormElement>("#list")!.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(event.currentTarget);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); event.currentTarget.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..b2a6babd075c1a9f6e8b7e509ab1ed4cb2a04c72
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+const listingForm = document.querySelector<HTMLFormElement>("#list")!;
+listingForm.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(listingForm);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); listingForm.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..b2a6babd075c1a9f6e8b7e509ab1ed4cb2a04c72
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+const listingForm = document.querySelector<HTMLFormElement>("#list")!;
+listingForm.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(listingForm);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); listingForm.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

exec
/bin/bash -lc 'env HOME=/tmp/toolshed-home npm run build && git status --short && git diff --check' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..b2a6babd075c1a9f6e8b7e509ab1ed4cb2a04c72
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+const listingForm = document.querySelector<HTMLFormElement>("#list")!;
+listingForm.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(listingForm);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); listingForm.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

 succeeded in 2676ms:
vite v5.4.21 building for production...
transforming...
✓ 1209 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.17 kB │ gzip:  0.14 kB
dist/assets/index-BndcEbo9.css    1.10 kB │ gzip:  0.55 kB
dist/assets/ccip-Br79Oa3W.js      3.04 kB │ gzip:  1.39 kB
dist/assets/index-DuS7VhBQ.js   273.85 kB │ gzip: 84.60 kB
✓ built in 1.12s
?? ../../
?? ../../../ship-quiz-001/
?? ../../../ship-quiz-002/
?? ../../../ship-quiz-003/
?? ../../../ship-quiz-004/

diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..b2a6babd075c1a9f6e8b7e509ab1ed4cb2a04c72
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+const listingForm = document.querySelector<HTMLFormElement>("#list")!;
+listingForm.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(listingForm);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); listingForm.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

codex
Built Toolshed v1:

- Solidity USDC escrow, late fees, listings, loan lifecycle, reputation
- Responsive Vite frontend
- Foundry deployment script
- Contract tests
- Complete setup/deployment/architecture docs in [README.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md)

Validation:

- `forge test`: 3/3 passed
- `npm run build`: passed
- `npm install` reports 2 dependency vulnerabilities; review before production.
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..9dbdbe29ec6669f7d7afc2cd787aeb1121fd1b4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..ca3b9757afcfafb946471f7124b04761fb12186a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+out/
+cache/
+dist/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..60d635fefe815da3206f5b66979c8db32f7fabf0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md
@@ -0,0 +1,52 @@
+# Toolshed
+
+First-version neighborhood tool library. Owners publish tool metadata and loan terms; borrowers escrow USDC; owners accept requests and confirm physical returns. Escrow refunds on time or pays the owner a per-started-day late fee (capped at the deposit). Completed and late loan counts form a public track record.
+
+## Architecture
+
+- `contracts/Toolshed.sol`: listings, request/accept lifecycle, USDC escrow, settlement, and borrower reputation. It uses checks-effects-interactions and a reentrancy guard.
+- `contracts/MockUSDC.sol`: local/test token only.
+- `src/`: static Vite client. It lists tools, submits listings and requests, and sorts by onchain reliability score.
+- `script/Deploy.s.sol`: Foundry deployment script.
+- `test/`: escrow, refund, late-fee-cap, and reputation tests.
+
+Photos are URLs (IPFS, an object store, etc.); image bytes are not stored onchain. USDC uses 6 decimals. A request escrows the listing's current deposit. The due date starts when the owner approves, not when requested. Only the owner can confirm the physical return. The score is `(completed - late) / completed`, in basis points; a new member scores zero. For a 300-member association, direct indexed reads are adequate; production analytics should index emitted events.
+
+## Local setup
+
+Prerequisites: Foundry, Node.js 20+, and a browser wallet.
+
+```sh
+npm install
+forge test
+cp .env.example .env
+```
+
+For a local chain:
+
+```sh
+anvil
+forge create contracts/MockUSDC.sol:MockUSDC \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+USDC_ADDRESS=<mock-address> forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 --private-key <anvil-private-key> --broadcast
+```
+
+Set `VITE_TOOLSHED_ADDRESS` to the deployed Toolshed address and `VITE_RPC_URL=http://127.0.0.1:8545` in `.env`, then run `npm run dev`. Mint mock USDC to test borrowers with `cast send <mock-address> "mint(address,uint256)" <borrower> 100000000 ...`. The wallet must be configured for the local chain.
+
+## Testnet deployment
+
+Use Base Sepolia USDC (or another intentional test token); verify its address from the issuer before deployment. Never deploy `MockUSDC` as real collateral.
+
+```sh
+export USDC_ADDRESS=<verified-usdc-address>
+forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --verify
+```
+
+Copy the resulting contract address into the frontend `.env`, run `npm run build`, and deploy `dist/` to any static host. Configure that host with the same two `VITE_` variables at build time.
+
+## Operational limits
+
+This v1 assumes the association handles membership and disputes offchain. An owner can delay return confirmation, and lost/damaged-tool adjudication is not implemented. Before mainnet use, add association-controlled membership, a return/dispute timeout or mediator, pausing, event indexing, contract audits, and a photo-storage policy. Contract deployment is immutable, so changing these rules requires migration.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..fecd65d0f18cfe686bfff79e4fc959bd8afa5ac0
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/MockUSDC.sol
@@ -0,0 +1,34 @@
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
+        uint256 allowed = allowance[from][msg.sender];
+        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..5a9c0df3bb5e81b784b0a8eb47995dcc9d2d15f4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and reputation for a small community tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Returned,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint96 deposit;
+        uint96 lateFeePerDay;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        LoanStatus status;
+        uint96 deposit;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolRequests;
+    uint256 private _locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolAvailabilityChanged(uint256 indexed toolId, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanApproved(uint256 indexed loanId, uint256 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 refund);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+
+    modifier nonReentrant() {
+        if (_locked != 1) revert InvalidState();
+        _locked = 2;
+        _;
+        _locked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidInput();
+        usdc = usdc_;
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint96 deposit,
+        uint96 lateFeePerDay
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || lateFeePerDay > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, condition, deposit, lateFeePerDay, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function setToolAvailable(uint256 toolId, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        tool.available = available;
+        emit ToolAvailabilityChanged(toolId, available);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            LoanStatus.Requested,
+            tool.deposit
+        );
+        _toolRequests[toolId].push(loanId);
+        _safeTransferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
+
+        tool.available = false;
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit ToolAvailabilityChanged(loan.toolId, false);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (tools[loan.toolId].owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit);
+    }
+
+    /// @notice Owner confirms the physical tool was returned and settles escrow.
+    function confirmReturned(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        uint256 fee;
+        bool late = block.timestamp > loan.dueAt;
+        if (late) {
+            uint256 overdue = block.timestamp - loan.dueAt;
+            uint256 lateDays = (overdue + 1 days - 1) / 1 days;
+            fee = lateDays * tool.lateFeePerDay;
+            if (fee > loan.deposit) fee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - fee;
+
+        loan.status = LoanStatus.Returned;
+        tool.available = true;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (late) rep.lateReturns++;
+
+        if (fee != 0) _safeTransfer(tool.owner, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit ToolAvailabilityChanged(loan.toolId, true);
+        emit LoanClosed(loanId, LoanStatus.Returned, fee, refund);
+    }
+
+    function toolRequests(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolRequests[toolId];
+    }
+
+    function reliability(address member) external view returns (uint256 completed, uint256 late, uint256 score) {
+        Reputation memory rep = reputation[member];
+        completed = rep.completedLoans;
+        late = rep.lateReturns;
+        score = completed == 0 ? 0 : (uint256(completed - late) * 10_000) / completed;
+    }
+
+    function _safeTransfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) =
+            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..79252a362732ca522679425f801312f09d6acb94
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..19fabebaa4223df7f193a5120e683f458ec499df
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/index.html
@@ -0,0 +1,2 @@
+<div id="app"></div><script type="module" src="/src/main.ts"></script>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..75d2b5b739437439013b2d1f7012bc0832be05ec
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "test:contracts": "forge test"
+  },
+  "dependencies": {
+    "viem": "^2.21.30",
+    "vite": "^5.4.11",
+    "typescript": "^5.6.3"
+  },
+  "devDependencies": {}
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d7042d0a788ce8376de530d22df1953de03ce1be
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed, IERC20} from "../contracts/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed deployed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        deployed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
new file mode 100644
index 0000000000000000000000000000000000000000..b2a6babd075c1a9f6e8b7e509ab1ed4cb2a04c72
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/main.ts
@@ -0,0 +1,84 @@
+import { createPublicClient, createWalletClient, custom, formatUnits, http, parseAbi } from "viem";
+import { baseSepolia } from "viem/chains";
+import "./style.css";
+
+const address = import.meta.env.VITE_TOOLSHED_ADDRESS as `0x${string}` | undefined;
+const rpc = import.meta.env.VITE_RPC_URL;
+const abi = parseAbi([
+  "function toolCount() view returns (uint256)",
+  "function tools(uint256) view returns (address owner,string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay,bool available)",
+  "function listTool(string name,string photoURI,string condition,uint96 deposit,uint96 lateFeePerDay) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint16 durationDays) returns (uint256)",
+  "function reliability(address member) view returns (uint256 completed,uint256 late,uint256 score)",
+  "function usdc() view returns (address)",
+]);
+const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
+const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
+
+const root = document.querySelector<HTMLDivElement>("#app")!;
+root.innerHTML = `<header><h1>Toolshed</h1><button id="connect">Connect wallet</button></header>
+  <main><section><h2>Neighborhood tools</h2><p class="muted">Deposits are returned after the owner confirms return. Started late days are charged from escrow.</p><div id="tools" class="grid"></div></section>
+  <aside><h2>List a tool</h2><form id="list"><input name="name" placeholder="Tool name" required><input name="photo" placeholder="Photo URL" required><textarea name="condition" placeholder="Condition notes"></textarea><input name="deposit" type="number" min="1" step=".01" placeholder="Deposit (USDC)" required><input name="fee" type="number" min="0" step=".01" placeholder="Late fee / day" required><button>List tool</button></form><p id="status"></p></aside></main>`;
+
+let account: `0x${string}` | undefined;
+document.querySelector("#connect")!.addEventListener("click", async () => {
+  if (!window.ethereum) return setStatus("Install an EIP-1193 wallet.");
+  [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
+  (document.querySelector("#connect") as HTMLButtonElement).textContent = `${account!.slice(0, 6)}…${account!.slice(-4)}`;
+});
+
+async function wallet() {
+  if (!address || !account || !window.ethereum) throw new Error("Connect wallet and configure the contract address.");
+  return createWalletClient({ account, chain: baseSepolia, transport: custom(window.ethereum) });
+}
+
+async function loadTools() {
+  if (!address) return setStatus("Set VITE_TOOLSHED_ADDRESS in .env.");
+  const count = await publicClient.readContract({ address, abi, functionName: "toolCount" });
+  const entries = await Promise.all(Array.from({ length: Number(count) }, async (_, i) => {
+    const id = BigInt(i + 1);
+    const tool = await publicClient.readContract({ address, abi, functionName: "tools", args: [id] });
+    const [, , score] = await publicClient.readContract({ address, abi, functionName: "reliability", args: [tool[0]] });
+    return { id, tool, score };
+  }));
+  entries.sort((a, b) => Number(b.score - a.score));
+  document.querySelector("#tools")!.innerHTML = entries.map(({ id, tool, score }) => `<article>
+    <img src="${escapeHtml(tool[2])}" alt=""><div><span class="score">${Number(score) / 100}% owner reliability</span><h3>${escapeHtml(tool[1])}</h3>
+    <p>${escapeHtml(tool[3])}</p><p>${formatUnits(tool[4], 6)} USDC deposit · ${formatUnits(tool[5], 6)}/late day</p>
+    <button data-borrow="${id}" ${tool[6] ? "" : "disabled"}>${tool[6] ? "Request" : "On loan"}</button></div></article>`).join("") || "<p>No tools yet.</p>";
+  document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach(button => button.onclick = () => borrow(BigInt(button.dataset.borrow!)));
+}
+
+async function borrow(toolId: bigint) {
+  try {
+    const days = Number(prompt("How many days (1–30)?", "3"));
+    if (!days || days < 1 || days > 30) throw new Error("Choose 1–30 days.");
+    const client = await wallet();
+    const tool = await publicClient.readContract({ address: address!, abi, functionName: "tools", args: [toolId] });
+    const usdc = await publicClient.readContract({ address: address!, abi, functionName: "usdc" });
+    setStatus("Approve USDC in your wallet…");
+    await client.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [address!, tool[4]] });
+    setStatus("Now confirm the loan request…");
+    await client.writeContract({ address: address!, abi, functionName: "requestLoan", args: [toolId, days] });
+    setStatus("Request submitted.");
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+}
+
+const listingForm = document.querySelector<HTMLFormElement>("#list")!;
+listingForm.onsubmit = async event => {
+  event.preventDefault();
+  try {
+    const data = new FormData(listingForm);
+    const client = await wallet();
+    await client.writeContract({ address: address!, abi, functionName: "listTool", args: [
+      String(data.get("name")), String(data.get("photo")), String(data.get("condition")),
+      BigInt(Math.round(Number(data.get("deposit")) * 1e6)), BigInt(Math.round(Number(data.get("fee")) * 1e6)),
+    ] });
+    setStatus("Listing submitted."); listingForm.reset();
+  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
+};
+function setStatus(message: string) { document.querySelector("#status")!.textContent = message; }
+function escapeHtml(value: string) { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
+loadTools().catch(error => setStatus(String(error)));
+
+declare global { interface Window { ethereum?: { request(args: { method: string }): Promise<`0x${string}`[]> } } }
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
new file mode 100644
index 0000000000000000000000000000000000000000..b6d7898f29bbf574d3b87496524eeb4f53c5caab
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/src/style.css
@@ -0,0 +1,9 @@
+:root { font-family: Inter, system-ui, sans-serif; color: #25251f; background: #f4f1e8; }
+body { margin: 0; } button { cursor: pointer; background: #285c43; color: white; border: 0; padding: .7rem 1rem; border-radius: .45rem; font-weight: 700; }
+button:disabled { opacity: .5; } header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 5vw; background: #fff; border-bottom: 1px solid #ddd7c7; }
+main { display: grid; grid-template-columns: 1fr 22rem; gap: 2rem; padding: 2rem 5vw; } h1,h2,h3 { margin-top: 0; } .muted { color: #68685e; }
+.grid { display: grid; gap: 1rem; } article { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; background: white; padding: 1rem; border-radius: .7rem; box-shadow: 0 2px 10px #493c2514; }
+article img { width: 100%; height: 9rem; object-fit: cover; border-radius: .45rem; } .score { color: #285c43; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
+aside { background: white; align-self: start; padding: 1.3rem; border-radius: .7rem; } form { display: grid; gap: .8rem; } input,textarea { font: inherit; padding: .7rem; border: 1px solid #c9c4b7; border-radius: .35rem; }
+@media (max-width: 760px) { main { grid-template-columns: 1fr; } article { grid-template-columns: 1fr; } }
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73bd12bef8916273dd09d0fc09445a1b359a99a9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/test/Toolshed.t.sol
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
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private usdc;
+    Toolshed private shed;
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        shed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 100e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDepositAndUpdatesReputation() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 0);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 20 days);
+        vm.prank(OWNER);
+        shed.confirmReturned(loanId);
+
+        _assertEq(usdc.balanceOf(OWNER), 25e6);
+        _assertEq(usdc.balanceOf(BORROWER), 75e6);
+        (uint64 completed, uint64 late) = shed.reputation(BORROWER);
+        _assertEq(completed, 1);
+        _assertEq(late, 1);
+    }
+
+    function testRejectedRequestRefundsEscrow() public {
+        uint256 toolId = _listTool();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _assertEq(usdc.balanceOf(BORROWER), 100e6);
+    }
+
+    function _listTool() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Circular saw", "ipfs://photo", "Used, sharp blade", 25e6, 2e6);
+    }
+
+    function _assertEq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d31f0cda17b7eb128e87719285f4c076b7add5cc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/tsconfig.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "types": ["vite/client"]
+  },
+  "include": ["src"]
+}
+

tokens used
42,820
Built Toolshed v1:

- Solidity USDC escrow, late fees, listings, loan lifecycle, reputation
- Responsive Vite frontend
- Foundry deployment script
- Contract tests
- Complete setup/deployment/architecture docs in [README.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T203834Z-codex-no-skill-3/workspace/README.md)

Validation:

- `forge test`: 3/3 passed
- `npm run build`: passed
- `npm install` reports 2 dependency vulnerabilities; review before production.
