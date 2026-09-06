OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048e7-2cda-72d1-b8f2-7134d4290bcc
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

2026-08-28T15:05:05.227830Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048e7-2cda-72d1-b8f2-7134d4290bcc.tmp-1787929504991814084: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this is a new dApp/MVP that needs its onchain boundary, contract surface, incentives, launch chain, and deployment runbook settled before implementation. I’ll use those decisions to produce a runnable first version and README in this workspace.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
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
/bin/bash -lc "pwd && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,240p' && find . -maxdepth 2 -type f -name 'AGENTS.md' -print" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
 succeeded in 1ms:
codex
The shipping slice is now concrete: one escrow contract holds USDC and settles deposits/late fees; tool metadata, photos, requests, and browse ranking remain offchain; reputation is derived from emitted loan events. I’m targeting Base Sepolia first because it has canonical test USDC and low-cost, EVM-compatible transactions suited to many small neighborhood loans. Next I’m checking the available toolchain, then I’ll implement the contract, tests, app, and exact deployment path.
exec
/bin/bash -lc "command -v forge || true
command -v node || true
command -v npm || true
node --version 2>/dev/null || true
npm --version 2>/dev/null || true
sed -n '1,200p' TASK.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
 succeeded in 75ms:
10.9.7
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

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/contracts/src/ToolshedEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/contracts/test/ToolshedEscrow.t.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/package.json
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/app.js
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/index.html
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/styles.css
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/server/server.js
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..332b62cb8c3be57370f416498bdb992535b12c1a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
+
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..332b62cb8c3be57370f416498bdb992535b12c1a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
+
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

codex
The vertical slice is implemented, including capped late fees, full on-time refunds, association dispute resolution, two-step admin transfer, a ranked browse UI, listing/request flows, and contract tests. I’m now validating compilation and behavior, and I’m verifying the official Base Sepolia USDC address before writing the deployment commands—this address must not be guessed.
web search: 
exec
/bin/bash -lc 'forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
exec
/bin/bash -lc 'node --check server/server.js && node --check public/app.js' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
 succeeded in 131ms:
 succeeded in 320ms:
Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 200.32ms
Compiler run successful!
2026-08-28T15:07:44.379959Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for contracts/test/ToolshedEscrow.t.sol:ToolshedEscrowTest
[PASS] testLateFeeCannotExceedDeposit() (gas: 180284)
[PASS] testLateFeeRoundsUpAndPaysLender() (gas: 187403)
[PASS] testLenderCanCancelBeforeDueDate() (gas: 155798)
[PASS] testOnTimeReturnRefundsFullDeposit() (gas: 161254)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 737.53µs (994.12µs CPU time)

