OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048e7-2cce-7651-b79c-bad932262cbe
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

2026-08-28T15:05:05.216485Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048e7-2cce-7651-b79c-bad932262cbe.tmp-1787929504978934761: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request needs the product boundary, contract surface, incentives, launch chain, and deployment path nailed down alongside the implementation. I’ll first inspect the workspace and the skill’s requirements, then build and verify the runnable first version.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && printf '\\nFILES\\n' && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,200p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
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

FILES
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && find . -maxdepth 2 -type f -not -path './.git/*' -not -path './.agents/*' -print" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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
./TASK.md

codex
The workspace is empty, so I’m treating this as a greenfield vertical slice. The smallest credible version is one escrow contract for USDC and loan lifecycle facts, with tool photos/metadata and reputation-derived sorting in the web app; Base Sepolia will be the single launch target so deposits can be tested cheaply with Circle’s test USDC.
exec
/bin/bash -lc 'node --version; npm --version; forge --version || true; solc --version || true; git status --short' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
 succeeded in 234ms:
10.9.7
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/contracts/MockUSDC.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/contracts/ToolshedEscrow.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/foundry.toml
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+

diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/index.html
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/package.json
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/src/main.jsx
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/test/ToolshedEscrow.t.sol
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..25ad285f48f8292e8e95bbb238c0e2d0ce29a6c6
--- /dev/null
+++ b/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..55faef6e427913e17dc0e7a8811ecc9b4e0b86ea
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,70 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{tools.map((tool, i) => <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ New member</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>)}</div>
+    </section><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}

diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..25ad285f48f8292e8e95bbb238c0e2d0ce29a6c6
--- /dev/null
+++ b/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..55faef6e427913e17dc0e7a8811ecc9b4e0b86ea
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,70 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{tools.map((tool, i) => <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ New member</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>)}</div>
+    </section><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/.env.example
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/.gitignore
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/src/main.jsx
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/src/styles.css
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..25ad285f48f8292e8e95bbb238c0e2d0ce29a6c6
--- /dev/null
+++ b/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..25ad285f48f8292e8e95bbb238c0e2d0ce29a6c6
--- /dev/null
+++ b/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}

codex
The vertical slice is now implemented: members can list tools locally, request with an escrowed USDC deposit, complete the handoff lifecycle, and see rankings derived from settled-loan history. I’m at the verification/runbook stage now—checking contract behavior and pinning the deployment instructions to official Base/Circle network data.
web search: 
web search: site:developers.circle.com Base Sepolia USDC contract address ...
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..25ad285f48f8292e8e95bbb238c0e2d0ce29a6c6
--- /dev/null
+++ b/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}

2026-08-28T15:08:54.919394Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 13, Unexpected line found in update hunk: '*** Add File: vite.config.js'. Every line should start with ' ' (context line), '+' (added line), or '-' (removed line)
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..25ad285f48f8292e8e95bbb238c0e2d0ce29a6c6
--- /dev/null
+++ b/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/data/tools.json
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/package.json
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/server/index.js
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/vite.config.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