Ran 1 test suite in 7.94ms (737.53µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
2026-08-28T15:07:44.388748Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

web search: site:developers.circle.com Base Sepolia USDC contract address
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..332b62cb8c3be57370f416498bdb992535b12c1a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
+
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/.gitignore
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/README.md
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6e010c682f71787a47d5f21e973928925bfda
--- /dev/null
+++ b/README.md
@@ -0,0 +1,132 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
+
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..332b62cb8c3be57370f416498bdb992535b12c1a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
+
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6e010c682f71787a47d5f21e973928925bfda
--- /dev/null
+++ b/README.md
@@ -0,0 +1,132 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
+
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..332b62cb8c3be57370f416498bdb992535b12c1a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
+
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

exec
/bin/bash -lc 'npm start' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6e010c682f71787a47d5f21e973928925bfda
--- /dev/null
+++ b/README.md
@@ -0,0 +1,132 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
+
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..332b62cb8c3be57370f416498bdb992535b12c1a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
+
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/package.json
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6e010c682f71787a47d5f21e973928925bfda
--- /dev/null
+++ b/README.md
@@ -0,0 +1,132 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
+
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

exec
/bin/bash -lc "curl -fsS http://localhost:3000/api/tools | head -c 300
curl -fsS -X POST http://localhost:3000/api/requests -H 'content-type: application/json' --data '{\"toolId\":\"drill-1\",\"from\":\"2026-09-01\",\"to\":\"2026-09-03\"}'
curl -fsS http://localhost:3000/ | head -n 2" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
 succeeded in 18ms:
{"id":"4269db14-03ef-42bf-996d-72d171eb2626","toolId":"drill-1","from":"2026-09-01","to":"2026-09-03","borrowerId":"m2","status":"pending","tool":{"id":"drill-1","ownerId":"m1","name":"18V cordless drill","condition":"Good; battery lasts about 40 minutes.","photo":"https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80","deposit":60,"dailyFee":5}}<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6e010c682f71787a47d5f21e973928925bfda
--- /dev/null
+++ b/README.md
@@ -0,0 +1,132 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
+
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

codex
The contract suite passes all four scenarios, and the live HTTP smoke test successfully loaded listings, created a borrow request, and served the UI. One product detail needed tightening: reliability should help owners prioritize borrowers, not merely rank tool owners, so I’m adding a requester queue sorted by borrower history before the final handoff.
2026-08-28T15:09:30.206244Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/styles.css:
.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6e010c682f71787a47d5f21e973928925bfda
--- /dev/null
+++ b/README.md
@@ -0,0 +1,132 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
+
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

exec
/bin/bash -lc "tail -c 1200 public/styles.css
rg -n \"requests|section id=\\\"tools|async function load|Reputation is\" server/server.js public/index.html public/app.js README.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
README.md:14:The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
README.md:25:- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
README.md:27:- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
public/app.js:5:async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
public/app.js:26:$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
public/index.html:7:  <section id="tools" class="grid" aria-live="polite"></section></main>
server/server.js:17:const requests = [];
server/server.js:35:  if (url.pathname === "/api/requests" && req.method === "POST") {
server/server.js:40:    requests.push(request); return json(res, 201, request);
server/server.js:42:  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6e010c682f71787a47d5f21e973928925bfda
--- /dev/null
+++ b/README.md
@@ -0,0 +1,132 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. No score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
+
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f429e3822b7ad96871a94d761a0f2003eb44cf31
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,29 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() { tools = await fetch("/api/tools").then(r => r.json()); render(tools); }
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
+
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..88cb70722d6f846453d0689d8d0eb135bc2f115d
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
+
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..56cb6064baabf7b1d81ee6ca5b3fa0733109312f
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,52 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") return json(res, 200, requests);
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
+

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/app.js
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/index.html
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/server/server.js
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c5ee9d213df6e4bcd097c4084c7a37377634f734
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c5ee9d213df6e4bcd097c4084c7a37377634f734
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

2026-08-28T15:09:55.836556Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/styles.css:
#toast{position:fixed
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c5ee9d213df6e4bcd097c4084c7a37377634f734
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

2026-08-28T15:10:00.349642Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/styles.css:
:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c5ee9d213df6e4bcd097c4084c7a37377634f734
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

2026-08-28T15:10:06.887703Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/styles.css:
@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..c5ee9d213df6e4bcd097c4084c7a37377634f734
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/index.html
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/public/queue.css
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/server/server.js
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

2026-08-28T15:10:22.923858Z  WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 199ms)... turn_id=01a048e7-2d53-7a43-8ffe-6025b2b1d0fa retries=1 max_retries=5 sampling_error=stream disconnected before completion: WebSocket protocol error: Connection reset without closing handshake
 exited 1 in 94412ms:

> toolshed@0.1.0 start
> node server/server.js

(node:76) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/server/server.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
Toolshed running at http://localhost:3000
^C
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

exec
/bin/bash -lc 'set -e
forge test -q
node --check server/server.js
node --check public/app.js
npm start > /tmp/toolshed-smoke.log 2>&1 &
toolshed_pid=$!
trap '"'kill \""'$toolshed_pid" 2>/dev/null || true'"' EXIT
for attempt in 1 2 3 4 5; do curl -fsS http://localhost:3000/api/requests > /tmp/toolshed-requests.json && break; done
node -e 'const fs=require(\"fs\"); const q=JSON.parse(fs.readFileSync(\"/tmp/toolshed-requests.json\")); if(q.length<2 || q[0].borrower.name"'!=="Sam Rivera") process.exit(1); console.log(`request queue: ${q.length} entries, reliable borrower first`)'"'
curl -fsS http://localhost:3000/ | rg -q 'Borrow requests'
git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
2026-08-28T15:10:36.064965Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 152ms:
2026-08-28T15:10:35.939961Z  WARN evm::traces::external: etherscan config not found
2026-08-28T15:10:35.948437Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server
<anonymous_script>:1


SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at [eval]:1:38
    at runScriptInThisContext (node:internal/vm:209:10)
    at node:internal/process/execution:446:12
    at [eval]-wrapper:6:24
    at runScriptInContext (node:internal/process/execution:444:60)
    at evalFunction (node:internal/process/execution:279:30)
    at evalTypeScript (node:internal/process/execution:291:3)
    at node:internal/main/eval_string:74:3

Node.js v22.22.2

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

exec
/bin/bash -lc 'npm start' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

exec
/bin/bash -lc "curl -fsS http://localhost:3000/api/requests | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const q=JSON.parse(s);if(q.length<2||q[0].borrower.name"'!=="Sam Rivera")process.exit(1);console.log(`request queue: ${q.length} entries, reliable borrower first`)})'"'
curl -fsS http://localhost:3000/ | rg -o 'Borrow requests'
git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace
 succeeded in 35ms:
request queue: 2 entries, reliable borrower first
Borrow requests
?? .gitignore
?? README.md
?? contracts/
?? foundry.toml
?? package.json
?? public/
?? server/

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

 exited 1 in 9929ms:

> toolshed@0.1.0 start
> node server/server.js

Toolshed running at http://localhost:3000
^C
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

codex
Built Toolshed’s first runnable MVP.

Included:

- Neighborhood tool browse, listing, and borrowing-request UI
- Reliability-ranked borrower queue
- Dependency-free Node.js API with seeded demo data
- USDC escrow smart contract with:
  - Member allowlisting
  - Deposits and full on-time refunds
  - Capped daily late fees paid to owners
  - Loan cancellation
  - Association dispute resolution
  - Two-step admin transfer
- Four passing Foundry tests
- Base Sepolia deployment, verification, multisig, and end-to-end transaction runbook

Start it with:

```bash
npm start
```

Then open `http://localhost:3000`.

Tests:

```bash
npm test
```