exec
/bin/bash -lc "rg -n \"seedTools|localStorage|function addTool|requestLoan\\(id|Listings stay\" src/main.jsx" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
18:const seedTools = [
27:  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
34:  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
51:  function addTool(e) {
68:      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
96:    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

2026-08-28T15:09:38.248233Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/src/main.jsx:
    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage">
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..03fcb240f09e58984f9ff39e2bb9c6c169e536af
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+const seedTools = [
+  { name: "Cordless drill", owner: "", condition: "Good; one battery, charger included", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80", deposit: "30", fee: "2" },
+  { name: "6 ft step ladder", owner: "", condition: "Paint marks, feet and locks are sound", image: "https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&w=800&q=80", deposit: "40", fee: "3" }
+];
+
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState(() => JSON.parse(localStorage.getItem("toolshed.tools") || "null") || seedTools);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => localStorage.setItem("toolshed.tools", JSON.stringify(tools)), [tools]);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  function addTool(e) {
+    e.preventDefault();
+    setTools(v => [{ ...form }, ...v]);
+    setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(`${tool.owner}:${tool.name}`), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/src/main.jsx
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

2026-08-28T15:09:59.008583Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/src/main.jsx:
<small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small>
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/README.md
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

exec
/bin/bash -lc 'forge test -vv && npm install && npm run build' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
2026-08-28T15:10:52.937104Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1811ms:
Compiling 3 files with Solc 0.8.20
Solc 0.8.20 finished in 280.49ms
Compiler run successful!
2026-08-28T15:10:51.429090Z  WARN evm::traces::external: etherscan config not found

Ran 6 tests for test/ToolshedEscrow.t.sol:ToolshedEscrowTest
[PASS] testCancellationReturnsEscrow() (gas: 160609)
[PASS] testLateFeeIsCappedAtDeposit() (gas: 240759)
[PASS] testLateFeeRoundsUpAndPaysOwner() (gas: 244142)
[PASS] testNonMemberCannotRequest() (gas: 13701)
[PASS] testOnTimeReturnRefundsFullDeposit() (gas: 195912)
[PASS] testStewardCanResolveStalledReturn() (gas: 240694)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 823.04µs (1.64ms CPU time)

Ran 1 test suite in 7.89ms (823.04µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
2026-08-28T15:10:51.438463Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/7c38bc54
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/@vitejs%2fplugin-react: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/7c38bc54'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

codex
Contract verification is clean: all six lifecycle, refund, late-fee rounding/cap, membership, and steward-resolution tests pass. The web build hit only an environment issue—the default npm cache is read-only here—so I’m rerunning it with a writable temporary cache and then doing a quick API smoke test.
exec
/bin/bash -lc 'npm install --cache /tmp/toolshed-npm-cache && npm run build && (npm run api > /tmp/toolshed-api.log 2>&1 & api_pid=$!; sleep 1; curl -fsS http://localhost:8787/api/tools; kill $api_pid)' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
 succeeded in 9742ms:

added 117 packages, and audited 118 packages in 8s

48 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

> build
> vite build

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vite.config.js:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
vite v8.2.2 building client environment for production...
transforming...
✓ 162 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.16 kB │ gzip:   0.14 kB
dist/assets/index-BV3A-hZ8.css    2.86 kB │ gzip:   1.16 kB
dist/assets/index-DyDBZwrK.js   449.26 kB │ gzip: 154.63 kB

✓ built in 372ms
[]
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

exec
/bin/bash -lc 'npx --yes --cache /tmp/toolshed-npm-cache prettier --write src/main.jsx vite.config.js server/index.js' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
 succeeded in 1634ms:
src/main.jsx 92ms
vite.config.js 3ms
server/index.js 8ms

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

exec
/bin/bash -lc "rg -n \"Listings stay|type\\\"|type\" src/main.jsx package.json | tail -10; git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
 succeeded in 0ms:
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..730925302a3d6c564dcda99d1b3da34d4bd27348
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..efc9dd1b2219123eecada99640edc8c49d480735
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,96 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)", "function cancelRequest(uint256)", "function rejectRequest(uint256)",
+  "function markReturned(uint256)", "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)"
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured"; }
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({ name: "", owner: "", condition: "", image: "", deposit: "25", fee: "2" });
+  const provider = useMemo(() => window.ethereum ? new BrowserProvider(window.ethereum) : null, []);
+
+  useEffect(() => { fetch("/api/tools").then(r => r.json()).then(setTools).catch(() => setNotice("The listings API is offline.")); }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(tools.filter(t => t.owner).map(async t => {
+      const [loans, late] = await Promise.all([contract.completedLoans(t.owner), contract.lateReturns(t.owner)]);
+      return [t.owner.toLowerCase(), { loans: Number(loans), late: Number(late) }];
+    })).then(entries => setScores(Object.fromEntries(entries))).catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm(v => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(form) });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools(v => [body, ...v]); setForm(v => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC) return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner) return setNotice("This demo listing needs an owner address before it can be borrowed.");
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (await new Contract(ESCROW, escrowAbi, signer).requestLoan(id(tool.id), tool.owner, due, deposit, parseUnits(tool.fee, 6))).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId) return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(ESCROW, escrowAbi, await provider.getSigner());
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) { setNotice(error.shortMessage || error.message); }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return (sb.loans - sb.late) - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return <main>
+    <header><div><span className="eyebrow">MAPLE STREET ASSOCIATION</span><h1>Toolshed</h1><p>Borrow nearby. Return on time. Keep useful things in circulation.</p></div><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></header>
+    {notice && <aside onClick={() => setNotice("")}>{notice}<span>×</span></aside>}
+    <section className="intro"><div><b>{tools.length}</b><span>tools shared</span></div><div><b>USDC</b><span>refundable deposits</span></div><div><b>300</b><span>neighbors, one shed</span></div></section>
+    <div className="layout"><section><div className="section-title"><div><span className="eyebrow">AVAILABLE NEARBY</span><h2>Find the right tool</h2></div><span>Sorted by owner reliability</span></div>
+      <div className="grid">{rankedTools.map((tool, i) => { const score = scores[tool.owner?.toLowerCase()] || {loans:0,late:0}; return <article key={i}><img src={tool.image || "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"}/><div className="card-body"><span className="available">AVAILABLE</span><h3>{tool.name}</h3><p>{tool.condition}</p><div className="owner"><span>{short(tool.owner)}</span><span>★ {score.loans} loans · {score.late} late</span></div><div className="terms"><span><b>${tool.deposit}</b> deposit</span><span><b>${tool.fee}</b>/day late</span></div><button onClick={() => borrow(tool, 3)}>Request for 3 days</button></div></article>})}</div>
+    </section><div><form onSubmit={addTool}><span className="eyebrow">ADD TO THE SHED</span><h2>List your tool</h2><label>What is it?<input required value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Owner wallet<input required value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}/></label><label>Photo URL<input value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></label><label>Condition notes<textarea required value={form.condition} onChange={e => setForm({...form, condition:e.target.value})}/></label><div className="pair"><label>Deposit ($)<input value={form.deposit} onChange={e => setForm({...form, deposit:e.target.value})}/></label><label>Late / day ($)<input value={form.fee} onChange={e => setForm({...form, fee:e.target.value})}/></label></div><button>List tool</button><small>Listings stay in this browser for the MVP. Escrow and loan history are onchain.</small></form><section className="manage"><span className="eyebrow">LOAN HANDOFF</span><h2>Manage a loan</h2><label>Loan ID<input value={loanId} onChange={e => setLoanId(e.target.value)}/></label><div className="actions"><button onClick={() => act("acceptLoan")}>Accept</button><button onClick={() => act("markReturned")}>Mark returned</button><button onClick={() => act("confirmReturn")}>Confirm & settle</button><button onClick={() => act("cancelRequest")}>Cancel</button><button onClick={() => act("rejectRequest")}>Reject</button></div></section></div></div>
+  </main>;
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/package.json
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/src/main.jsx
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..01ad64894a359a5454338535ad907e607b69f5cb
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..7d65767d81e56c351efc92c233b697443ed18f81
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,317 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)",
+  "function cancelRequest(uint256)",
+  "function rejectRequest(uint256)",
+  "function markReturned(uint256)",
+  "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)",
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) {
+  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured";
+}
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({
+    name: "",
+    owner: "",
+    condition: "",
+    image: "",
+    deposit: "25",
+    fee: "2",
+  });
+  const provider = useMemo(
+    () => (window.ethereum ? new BrowserProvider(window.ethereum) : null),
+    [],
+  );
+
+  useEffect(() => {
+    fetch("/api/tools")
+      .then((r) => r.json())
+      .then(setTools)
+      .catch(() => setNotice("The listings API is offline."));
+  }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(
+      tools
+        .filter((t) => t.owner)
+        .map(async (t) => {
+          const [loans, late] = await Promise.all([
+            contract.completedLoans(t.owner),
+            contract.lateReturns(t.owner),
+          ]);
+          return [
+            t.owner.toLowerCase(),
+            { loans: Number(loans), late: Number(late) },
+          ];
+        }),
+    )
+      .then((entries) => setScores(Object.fromEntries(entries)))
+      .catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm((v) => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", {
+      method: "POST",
+      headers: { "content-type": "application/json" },
+      body: JSON.stringify(form),
+    });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools((v) => [body, ...v]);
+    setForm((v) => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC)
+      return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner)
+      return setNotice(
+        "This demo listing needs an owner address before it can be borrowed.",
+      );
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (
+        await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)
+      ).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (
+        await new Contract(ESCROW, escrowAbi, signer).requestLoan(
+          id(tool.id),
+          tool.owner,
+          due,
+          deposit,
+          parseUnits(tool.fee, 6),
+        )
+      ).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId)
+      return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(
+        ESCROW,
+        escrowAbi,
+        await provider.getSigner(),
+      );
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return sb.loans - sb.late - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return (
+    <main>
+      <header>
+        <div>
+          <span className="eyebrow">MAPLE STREET ASSOCIATION</span>
+          <h1>Toolshed</h1>
+          <p>
+            Borrow nearby. Return on time. Keep useful things in circulation.
+          </p>
+        </div>
+        <button onClick={connect}>
+          {account ? short(account) : "Connect wallet"}
+        </button>
+      </header>
+      {notice && (
+        <aside onClick={() => setNotice("")}>
+          {notice}
+          <span>×</span>
+        </aside>
+      )}
+      <section className="intro">
+        <div>
+          <b>{tools.length}</b>
+          <span>tools shared</span>
+        </div>
+        <div>
+          <b>USDC</b>
+          <span>refundable deposits</span>
+        </div>
+        <div>
+          <b>300</b>
+          <span>neighbors, one shed</span>
+        </div>
+      </section>
+      <div className="layout">
+        <section>
+          <div className="section-title">
+            <div>
+              <span className="eyebrow">AVAILABLE NEARBY</span>
+              <h2>Find the right tool</h2>
+            </div>
+            <span>Sorted by owner reliability</span>
+          </div>
+          <div className="grid">
+            {rankedTools.map((tool, i) => {
+              const score = scores[tool.owner?.toLowerCase()] || {
+                loans: 0,
+                late: 0,
+              };
+              return (
+                <article key={i}>
+                  <img
+                    src={
+                      tool.image ||
+                      "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"
+                    }
+                  />
+                  <div className="card-body">
+                    <span className="available">AVAILABLE</span>
+                    <h3>{tool.name}</h3>
+                    <p>{tool.condition}</p>
+                    <div className="owner">
+                      <span>{short(tool.owner)}</span>
+                      <span>
+                        ★ {score.loans} loans · {score.late} late
+                      </span>
+                    </div>
+                    <div className="terms">
+                      <span>
+                        <b>${tool.deposit}</b> deposit
+                      </span>
+                      <span>
+                        <b>${tool.fee}</b>/day late
+                      </span>
+                    </div>
+                    <button onClick={() => borrow(tool, 3)}>
+                      Request for 3 days
+                    </button>
+                  </div>
+                </article>
+              );
+            })}
+          </div>
+        </section>
+        <div>
+          <form onSubmit={addTool}>
+            <span className="eyebrow">ADD TO THE SHED</span>
+            <h2>List your tool</h2>
+            <label>
+              What is it?
+              <input
+                required
+                value={form.name}
+                onChange={(e) => setForm({ ...form, name: e.target.value })}
+              />
+            </label>
+            <label>
+              Owner wallet
+              <input
+                required
+                value={form.owner}
+                onChange={(e) => setForm({ ...form, owner: e.target.value })}
+              />
+            </label>
+            <label>
+              Photo URL
+              <input
+                value={form.image}
+                onChange={(e) => setForm({ ...form, image: e.target.value })}
+              />
+            </label>
+            <label>
+              Condition notes
+              <textarea
+                required
+                value={form.condition}
+                onChange={(e) =>
+                  setForm({ ...form, condition: e.target.value })
+                }
+              />
+            </label>
+            <div className="pair">
+              <label>
+                Deposit ($)
+                <input
+                  value={form.deposit}
+                  onChange={(e) =>
+                    setForm({ ...form, deposit: e.target.value })
+                  }
+                />
+              </label>
+              <label>
+                Late / day ($)
+                <input
+                  value={form.fee}
+                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
+                />
+              </label>
+            </div>
+            <button>List tool</button>
+            <small>
+              Listings are shared by the association API. Escrow and loan
+              history are onchain.
+            </small>
+          </form>
+          <section className="manage">
+            <span className="eyebrow">LOAN HANDOFF</span>
+            <h2>Manage a loan</h2>
+            <label>
+              Loan ID
+              <input
+                value={loanId}
+                onChange={(e) => setLoanId(e.target.value)}
+              />
+            </label>
+            <div className="actions">
+              <button onClick={() => act("acceptLoan")}>Accept</button>
+              <button onClick={() => act("markReturned")}>Mark returned</button>
+              <button onClick={() => act("confirmReturn")}>
+                Confirm & settle
+              </button>
+              <button onClick={() => act("cancelRequest")}>Cancel</button>
+              <button onClick={() => act("rejectRequest")}>Reject</button>
+            </div>
+          </section>
+        </div>
+      </div>
+    </main>
+  );
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..01ad64894a359a5454338535ad907e607b69f5cb
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..7d65767d81e56c351efc92c233b697443ed18f81
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,317 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)",
+  "function cancelRequest(uint256)",
+  "function rejectRequest(uint256)",
+  "function markReturned(uint256)",
+  "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)",
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) {
+  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured";
+}
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({
+    name: "",
+    owner: "",
+    condition: "",
+    image: "",
+    deposit: "25",
+    fee: "2",
+  });
+  const provider = useMemo(
+    () => (window.ethereum ? new BrowserProvider(window.ethereum) : null),
+    [],
+  );
+
+  useEffect(() => {
+    fetch("/api/tools")
+      .then((r) => r.json())
+      .then(setTools)
+      .catch(() => setNotice("The listings API is offline."));
+  }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(
+      tools
+        .filter((t) => t.owner)
+        .map(async (t) => {
+          const [loans, late] = await Promise.all([
+            contract.completedLoans(t.owner),
+            contract.lateReturns(t.owner),
+          ]);
+          return [
+            t.owner.toLowerCase(),
+            { loans: Number(loans), late: Number(late) },
+          ];
+        }),
+    )
+      .then((entries) => setScores(Object.fromEntries(entries)))
+      .catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm((v) => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", {
+      method: "POST",
+      headers: { "content-type": "application/json" },
+      body: JSON.stringify(form),
+    });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools((v) => [body, ...v]);
+    setForm((v) => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC)
+      return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner)
+      return setNotice(
+        "This demo listing needs an owner address before it can be borrowed.",
+      );
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (
+        await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)
+      ).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (
+        await new Contract(ESCROW, escrowAbi, signer).requestLoan(
+          id(tool.id),
+          tool.owner,
+          due,
+          deposit,
+          parseUnits(tool.fee, 6),
+        )
+      ).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId)
+      return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(
+        ESCROW,
+        escrowAbi,
+        await provider.getSigner(),
+      );
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return sb.loans - sb.late - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return (
+    <main>
+      <header>
+        <div>
+          <span className="eyebrow">MAPLE STREET ASSOCIATION</span>
+          <h1>Toolshed</h1>
+          <p>
+            Borrow nearby. Return on time. Keep useful things in circulation.
+          </p>
+        </div>
+        <button onClick={connect}>
+          {account ? short(account) : "Connect wallet"}
+        </button>
+      </header>
+      {notice && (
+        <aside onClick={() => setNotice("")}>
+          {notice}
+          <span>×</span>
+        </aside>
+      )}
+      <section className="intro">
+        <div>
+          <b>{tools.length}</b>
+          <span>tools shared</span>
+        </div>
+        <div>
+          <b>USDC</b>
+          <span>refundable deposits</span>
+        </div>
+        <div>
+          <b>300</b>
+          <span>neighbors, one shed</span>
+        </div>
+      </section>
+      <div className="layout">
+        <section>
+          <div className="section-title">
+            <div>
+              <span className="eyebrow">AVAILABLE NEARBY</span>
+              <h2>Find the right tool</h2>
+            </div>
+            <span>Sorted by owner reliability</span>
+          </div>
+          <div className="grid">
+            {rankedTools.map((tool, i) => {
+              const score = scores[tool.owner?.toLowerCase()] || {
+                loans: 0,
+                late: 0,
+              };
+              return (
+                <article key={i}>
+                  <img
+                    src={
+                      tool.image ||
+                      "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"
+                    }
+                  />
+                  <div className="card-body">
+                    <span className="available">AVAILABLE</span>
+                    <h3>{tool.name}</h3>
+                    <p>{tool.condition}</p>
+                    <div className="owner">
+                      <span>{short(tool.owner)}</span>
+                      <span>
+                        ★ {score.loans} loans · {score.late} late
+                      </span>
+                    </div>
+                    <div className="terms">
+                      <span>
+                        <b>${tool.deposit}</b> deposit
+                      </span>
+                      <span>
+                        <b>${tool.fee}</b>/day late
+                      </span>
+                    </div>
+                    <button onClick={() => borrow(tool, 3)}>
+                      Request for 3 days
+                    </button>
+                  </div>
+                </article>
+              );
+            })}
+          </div>
+        </section>
+        <div>
+          <form onSubmit={addTool}>
+            <span className="eyebrow">ADD TO THE SHED</span>
+            <h2>List your tool</h2>
+            <label>
+              What is it?
+              <input
+                required
+                value={form.name}
+                onChange={(e) => setForm({ ...form, name: e.target.value })}
+              />
+            </label>
+            <label>
+              Owner wallet
+              <input
+                required
+                value={form.owner}
+                onChange={(e) => setForm({ ...form, owner: e.target.value })}
+              />
+            </label>
+            <label>
+              Photo URL
+              <input
+                value={form.image}
+                onChange={(e) => setForm({ ...form, image: e.target.value })}
+              />
+            </label>
+            <label>
+              Condition notes
+              <textarea
+                required
+                value={form.condition}
+                onChange={(e) =>
+                  setForm({ ...form, condition: e.target.value })
+                }
+              />
+            </label>
+            <div className="pair">
+              <label>
+                Deposit ($)
+                <input
+                  value={form.deposit}
+                  onChange={(e) =>
+                    setForm({ ...form, deposit: e.target.value })
+                  }
+                />
+              </label>
+              <label>
+                Late / day ($)
+                <input
+                  value={form.fee}
+                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
+                />
+              </label>
+            </div>
+            <button>List tool</button>
+            <small>
+              Listings are shared by the association API. Escrow and loan
+              history are onchain.
+            </small>
+          </form>
+          <section className="manage">
+            <span className="eyebrow">LOAN HANDOFF</span>
+            <h2>Manage a loan</h2>
+            <label>
+              Loan ID
+              <input
+                value={loanId}
+                onChange={(e) => setLoanId(e.target.value)}
+              />
+            </label>
+            <div className="actions">
+              <button onClick={() => act("acceptLoan")}>Accept</button>
+              <button onClick={() => act("markReturned")}>Mark returned</button>
+              <button onClick={() => act("confirmReturn")}>
+                Confirm & settle
+              </button>
+              <button onClick={() => act("cancelRequest")}>Cancel</button>
+              <button onClick={() => act("rejectRequest")}>Reject</button>
+            </div>
+          </section>
+        </div>
+      </div>
+    </main>
+  );
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

exec
/bin/bash -lc "forge test && npm run build && git diff --check && rg --files -g '"'!node_modules/**'"' -g '"'!out/**'"' -g '"'!dist/**'"' | sort" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace
 succeeded in 832ms:
Compiling 3 files with Solc 0.8.20
Solc 0.8.20 finished in 265.60ms
Compiler run successful!
2026-08-28T15:11:39.541307Z  WARN evm::traces::external: etherscan config not found

Ran 6 tests for test/ToolshedEscrow.t.sol:ToolshedEscrowTest
[PASS] testCancellationReturnsEscrow() (gas: 160609)
[PASS] testLateFeeIsCappedAtDeposit() (gas: 240759)
[PASS] testLateFeeRoundsUpAndPaysOwner() (gas: 244142)
[PASS] testNonMemberCannotRequest() (gas: 13701)
[PASS] testOnTimeReturnRefundsFullDeposit() (gas: 195912)
[PASS] testStewardCanResolveStalledReturn() (gas: 240694)
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 924.02µs (1.77ms CPU time)

Ran 1 test suite in 7.58ms (924.02µs CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
2026-08-28T15:11:39.549801Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

> build
> vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 162 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.16 kB │ gzip:   0.14 kB
dist/assets/index-BV3A-hZ8.css    2.86 kB │ gzip:   1.16 kB
dist/assets/index-BlMsxJwD.js   449.27 kB │ gzip: 154.64 kB

✓ built in 258ms
README.md
TASK.md
contracts/MockUSDC.sol
contracts/ToolshedEscrow.sol
data/tools.json
foundry.toml
index.html
package-lock.json
package.json
server/index.js
src/main.jsx
src/styles.css
test/ToolshedEscrow.t.sol
vite.config.js

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..01ad64894a359a5454338535ad907e607b69f5cb
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..7d65767d81e56c351efc92c233b697443ed18f81
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,317 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)",
+  "function cancelRequest(uint256)",
+  "function rejectRequest(uint256)",
+  "function markReturned(uint256)",
+  "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)",
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) {
+  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured";
+}
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({
+    name: "",
+    owner: "",
+    condition: "",
+    image: "",
+    deposit: "25",
+    fee: "2",
+  });
+  const provider = useMemo(
+    () => (window.ethereum ? new BrowserProvider(window.ethereum) : null),
+    [],
+  );
+
+  useEffect(() => {
+    fetch("/api/tools")
+      .then((r) => r.json())
+      .then(setTools)
+      .catch(() => setNotice("The listings API is offline."));
+  }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(
+      tools
+        .filter((t) => t.owner)
+        .map(async (t) => {
+          const [loans, late] = await Promise.all([
+            contract.completedLoans(t.owner),
+            contract.lateReturns(t.owner),
+          ]);
+          return [
+            t.owner.toLowerCase(),
+            { loans: Number(loans), late: Number(late) },
+          ];
+        }),
+    )
+      .then((entries) => setScores(Object.fromEntries(entries)))
+      .catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm((v) => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", {
+      method: "POST",
+      headers: { "content-type": "application/json" },
+      body: JSON.stringify(form),
+    });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools((v) => [body, ...v]);
+    setForm((v) => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC)
+      return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner)
+      return setNotice(
+        "This demo listing needs an owner address before it can be borrowed.",
+      );
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (
+        await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)
+      ).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (
+        await new Contract(ESCROW, escrowAbi, signer).requestLoan(
+          id(tool.id),
+          tool.owner,
+          due,
+          deposit,
+          parseUnits(tool.fee, 6),
+        )
+      ).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId)
+      return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(
+        ESCROW,
+        escrowAbi,
+        await provider.getSigner(),
+      );
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return sb.loans - sb.late - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return (
+    <main>
+      <header>
+        <div>
+          <span className="eyebrow">MAPLE STREET ASSOCIATION</span>
+          <h1>Toolshed</h1>
+          <p>
+            Borrow nearby. Return on time. Keep useful things in circulation.
+          </p>
+        </div>
+        <button onClick={connect}>
+          {account ? short(account) : "Connect wallet"}
+        </button>
+      </header>
+      {notice && (
+        <aside onClick={() => setNotice("")}>
+          {notice}
+          <span>×</span>
+        </aside>
+      )}
+      <section className="intro">
+        <div>
+          <b>{tools.length}</b>
+          <span>tools shared</span>
+        </div>
+        <div>
+          <b>USDC</b>
+          <span>refundable deposits</span>
+        </div>
+        <div>
+          <b>300</b>
+          <span>neighbors, one shed</span>
+        </div>
+      </section>
+      <div className="layout">
+        <section>
+          <div className="section-title">
+            <div>
+              <span className="eyebrow">AVAILABLE NEARBY</span>
+              <h2>Find the right tool</h2>
+            </div>
+            <span>Sorted by owner reliability</span>
+          </div>
+          <div className="grid">
+            {rankedTools.map((tool, i) => {
+              const score = scores[tool.owner?.toLowerCase()] || {
+                loans: 0,
+                late: 0,
+              };
+              return (
+                <article key={i}>
+                  <img
+                    src={
+                      tool.image ||
+                      "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"
+                    }
+                  />
+                  <div className="card-body">
+                    <span className="available">AVAILABLE</span>
+                    <h3>{tool.name}</h3>
+                    <p>{tool.condition}</p>
+                    <div className="owner">
+                      <span>{short(tool.owner)}</span>
+                      <span>
+                        ★ {score.loans} loans · {score.late} late
+                      </span>
+                    </div>
+                    <div className="terms">
+                      <span>
+                        <b>${tool.deposit}</b> deposit
+                      </span>
+                      <span>
+                        <b>${tool.fee}</b>/day late
+                      </span>
+                    </div>
+                    <button onClick={() => borrow(tool, 3)}>
+                      Request for 3 days
+                    </button>
+                  </div>
+                </article>
+              );
+            })}
+          </div>
+        </section>
+        <div>
+          <form onSubmit={addTool}>
+            <span className="eyebrow">ADD TO THE SHED</span>
+            <h2>List your tool</h2>
+            <label>
+              What is it?
+              <input
+                required
+                value={form.name}
+                onChange={(e) => setForm({ ...form, name: e.target.value })}
+              />
+            </label>
+            <label>
+              Owner wallet
+              <input
+                required
+                value={form.owner}
+                onChange={(e) => setForm({ ...form, owner: e.target.value })}
+              />
+            </label>
+            <label>
+              Photo URL
+              <input
+                value={form.image}
+                onChange={(e) => setForm({ ...form, image: e.target.value })}
+              />
+            </label>
+            <label>
+              Condition notes
+              <textarea
+                required
+                value={form.condition}
+                onChange={(e) =>
+                  setForm({ ...form, condition: e.target.value })
+                }
+              />
+            </label>
+            <div className="pair">
+              <label>
+                Deposit ($)
+                <input
+                  value={form.deposit}
+                  onChange={(e) =>
+                    setForm({ ...form, deposit: e.target.value })
+                  }
+                />
+              </label>
+              <label>
+                Late / day ($)
+                <input
+                  value={form.fee}
+                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
+                />
+              </label>
+            </div>
+            <button>List tool</button>
+            <small>
+              Listings are shared by the association API. Escrow and loan
+              history are onchain.
+            </small>
+          </form>
+          <section className="manage">
+            <span className="eyebrow">LOAN HANDOFF</span>
+            <h2>Manage a loan</h2>
+            <label>
+              Loan ID
+              <input
+                value={loanId}
+                onChange={(e) => setLoanId(e.target.value)}
+              />
+            </label>
+            <div className="actions">
+              <button onClick={() => act("acceptLoan")}>Accept</button>
+              <button onClick={() => act("markReturned")}>Mark returned</button>
+              <button onClick={() => act("confirmReturn")}>
+                Confirm & settle
+              </button>
+              <button onClick={() => act("cancelRequest")}>Cancel</button>
+              <button onClick={() => act("rejectRequest")}>Reject</button>
+            </div>
+          </section>
+        </div>
+      </div>
+    </main>
+  );
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