Full architecture and deployment documentation is in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/README.md). Contract tests passed, and the UI/API smoke test verified the reliability ordering and request flow.
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fc900538ecc4daeedd3e9d7ce1b0a68822fd5f8f
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+artifacts/
+cache/
+.env
+.DS_Store
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..6297414d9da4cfbc2dcac0bdf9dbdde25eaeda33
--- /dev/null
+++ b/README.md
@@ -0,0 +1,131 @@
+# Toolshed
+
+Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.
+
+## Run locally
+
+Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.
+
+```bash
+npm start
+# open http://localhost:3000
+```
+
+The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:
+
+```bash
+npm test
+```
+
+## Architecture and MVP boundary
+
+This repository deliberately separates coordination from custody:
+
+- `public/` is a dependency-free browse/list/request UI.
+- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
+- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
+- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
+- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.
+
+The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.
+
+### Contract rules
+
+- Only association members can lend or borrow. The association admin manages the allowlist.
+- The borrower creates the agreed loan and funds the deposit atomically.
+- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
+- Before the due time, the lender can cancel a failed handoff and refund the borrower.
+- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
+- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
+| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
+| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
+| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
+| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
+| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
+| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |
+
+There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.
+
+## Deploy to Base Sepolia
+
+The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.
+
+Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.
+
+```bash
+export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='0x...'
+export ADMIN_MULTISIG='0x...'
+export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
+```
+
+Compile, test, deploy, and copy the printed deployed address into `ESCROW`:
+
+```bash
+forge test -vv
+forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
+  --private-key "$DEPLOYER_PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC" "$ADMIN_MULTISIG"
+export ESCROW='0x...'
+```
+
+Verify the exact source and constructor arguments:
+
+```bash
+forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
+  --chain 84532 \
+  --etherscan-api-key "$BASESCAN_API_KEY" \
+  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
+  --watch
+```
+
+### End-to-end post-deploy check
+
+Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.
+
+```bash
+export BORROWER_PRIVATE_KEY='0x...'
+export LENDER_PRIVATE_KEY='0x...'
+export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
+export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"
+
+cast calldata 'setMember(address,bool)' "$BORROWER" true
+cast calldata 'setMember(address,bool)' "$LENDER" true
+# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
+cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+
+cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+export DUE_AT="$(( $(date +%s) + 86400 ))"
+cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
+  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
+  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
+cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
+  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.
+
+## Production handoff
+
+Before using real deposits:
+
+1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
+2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
+3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
+4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
+5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.
+
+For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
diff --git a/contracts/src/ToolshedEscrow.sol b/contracts/src/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ecd00ca298afe790c1b6fbadcb200e8141bb19bd
--- /dev/null
+++ b/contracts/src/ToolshedEscrow.sol
@@ -0,0 +1,126 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @title ToolshedEscrow
+/// @notice USDC deposits for loans agreed by association members offchain.
+contract ToolshedEscrow {
+    enum Status { None, Active, Settled, Cancelled }
+
+    struct Loan {
+        bytes32 listingId;
+        address lender;
+        address borrower;
+        uint128 deposit;
+        uint128 dailyLateFee;
+        uint64 dueAt;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public admin;
+    address public pendingAdmin;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+
+    error Unauthorized();
+    error InvalidLoan();
+    error TransferFailed();
+
+    event MemberSet(address indexed member, bool allowed);
+    event LoanCreated(uint256 indexed loanId, bytes32 indexed listingId, address indexed borrower, address lender, uint256 deposit, uint256 dailyLateFee, uint256 dueAt);
+    event LoanSettled(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 refund, uint256 lateFee, bool late);
+    event LoanCancelled(uint256 indexed loanId);
+    event AdminTransferStarted(address indexed pendingAdmin);
+    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
+
+    constructor(address usdc_, address admin_) {
+        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidLoan();
+        usdc = IERC20(usdc_);
+        admin = admin_;
+    }
+
+    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
+
+    function setMember(address member, bool allowed) external onlyAdmin {
+        if (member == address(0)) revert InvalidLoan();
+        isMember[member] = allowed;
+        emit MemberSet(member, allowed);
+    }
+
+    function createLoan(bytes32 listingId, address lender, uint128 deposit, uint128 dailyLateFee, uint64 dueAt) external returns (uint256 loanId) {
+        if (!isMember[msg.sender] || !isMember[lender] || lender == msg.sender || listingId == bytes32(0) || deposit == 0 || dailyLateFee > deposit || dueAt <= block.timestamp) revert InvalidLoan();
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(listingId, lender, msg.sender, deposit, dailyLateFee, dueAt, Status.Active);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanCreated(loanId, listingId, msg.sender, lender, deposit, dailyLateFee, dueAt);
+    }
+
+    /// @notice Lender confirms the physical return. Late days round up.
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender) revert Unauthorized();
+        _settle(loanId, block.timestamp);
+    }
+
+    /// @notice Association resolves a dispute using the agreed effective return time.
+    function resolveReturn(uint256 loanId, uint64 returnedAt) external onlyAdmin {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || returnedAt > block.timestamp) revert InvalidLoan();
+        _settle(loanId, returnedAt);
+    }
+
+    /// @notice Lender may cancel an unstarted/failed handoff and refund the borrower.
+    function cancelLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active || msg.sender != loan.lender || block.timestamp >= loan.dueAt) revert Unauthorized();
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function startAdminTransfer(address nextAdmin) external onlyAdmin {
+        if (nextAdmin == address(0)) revert InvalidLoan();
+        pendingAdmin = nextAdmin;
+        emit AdminTransferStarted(nextAdmin);
+    }
+
+    function acceptAdmin() external {
+        if (msg.sender != pendingAdmin) revert Unauthorized();
+        address previous = admin;
+        admin = msg.sender;
+        pendingAdmin = address(0);
+        emit AdminTransferred(previous, msg.sender);
+    }
+
+    function _settle(uint256 loanId, uint256 returnedAt) internal {
+        Loan storage loan = loans[loanId];
+        uint256 lateFee;
+        if (returnedAt > loan.dueAt) {
+            uint256 lateDays = (returnedAt - loan.dueAt + 1 days - 1) / 1 days;
+            lateFee = lateDays * loan.dailyLateFee;
+            if (lateFee > loan.deposit) lateFee = loan.deposit;
+        }
+        uint256 refund = loan.deposit - lateFee;
+        loan.status = Status.Settled;
+        if (lateFee != 0) _safeTransfer(loan.lender, lateFee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, loan.borrower, loan.lender, refund, lateFee, lateFee != 0);
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
+
diff --git a/contracts/test/ToolshedEscrow.t.sol b/contracts/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e1223c960b6fc632693b9de5f086cc11c64d17dd
--- /dev/null
+++ b/contracts/test/ToolshedEscrow.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
+    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address constant LENDER = address(0xBEEF);
+    address constant BORROWER = address(0xCAFE);
+    MockUSDC token;
+    ToolshedEscrow escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(LENDER, true);
+        escrow.setMember(BORROWER, true);
+        token.mint(BORROWER, 100e6);
+        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
+    }
+
+    function _loan(uint64 dueAt) internal returns (uint256) {
+        vm.prank(BORROWER);
+        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+        require(token.balanceOf(LENDER) == 0, "no fee");
+    }
+
+    function testLateFeeRoundsUpAndPaysLender() public {
+        uint64 due = uint64(block.timestamp + 3 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 1 days + 1);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 14e6, "two days fee");
+        require(token.balanceOf(BORROWER) == 86e6, "remainder");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        uint64 due = uint64(block.timestamp + 1 days);
+        uint256 id = _loan(due);
+        vm.warp(due + 100 days);
+        vm.prank(LENDER); escrow.confirmReturn(id);
+        require(token.balanceOf(LENDER) == 100e6, "capped");
+        require(token.balanceOf(BORROWER) == 0, "no refund");
+    }
+
+    function testLenderCanCancelBeforeDueDate() public {
+        uint256 id = _loan(uint64(block.timestamp + 3 days));
+        vm.prank(LENDER); escrow.cancelLoan(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refund");
+    }
+}
+
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..31b737cbda2d13bcd63e531f1e3a01d0118d18e4
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+out = "artifacts"
+libs = []
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..e89139112da71f9cbe7af8c22691bc784ec0979a
--- /dev/null
+++ b/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "version": "0.1.0",
+  "description": "Neighborhood tool lending MVP",
+  "scripts": {
+    "dev": "node --watch server/server.js",
+    "start": "node server/server.js",
+    "test": "forge test -vv"
+  },
+  "engines": { "node": ">=20" }
+}
diff --git a/public/app.js b/public/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..f4eb29c6792938d8854e13d506825ebf7042cdc1
--- /dev/null
+++ b/public/app.js
@@ -0,0 +1,32 @@
+let tools = [];
+const $ = selector => document.querySelector(selector);
+const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;
+
+async function load() {
+  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
+  tools = loadedTools; render(tools);
+  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
+}
+function render(items) {
+  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
+    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
+    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
+    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
+}
+$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
+$("#tools").addEventListener("click", event => {
+  const id = event.target.dataset.borrow; if (!id) return;
+  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
+  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
+});
+$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
+for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
+async function submit(form, endpoint, dialog, message) {
+  const payload = Object.fromEntries(new FormData(form));
+  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
+  const result = await response.json(); if (!response.ok) return alert(result.error);
+  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
+}
+$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
+$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
+load();
diff --git a/public/index.html b/public/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..e0779308ead77b449de8ff462a1890f9860e923f
--- /dev/null
+++ b/public/index.html
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Toolshed</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/queue.css"></head>
+<body>
+  <header><a class="brand" href="#">TOOLSHED <span>Northwood Association</span></a><button id="listButton">+ List a tool</button></header>
+  <main><section class="hero"><p class="eyebrow">BORROW LOCAL · BUILD TOGETHER</p><h1>The right tool is<br>closer than you think.</h1><p>Borrow trusted tools from neighbors. Your deposit stays safe and comes back when the tool does.</p></section>
+  <section class="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><input id="search" placeholder="Search tools…" aria-label="Search tools"></section>
+  <section id="tools" class="grid" aria-live="polite"></section>
+  <section class="queue"><div class="toolbar"><div><p class="eyebrow">OWNER VIEW</p><h2>Borrow requests</h2><p>Reliable borrowers appear first</p></div></div><div id="requests"></div></section></main>
+  <dialog id="borrowDialog"><form id="borrowForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">BORROW REQUEST</p><h2 id="borrowTitle"></h2><input type="hidden" name="toolId"><label>Pick-up date<input required type="date" name="from"></label><label>Return date<input required type="date" name="to"></label><div id="terms" class="terms"></div><button type="submit">Request and continue to deposit</button><p class="fine">The MVP records this request offchain. After approval, the borrower approves USDC and calls <code>createLoan</code>.</p></form></dialog>
+  <dialog id="listDialog"><form id="listForm"><button class="close" value="cancel" formmethod="dialog">×</button><p class="eyebrow">SHARE WITH NEIGHBORS</p><h2>List a tool</h2><label>Name<input required name="name" placeholder="Cordless drill"></label><label>Photo URL<input required type="url" name="photo" placeholder="https://…"></label><label>Condition notes<textarea required name="condition"></textarea></label><div class="split"><label>Deposit (USDC)<input required min="1" type="number" name="deposit"></label><label>Late fee / day<input required min="0" type="number" name="dailyFee"></label></div><button type="submit">Publish listing</button></form></dialog>
+  <div id="toast" role="status"></div><script type="module" src="/app.js"></script>
+</body></html>
diff --git a/public/queue.css b/public/queue.css
new file mode 100644
index 0000000000000000000000000000000000000000..990d248c732c916b8981d4e78a11b94b4fa4e2f4
--- /dev/null
+++ b/public/queue.css
@@ -0,0 +1,4 @@
+.queue { padding-bottom: 80px; }
+.request { display: grid; grid-template-columns: 1.1fr 1.3fr 1.4fr auto; gap: 18px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
+.request span { font-size: 13px; }
+@media (max-width: 750px) { .request { grid-template-columns: 1fr; } .request button { width: 100%; } }
diff --git a/public/styles.css b/public/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..8905b764d49af7652c6f1b59f68daaf4d16341af
--- /dev/null
+++ b/public/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
+:root{--ink:#17312b;--cream:#f3f0e6;--acid:#d9f24f;--orange:#e66d42;--line:#b8b9ab}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font:700 24px 'Space Grotesk';color:inherit;text-decoration:none}.brand span{font:400 12px 'DM Sans';margin-left:12px;opacity:.65}button{border:0;background:var(--ink);color:white;padding:13px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--orange)}main{width:min(1180px,90vw);margin:auto}.hero{padding:82px 0 64px;display:grid;grid-template-columns:2fr 1fr;align-items:end}.hero h1{font:700 clamp(48px,7vw,94px)/.9 'Space Grotesk';letter-spacing:-.06em;margin:12px 0;grid-row:2/4}.hero>p:last-child{font-size:18px;line-height:1.5}.eyebrow,.owner{font-size:11px;font-weight:700;letter-spacing:.15em}.toolbar{border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:28px 0}.toolbar h2{margin:0;font:700 28px 'Space Grotesk'}.toolbar p{margin:4px 0;color:#69746f}.toolbar input{background:transparent;border:1px solid var(--line);padding:12px;width:240px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:80px}.card{border:1px solid var(--line);background:#faf8f0}.photo{height:240px;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.photo span{position:absolute;top:12px;left:12px;background:var(--acid);padding:7px;font-weight:700}.cardbody{padding:20px}.card h3{font:700 25px 'Space Grotesk';margin:7px 0}.cardbody>p:not(.owner){min-height:48px;color:#5c6863}.owner{color:#6d7742}.money{border-top:1px solid var(--line);padding:15px 0;font-size:13px}.money strong{font-size:17px}.money span{float:right}.card button{width:100%}dialog{border:0;padding:0;max-width:480px;width:92%;background:var(--cream);box-shadow:0 20px 80px #10251f66}dialog::backdrop{background:#17312bcc}dialog form{padding:34px;position:relative}dialog h2{font:700 34px 'Space Grotesk';margin:5px 0 24px}.close{position:absolute;right:16px;top:16px;background:transparent;color:var(--ink);font-size:24px;padding:5px}label{display:block;font-size:13px;font-weight:700;margin:14px 0}label input,label textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:white;padding:12px;font:inherit}textarea{height:80px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.terms{background:var(--acid);padding:15px;margin:20px 0;font-weight:700}.fine{font-size:12px;color:#65706c}.fine code{font-size:11px}#toast{position:fixed;right:24px;bottom:24px;background:var(--acid);color:var(--ink);padding:16px 24px;font-weight:700;transform:translateY(100px);transition:.25s}#toast.show{transform:none}@media(max-width:750px){.hero{display:block;padding:55px 0}.hero h1{margin:18px 0 28px}.grid{grid-template-columns:1fr}.toolbar input{width:150px}.brand span{display:none}}
diff --git a/server/server.js b/server/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..cc7de48d3ebb8493e831ece1668128d2c6732397
--- /dev/null
+++ b/server/server.js
@@ -0,0 +1,58 @@
+import http from "node:http";
+import { readFile } from "node:fs/promises";
+import { extname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
+const members = [
+  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
+  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
+  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
+];
+const tools = [
+  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
+  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
+  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
+];
+const requests = [
+  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
+  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
+];
+
+const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
+const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
+
+const server = http.createServer(async (req, res) => {
+  const url = new URL(req.url, "http://localhost");
+  if (url.pathname === "/api/tools" && req.method === "GET") {
+    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
+      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
+    return json(res, 200, ranked);
+  }
+  if (url.pathname === "/api/tools" && req.method === "POST") {
+    const input = await body(req);
+    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
+    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
+    tools.push(tool); return json(res, 201, tool);
+  }
+  if (url.pathname === "/api/requests" && req.method === "POST") {
+    const input = await body(req);
+    const tool = tools.find(t => t.id === input.toolId);
+    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
+    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
+    requests.push(request); return json(res, 201, request);
+  }
+  if (url.pathname === "/api/requests" && req.method === "GET") {
+    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
+      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
+    return json(res, 200, queue);
+  }
+  const path = url.pathname === "/" ? "/index.html" : url.pathname;
+  try {
+    const data = await readFile(join(root, path));
+    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
+    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
+  } catch { res.writeHead(404); res.end("Not found"); }
+});
+
+server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));

tokens used
60,951
Built Toolshed’s first runnable MVP.

Included:

- Neighborhood tool browse, listing, and borrowing-request UI
- Reliability-ranked borrower queue
- Dependency-free Node.js API with seeded demo data
- USDC escrow smart contract with:
  - Member allowlisting
  - Deposits and full on-time refunds
  - Capped daily late fees paid to owners
  - Loan cancellation
  - Association dispute resolution
  - Two-step admin transfer
- Four passing Foundry tests
- Base Sepolia deployment, verification, multisig, and end-to-end transaction runbook

Start it with:

```bash
npm start
```

Then open `http://localhost:3000`.

Tests:

```bash
npm test
```

Full architecture and deployment documentation is in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-2/workspace/README.md). Contract tests passed, and the UI/API smoke test verified the reliability ordering and request flow.