codex
Built the first runnable Toolshed version.

Included:

- React/Vite neighborhood lending interface
- Shared Node API for tool listings, photos, conditions, deposits, and late fees
- USDC escrow contract with membership gating
- Request, accept, cancel, reject, return, and settlement lifecycle
- Daily late-fee rounding and deposit caps
- Onchain completed-loan and late-return history
- Reliability-based browse ordering
- Association steward dispute resolution
- Six passing Foundry tests
- Base Sepolia deployment and verification runbook
- Architecture, liveness table, limitations, and launch checklist

Start locally:

```bash
npm install
cp .env.example .env
forge test
npm run dev
```

The app runs at `http://localhost:5173`.

Full setup and deployment details are in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/README.md).

Verification completed:

- `forge test`: 6 passed
- `npm run build`: succeeded
- API smoke test: succeeded
- `git diff --check`: clean
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..03034e7c4a040a0cf8a63baf62d2b49580b7a38c
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+VITE_ESCROW_ADDRESS=0xYourDeployedEscrow
+VITE_USDC_ADDRESS=0xBaseSepoliaUSDC
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..d841940c35ad629e76ab2db06b50f204e2eb5966
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,5 @@
+node_modules/
+out/
+cache/
+dist/
+.env
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..62de91fc7dc8f92faa8b7db5ca230f16bdfad7bf
--- /dev/null
+++ b/README.md
@@ -0,0 +1,92 @@
+# Toolshed
+
+Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.
+
+## Architecture and MVP boundary
+
+- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
+- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
+- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
+- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.
+
+Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
+| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
+| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
+| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
+| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
+| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
+| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
+| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
+| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |
+
+Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.
+
+## Run locally
+
+Prerequisites: Node 22+, npm, Foundry, and a browser wallet.
+
+```bash
+npm install
+cp .env.example .env
+forge test
+npm run dev
+```
+
+The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.
+
+## Base Sepolia deployment
+
+The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Create a deployer keystore and define the deployment inputs:
+
+```bash
+cast wallet import toolshed-deployer --interactive
+export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
+```
+
+Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:
+
+```bash
+forge test
+forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
+  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
+  --broadcast --verify --verifier sourcify
+export ESCROW_ADDRESS=0xAddressPrintedByForge
+cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:
+
+1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
+2. Add a tool in the UI owned by the lender.
+3. Borrower requests it; note the emitted loan ID. Lender accepts it.
+4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.
+
+Configure and build the app:
+
+```bash
+cp .env.example .env
+# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
+npm install
+npm run build
+```
+
+Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.
+
+## Pre-launch checklist
+
+- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
+- Run `forge test` and an end-to-end loan on Base Sepolia.
+- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
+- Commission an independent contract security review before using real USDC or moving to Base mainnet.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a647477299cfbf7623ab724a2cdc215307b2677
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,25 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
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
+    function transfer(address to, uint256 amount) external returns (bool) { return transferFrom(msg.sender, to, amount); }
+    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
+        if (from != msg.sender) {
+            uint256 allowed = allowance[from][msg.sender];
+            require(allowed >= amount, "allowance");
+            allowance[from][msg.sender] = allowed - amount;
+        }
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
diff --git a/contracts/ToolshedEscrow.sol b/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cbd211e2fb585f6a00825e11e8b2afb2bee73579
--- /dev/null
+++ b/contracts/ToolshedEscrow.sol
@@ -0,0 +1,156 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
+/// @notice USDC escrow and canonical loan history for a member-run tool library.
+contract ToolshedEscrow {
+    enum Status { None, Requested, Active, Returned, Settled, Cancelled, Rejected }
+
+    struct Loan {
+        bytes32 toolId;
+        address borrower;
+        address lender;
+        uint64 requestedAt;
+        uint64 dueAt;
+        uint64 returnedAt;
+        uint128 deposit;
+        uint128 lateFeePerDay;
+        Status status;
+    }
+
+    IERC20 public immutable usdc;
+    address public owner;
+    uint256 public nextLoanId = 1;
+    mapping(address => bool) public isMember;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => uint256) public completedLoans;
+    mapping(address => uint256) public lateReturns;
+
+    event MembershipSet(address indexed member, bool active);
+    event LoanRequested(uint256 indexed loanId, bytes32 indexed toolId, address indexed borrower, address lender, uint256 dueAt, uint256 deposit, uint256 lateFeePerDay);
+    event LoanAccepted(uint256 indexed loanId);
+    event ReturnMarked(uint256 indexed loanId, uint256 returnedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee, bool late);
+    event LoanClosed(uint256 indexed loanId, Status status);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    modifier onlyOwner() { require(msg.sender == owner, "only owner"); _; }
+    modifier onlyMember() { require(isMember[msg.sender], "not member"); _; }
+
+    constructor(address usdc_, address owner_) {
+        require(usdc_ != address(0) && owner_ != address(0), "zero address");
+        usdc = IERC20(usdc_);
+        owner = owner_;
+        emit OwnershipTransferred(address(0), owner_);
+    }
+
+    function setMember(address member, bool active) external onlyOwner {
+        require(member != address(0), "zero member");
+        isMember[member] = active;
+        emit MembershipSet(member, active);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        require(newOwner != address(0), "zero owner");
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function requestLoan(bytes32 toolId, address lender, uint64 dueAt, uint128 deposit, uint128 lateFeePerDay)
+        external onlyMember returns (uint256 loanId)
+    {
+        require(isMember[lender] && lender != msg.sender, "invalid lender");
+        require(toolId != bytes32(0) && dueAt > block.timestamp, "invalid request");
+        require(deposit > 0 && lateFeePerDay <= deposit, "invalid terms");
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, lender, uint64(block.timestamp), dueAt, 0, deposit, lateFeePerDay, Status.Requested);
+        _safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, lender, dueAt, deposit, lateFeePerDay);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot accept");
+        require(loan.dueAt > block.timestamp, "due date passed");
+        loan.status = Status.Active;
+        emit LoanAccepted(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Requested, "cannot cancel");
+        loan.status = Status.Cancelled;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Cancelled);
+    }
+
+    function rejectRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Requested, "cannot reject");
+        loan.status = Status.Rejected;
+        _safeTransfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, Status.Rejected);
+    }
+
+    function markReturned(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.borrower && loan.status == Status.Active, "cannot return");
+        loan.status = Status.Returned;
+        loan.returnedAt = uint64(block.timestamp);
+        emit ReturnMarked(loanId, block.timestamp);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        require(msg.sender == loan.lender && loan.status == Status.Returned, "cannot confirm");
+        _settle(loanId, loan);
+    }
+
+    /// @notice Association steward resolves a stalled handoff after checking the physical tool.
+    function stewardSettle(uint256 loanId, uint64 returnedAt) external onlyOwner {
+        Loan storage loan = loans[loanId];
+        require(loan.status == Status.Active || loan.status == Status.Returned, "cannot settle");
+        require(returnedAt >= loan.requestedAt && returnedAt <= block.timestamp, "invalid return time");
+        loan.returnedAt = returnedAt;
+        loan.status = Status.Returned;
+        _settle(loanId, loan);
+    }
+
+    function previewSettlement(uint256 loanId) external view returns (uint256 refund, uint256 fee) {
+        Loan storage loan = loans[loanId];
+        uint256 at = loan.returnedAt == 0 ? block.timestamp : loan.returnedAt;
+        fee = _lateFee(loan, at);
+        refund = uint256(loan.deposit) - fee;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan) internal {
+        uint256 fee = _lateFee(loan, loan.returnedAt);
+        uint256 refund = uint256(loan.deposit) - fee;
+        bool late = loan.returnedAt > loan.dueAt;
+        loan.status = Status.Settled;
+        completedLoans[loan.borrower]++;
+        if (late) lateReturns[loan.borrower]++;
+        if (fee != 0) _safeTransfer(loan.lender, fee);
+        if (refund != 0) _safeTransfer(loan.borrower, refund);
+        emit LoanSettled(loanId, refund, fee, late);
+    }
+
+    function _lateFee(Loan storage loan, uint256 at) internal view returns (uint256) {
+        if (at <= loan.dueAt) return 0;
+        uint256 daysLate = (at - loan.dueAt + 1 days - 1) / 1 days;
+        uint256 fee = daysLate * uint256(loan.lateFeePerDay);
+        return fee > loan.deposit ? loan.deposit : fee;
+    }
+
+    function _safeTransfer(address to, uint256 amount) internal {
+        require(usdc.transfer(to, amount), "USDC transfer failed");
+    }
+
+    function _safeTransferFrom(address from, address to, uint256 amount) internal {
+        require(usdc.transferFrom(from, to, amount), "USDC transferFrom failed");
+    }
+}
diff --git a/data/tools.json b/data/tools.json
new file mode 100644
index 0000000000000000000000000000000000000000..fe51488c7066f6687ef680d6bfaa4f7768ef205c
--- /dev/null
+++ b/data/tools.json
@@ -0,0 +1 @@
+[]
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a504d583580575df098f4a1ae7b2a684aa627ffd
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,9 @@
+[profile.default]
+src = "contracts"
+test = "test"
+script = "script"
+out = "out"
+solc_version = "0.8.20"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/index.html b/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..fb91b485d98d729ee30e084cf0353b339d2be133
--- /dev/null
+++ b/index.html
@@ -0,0 +1 @@
+<div id="root"></div><script type="module" src="/src/main.jsx"></script>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..01ad64894a359a5454338535ad907e607b69f5cb
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "dev": "concurrently \"npm:api\" \"npm:web\"",
+    "web": "vite",
+    "api": "node server/index.js",
+    "build": "vite build",
+    "test": "forge test"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "concurrently": "latest",
+    "express": "latest",
+    "ethers": "^6.13.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/server/index.js b/server/index.js
new file mode 100644
index 0000000000000000000000000000000000000000..b3e2befe9edcd0bb22b87bd07f29a0e1a10f1bde
--- /dev/null
+++ b/server/index.js
@@ -0,0 +1,19 @@
+import express from "express";
+import { readFile, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+const app = express();
+const file = join(dirname(fileURLToPath(import.meta.url)), "../data/tools.json");
+app.use(express.json({ limit: "100kb" }));
+app.get("/api/tools", async (_req, res) => res.json(JSON.parse(await readFile(file, "utf8"))));
+app.post("/api/tools", async (req, res) => {
+  const { name, owner, condition, image, deposit, fee } = req.body;
+  if (![name, owner, condition, deposit, fee].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Missing fields" });
+  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return res.status(400).json({ error: "Invalid owner wallet" });
+  const tools = JSON.parse(await readFile(file, "utf8"));
+  const tool = { id: crypto.randomUUID(), name, owner, condition, image: image || "", deposit, fee };
+  tools.unshift(tool);
+  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
+  res.status(201).json(tool);
+});
+app.listen(process.env.PORT || 8787, () => console.log("Toolshed API listening on http://localhost:8787"));
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..7d65767d81e56c351efc92c233b697443ed18f81
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,317 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
+import "./styles.css";
+
+const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const escrowAbi = [
+  "function isMember(address) view returns(bool)",
+  "function completedLoans(address) view returns(uint256)",
+  "function lateReturns(address) view returns(uint256)",
+  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
+  "function acceptLoan(uint256)",
+  "function cancelRequest(uint256)",
+  "function rejectRequest(uint256)",
+  "function markReturned(uint256)",
+  "function confirmReturn(uint256)",
+  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)",
+];
+const erc20Abi = ["function approve(address,uint256) returns(bool)"];
+function short(a) {
+  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured";
+}
+
+function App() {
+  const [account, setAccount] = useState("");
+  const [tools, setTools] = useState([]);
+  const [notice, setNotice] = useState("");
+  const [loanId, setLoanId] = useState("");
+  const [scores, setScores] = useState({});
+  const [form, setForm] = useState({
+    name: "",
+    owner: "",
+    condition: "",
+    image: "",
+    deposit: "25",
+    fee: "2",
+  });
+  const provider = useMemo(
+    () => (window.ethereum ? new BrowserProvider(window.ethereum) : null),
+    [],
+  );
+
+  useEffect(() => {
+    fetch("/api/tools")
+      .then((r) => r.json())
+      .then(setTools)
+      .catch(() => setNotice("The listings API is offline."));
+  }, []);
+  useEffect(() => {
+    if (!provider || !ESCROW || !account) return;
+    const contract = new Contract(ESCROW, escrowAbi, provider);
+    Promise.all(
+      tools
+        .filter((t) => t.owner)
+        .map(async (t) => {
+          const [loans, late] = await Promise.all([
+            contract.completedLoans(t.owner),
+            contract.lateReturns(t.owner),
+          ]);
+          return [
+            t.owner.toLowerCase(),
+            { loans: Number(loans), late: Number(late) },
+          ];
+        }),
+    )
+      .then((entries) => setScores(Object.fromEntries(entries)))
+      .catch(() => {});
+  }, [account, tools, provider]);
+
+  async function connect() {
+    if (!provider) return setNotice("Install a browser wallet first.");
+    const [address] = await provider.send("eth_requestAccounts", []);
+    setAccount(address);
+    setForm((v) => ({ ...v, owner: v.owner || address }));
+  }
+
+  async function addTool(e) {
+    e.preventDefault();
+    const response = await fetch("/api/tools", {
+      method: "POST",
+      headers: { "content-type": "application/json" },
+      body: JSON.stringify(form),
+    });
+    const body = await response.json();
+    if (!response.ok) return setNotice(body.error || "Could not list tool");
+    setTools((v) => [body, ...v]);
+    setForm((v) => ({ ...v, name: "", condition: "", image: "" }));
+  }
+
+  async function borrow(tool, days) {
+    if (!ESCROW || !USDC)
+      return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
+    if (!account) return connect();
+    if (!tool.owner)
+      return setNotice(
+        "This demo listing needs an owner address before it can be borrowed.",
+      );
+    try {
+      const signer = await provider.getSigner();
+      const deposit = parseUnits(tool.deposit, 6);
+      setNotice("1/2 Approve the USDC deposit in your wallet…");
+      await (
+        await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)
+      ).wait();
+      setNotice("2/2 Place the loan request…");
+      const due = Math.floor(Date.now() / 1000) + days * 86400;
+      await (
+        await new Contract(ESCROW, escrowAbi, signer).requestLoan(
+          id(tool.id),
+          tool.owner,
+          due,
+          deposit,
+          parseUnits(tool.fee, 6),
+        )
+      ).wait();
+      setNotice("Request sent. The owner can now accept it onchain.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  async function act(method) {
+    if (!account) return connect();
+    if (!ESCROW || !loanId)
+      return setNotice("Enter a loan ID and configure the escrow address.");
+    try {
+      setNotice("Confirm the transaction in your wallet…");
+      const contract = new Contract(
+        ESCROW,
+        escrowAbi,
+        await provider.getSigner(),
+      );
+      await (await contract[method](loanId)).wait();
+      setNotice("Loan updated successfully.");
+    } catch (error) {
+      setNotice(error.shortMessage || error.message);
+    }
+  }
+
+  const rankedTools = [...tools].sort((a, b) => {
+    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
+    return sb.loans - sb.late - (sa.loans - sa.late) || sb.loans - sa.loans;
+  });
+
+  return (
+    <main>
+      <header>
+        <div>
+          <span className="eyebrow">MAPLE STREET ASSOCIATION</span>
+          <h1>Toolshed</h1>
+          <p>
+            Borrow nearby. Return on time. Keep useful things in circulation.
+          </p>
+        </div>
+        <button onClick={connect}>
+          {account ? short(account) : "Connect wallet"}
+        </button>
+      </header>
+      {notice && (
+        <aside onClick={() => setNotice("")}>
+          {notice}
+          <span>×</span>
+        </aside>
+      )}
+      <section className="intro">
+        <div>
+          <b>{tools.length}</b>
+          <span>tools shared</span>
+        </div>
+        <div>
+          <b>USDC</b>
+          <span>refundable deposits</span>
+        </div>
+        <div>
+          <b>300</b>
+          <span>neighbors, one shed</span>
+        </div>
+      </section>
+      <div className="layout">
+        <section>
+          <div className="section-title">
+            <div>
+              <span className="eyebrow">AVAILABLE NEARBY</span>
+              <h2>Find the right tool</h2>
+            </div>
+            <span>Sorted by owner reliability</span>
+          </div>
+          <div className="grid">
+            {rankedTools.map((tool, i) => {
+              const score = scores[tool.owner?.toLowerCase()] || {
+                loans: 0,
+                late: 0,
+              };
+              return (
+                <article key={i}>
+                  <img
+                    src={
+                      tool.image ||
+                      "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"
+                    }
+                  />
+                  <div className="card-body">
+                    <span className="available">AVAILABLE</span>
+                    <h3>{tool.name}</h3>
+                    <p>{tool.condition}</p>
+                    <div className="owner">
+                      <span>{short(tool.owner)}</span>
+                      <span>
+                        ★ {score.loans} loans · {score.late} late
+                      </span>
+                    </div>
+                    <div className="terms">
+                      <span>
+                        <b>${tool.deposit}</b> deposit
+                      </span>
+                      <span>
+                        <b>${tool.fee}</b>/day late
+                      </span>
+                    </div>
+                    <button onClick={() => borrow(tool, 3)}>
+                      Request for 3 days
+                    </button>
+                  </div>
+                </article>
+              );
+            })}
+          </div>
+        </section>
+        <div>
+          <form onSubmit={addTool}>
+            <span className="eyebrow">ADD TO THE SHED</span>
+            <h2>List your tool</h2>
+            <label>
+              What is it?
+              <input
+                required
+                value={form.name}
+                onChange={(e) => setForm({ ...form, name: e.target.value })}
+              />
+            </label>
+            <label>
+              Owner wallet
+              <input
+                required
+                value={form.owner}
+                onChange={(e) => setForm({ ...form, owner: e.target.value })}
+              />
+            </label>
+            <label>
+              Photo URL
+              <input
+                value={form.image}
+                onChange={(e) => setForm({ ...form, image: e.target.value })}
+              />
+            </label>
+            <label>
+              Condition notes
+              <textarea
+                required
+                value={form.condition}
+                onChange={(e) =>
+                  setForm({ ...form, condition: e.target.value })
+                }
+              />
+            </label>
+            <div className="pair">
+              <label>
+                Deposit ($)
+                <input
+                  value={form.deposit}
+                  onChange={(e) =>
+                    setForm({ ...form, deposit: e.target.value })
+                  }
+                />
+              </label>
+              <label>
+                Late / day ($)
+                <input
+                  value={form.fee}
+                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
+                />
+              </label>
+            </div>
+            <button>List tool</button>
+            <small>
+              Listings are shared by the association API. Escrow and loan
+              history are onchain.
+            </small>
+          </form>
+          <section className="manage">
+            <span className="eyebrow">LOAN HANDOFF</span>
+            <h2>Manage a loan</h2>
+            <label>
+              Loan ID
+              <input
+                value={loanId}
+                onChange={(e) => setLoanId(e.target.value)}
+              />
+            </label>
+            <div className="actions">
+              <button onClick={() => act("acceptLoan")}>Accept</button>
+              <button onClick={() => act("markReturned")}>Mark returned</button>
+              <button onClick={() => act("confirmReturn")}>
+                Confirm & settle
+              </button>
+              <button onClick={() => act("cancelRequest")}>Cancel</button>
+              <button onClick={() => act("rejectRequest")}>Reject</button>
+            </div>
+          </section>
+        </div>
+      </div>
+    </main>
+  );
+}
+createRoot(document.getElementById("root")).render(<App />);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..df81d2285c18edb1df8828a89ad2d25dcf5fa099
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#283029;background:#f4f0e7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer;border:0;border-radius:5px;background:#c75935;color:#fff;padding:.8rem 1rem;font-weight:700}main{max-width:1220px;margin:auto;padding:30px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbc5b7;padding:20px 0 32px}h1,h2,h3{font-family:Fraunces,serif;margin:.15em 0}h1{font-size:4rem;color:#304b35}h2{font-size:2rem}header p{margin:.4rem 0;color:#6e716b}.eyebrow{font-size:.7rem;letter-spacing:.16em;font-weight:700;color:#a3482b}aside{position:sticky;top:12px;z-index:3;margin:15px 0;background:#304b35;color:#fff;padding:14px 18px;border-radius:6px;display:flex;justify-content:space-between}.intro{display:grid;grid-template-columns:repeat(3,1fr);background:#304b35;color:white;margin:28px 0;padding:22px;border-radius:8px}.intro div{text-align:center;border-right:1px solid #667968}.intro div:last-child{border:0}.intro b,.intro span{display:block}.intro b{font-family:Fraunces;font-size:1.7rem}.intro span{font-size:.78rem;color:#d2d9d2}.layout{display:grid;grid-template-columns:minmax(0,2fr) 340px;gap:28px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.section-title>span{font-size:.75rem;color:#777}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article,form,.manage{background:#fff;border:1px solid #ded8cb;border-radius:8px;overflow:hidden;box-shadow:0 5px 20px #3b40380b}article img{width:100%;height:200px;object-fit:cover}.card-body{padding:18px}.available{color:#39754d;font-size:.65rem;font-weight:700;letter-spacing:.12em}.card-body p{min-height:42px;color:#6a6e67}.owner,.terms{display:flex;justify-content:space-between;padding:11px 0;border-top:1px solid #eee8dc;font-size:.78rem}.owner span:last-child{color:#39754d}.terms b{font-size:1rem}.card-body button{width:100%;margin-top:10px}form,.manage{padding:22px;margin-bottom:20px}label{display:block;font-size:.75rem;font-weight:700;margin:14px 0}input,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #cfc9bc;border-radius:4px;background:#fcfbf7;font:inherit}textarea{height:75px;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}form>button{width:100%}small{display:block;color:#777;margin-top:12px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button:nth-child(n+4){background:#72766f}@media(max-width:800px){main{padding:18px}h1{font-size:3rem}.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.intro{grid-template-columns:1fr;gap:15px}.intro div{border-right:0}.section-title>span{display:none}}
diff --git a/test/ToolshedEscrow.t.sol b/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b4f67db6e24ac70f351154f61da02bc32149d085
--- /dev/null
+++ b/test/ToolshedEscrow.t.sol
@@ -0,0 +1,89 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert() external;
+}
+
+contract ToolshedEscrowTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC token;
+    ToolshedEscrow escrow;
+    address borrower = address(0xB0B);
+    address lender = address(0xA11CE);
+    uint64 due;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(address(token), address(this));
+        escrow.setMember(borrower, true);
+        escrow.setMember(lender, true);
+        token.mint(borrower, 100e6);
+        vm.prank(borrower);
+        token.approve(address(escrow), type(uint256).max);
+        due = uint64(block.timestamp + 3 days);
+    }
+
+    function testOnTimeReturnRefundsFullDeposit() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due - 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(borrower), 100e6);
+        _eq(escrow.completedLoans(borrower), 1);
+        _eq(escrow.lateReturns(borrower), 0);
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 1 days + 1);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 4e6);
+        _eq(token.balanceOf(borrower), 96e6);
+        _eq(escrow.lateReturns(borrower), 1);
+    }
+
+    function testLateFeeIsCappedAtDeposit() public {
+        uint256 id = _request(5e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 20 days);
+        vm.prank(borrower); escrow.markReturned(id);
+        vm.prank(lender); escrow.confirmReturn(id);
+        _eq(token.balanceOf(lender), 5e6);
+        _eq(token.balanceOf(borrower), 95e6);
+    }
+
+    function testCancellationReturnsEscrow() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(borrower); escrow.cancelRequest(id);
+        _eq(token.balanceOf(borrower), 100e6);
+    }
+
+    function testNonMemberCannotRequest() public {
+        vm.prank(address(123)); vm.expectRevert();
+        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
+    }
+
+    function testStewardCanResolveStalledReturn() public {
+        uint256 id = _request(30e6, 2e6);
+        vm.prank(lender); escrow.acceptLoan(id);
+        vm.warp(due + 3 days);
+        escrow.stewardSettle(id, due + 1 days);
+        _eq(token.balanceOf(lender), 2e6);
+    }
+
+    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
+        vm.prank(borrower);
+        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
+    }
+
+    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..47325788deef5a7bdad43dcf2cb900786f23ce97
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,3 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:8787" } } });

tokens used
66,833
Built the first runnable Toolshed version.

Included:

- React/Vite neighborhood lending interface
- Shared Node API for tool listings, photos, conditions, deposits, and late fees
- USDC escrow contract with membership gating
- Request, accept, cancel, reject, return, and settlement lifecycle
- Daily late-fee rounding and deposit caps
- Onchain completed-loan and late-return history
- Reliability-based browse ordering
- Association steward dispute resolution
- Six passing Foundry tests
- Base Sepolia deployment and verification runbook
- Architecture, liveness table, limitations, and launch checklist

Start locally:

```bash
npm install
cp .env.example .env
forge test
npm run dev
```

The app runs at `http://localhost:5173`.

Full setup and deployment details are in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T150504Z-codex-with-skill-1/workspace/README.md).

Verification completed:

- `forge test`: 6 passed
- `npm run build`: succeeded
- API smoke test: succeeded
- `git diff --check`: clean
