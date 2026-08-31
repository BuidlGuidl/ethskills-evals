Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4b6-b2d0-71a2-ace4-93800a3c1c36
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
I’ll inspect the existing scaffold and repository guidance, then implement the smallest complete lending flow and verify it locally.
exec
/bin/bash -lc "pwd && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
TASK.md

exec
/bin/bash -lc "command -v forge || true; command -v node || true; sed -n '1,200p' TASK.md; git status --short" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 succeeded in 0ms:
/home/matt/.foundry/bin/forge
/home/matt/.nvm/versions/node/v24.13.0/bin/node
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
?? ../../
?? ../../../ship-quiz-001/
?? ../../../ship-quiz-002/
?? ../../../ship-quiz-003/
?? ../../../ship-quiz-004/

codex
The workspace is intentionally bare, so I’m treating v1 as an on-chain USDC escrow plus a thin client-facing read model. Core choices: owner approval before a loan starts, escrow at request time, owner-confirmed returns, capped late fees, and reputation derived only from completed loans.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..412848f69a84327cac57fa1ba3c9d5e6ce1a488d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..412848f69a84327cac57fa1ba3c9d5e6ce1a488d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,200 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

codex
Core implementation is in place. I’m compiling and running the lifecycle tests now; I’ll fix any ABI or state-machine issues the compiler exposes.
exec
/bin/bash -lc 'forge test -vv' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 exited 1 in 352ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

exec
/bin/bash -lc 'env XDG_CACHE_HOME=/tmp/toolshed-cache SVM_HOME=/tmp/toolshed-svm FOUNDRY_CACHE_PATH=/tmp/toolshed-forge-cache forge test -vv' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 exited 1 in 270ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

exec
/bin/bash -lc "forge config --json 2>&1 | sed -n '1,200p'; ls -ld . out cache broadcast 2>/dev/null || true; env | rg 'FOUNDRY|SVM|XDG'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 succeeded in 0ms:
{
  "src": "src",
  "test": "test",
  "script": "script",
  "out": "out",
  "libs": [
    "lib"
  ],
  "remappings": [],
  "auto_detect_remappings": true,
  "libraries": [],
  "cache": true,
  "dynamic_test_linking": false,
  "cache_path": "cache",
  "snapshots": "snapshots",
  "gas_snapshot_check": false,
  "gas_snapshot_emit": true,
  "broadcast": "broadcast",
  "allow_paths": [],
  "include_paths": [],
  "skip": [],
  "force": false,
  "evm_version": "cancun",
  "gas_reports": [
    "*"
  ],
  "gas_reports_ignore": [],
  "gas_reports_include_tests": false,
  "solc": "0.8.24",
  "auto_detect_solc": true,
  "offline": false,
  "optimizer": true,
  "optimizer_runs": 200,
  "optimizer_details": null,
  "model_checker": null,
  "verbosity": 0,
  "eth_rpc_url": null,
  "eth_rpc_accept_invalid_certs": false,
  "eth_rpc_jwt": null,
  "eth_rpc_timeout": null,
  "eth_rpc_headers": null,
  "etherscan_api_key": null,
  "ignored_error_codes": [
    "license",
    "code-size",
    "init-code-size",
    "transient-storage"
  ],
  "ignored_warnings_from": [],
  "deny": "never",
  "match_test": null,
  "no_match_test": null,
  "match_contract": null,
  "no_match_contract": null,
  "match_path": null,
  "no_match_path": null,
  "no_match_coverage": null,
  "test_failures_file": "cache/test-failures",
  "threads": null,
  "show_progress": false,
  "fuzz": {
    "runs": 256,
    "fail_on_revert": true,
    "max_test_rejects": 65536,
    "seed": null,
    "dictionary_weight": 40,
    "include_storage": true,
    "include_push_bytes": true,
    "max_fuzz_dictionary_addresses": 15728640,
    "max_fuzz_dictionary_values": 9830400,
    "max_fuzz_dictionary_literals": 6553600,
    "gas_report_samples": 256,
    "corpus_dir": null,
    "corpus_gzip": true,
    "corpus_min_mutations": 5,
    "corpus_min_size": 0,
    "show_edge_coverage": false,
    "failure_persist_dir": "cache/fuzz",
    "show_logs": false,
    "timeout": null
  },
  "invariant": {
    "runs": 256,
    "depth": 500,
    "fail_on_revert": false,
    "call_override": false,
    "dictionary_weight": 80,
    "include_storage": true,
    "include_push_bytes": true,
    "max_fuzz_dictionary_addresses": 15728640,
    "max_fuzz_dictionary_values": 9830400,
    "max_fuzz_dictionary_literals": 6553600,
    "shrink_run_limit": 5000,
    "max_assume_rejects": 65536,
    "gas_report_samples": 256,
    "corpus_dir": null,
    "corpus_gzip": true,
    "corpus_min_mutations": 5,
    "corpus_min_size": 0,
    "show_edge_coverage": false,
    "failure_persist_dir": "cache/invariant",
    "show_metrics": true,
    "timeout": null,
    "show_solidity": false
  },
  "ffi": false,
  "allow_internal_expect_revert": false,
  "always_use_create_2_factory": false,
  "prompt_timeout": 120,
  "sender": "0x1804c8ab1f12e6bbf3894d4083f33e07309d1f38",
  "tx_origin": "0x1804c8ab1f12e6bbf3894d4083f33e07309d1f38",
  "initial_balance": "0xffffffffffffffffffffffff",
  "block_number": 1,
  "fork_block_number": null,
  "chain_id": null,
  "gas_limit": 1073741824,
  "code_size_limit": null,
  "gas_price": null,
  "block_base_fee_per_gas": 0,
  "block_coinbase": "0x0000000000000000000000000000000000000000",
  "block_timestamp": 1,
  "block_difficulty": 0,
  "block_prevrandao": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "block_gas_limit": null,
  "memory_limit": 134217728,
  "extra_output": [],
  "extra_output_files": [],
  "names": false,
  "sizes": false,
  "via_ir": false,
  "ast": false,
  "rpc_storage_caching": {
    "chains": "all",
    "endpoints": "all"
  },
  "no_storage_caching": false,
  "no_rpc_rate_limit": false,
  "use_literal_content": false,
  "bytecode_hash": "ipfs",
  "cbor_metadata": true,
  "revert_strings": null,
  "sparse_mode": false,
  "build_info": false,
  "build_info_path": null,
  "fmt": {
    "line_length": 120,
    "tab_width": 4,
    "style": "space",
    "bracket_spacing": false,
    "int_types": "long",
    "multiline_func_header": "attributes_first",
    "quote_style": "double",
    "number_underscore": "preserve",
    "hex_underscore": "remove",
    "single_line_statement_blocks": "preserve",
    "override_spacing": false,
    "wrap_comments": false,
    "docs_style": "preserve",
    "ignore": [],
    "contract_new_lines": false,
    "sort_imports": false,
    "pow_no_space": false,
    "prefer_compact": "all",
    "single_line_imports": false
  },
  "lint": {
    "severity": [],
    "exclude_lints": [],
    "ignore": [],
    "lint_on_build": true,
    "mixed_case_exceptions": [
      "ERC",
      "URI"
    ]
  },
  "doc": {
    "out": "docs",
    "title": "",
    "book": "book.toml",
    "homepage": "README.md",
    "ignore": []
  },
  "bind_json": {
    "out": "utils/JsonBindings.sol",
    "include": [],
    "exclude": []
  },
  "fs_permissions": [
    {
      "access": "read",
      "path": "out"
    }
  ],
  "isolate": false,
  "disable_block_gas_limit": false,
  "enable_tx_gas_limit": false,
  "labels": {},
  "unchecked_cheatcode_artifacts": false,
  "create2_library_salt": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "create2_deployer": "0x4e59b44847b379578588920ca78fbf26c0b4956c",
drwxrwxr-x 9 matt matt 4096 Jul 30 13:31 .
XDG_CONFIG_DIRS=/etc/xdg/xdg-ubuntu-xorg:/etc/xdg
XDG_MENU_PREFIX=gnome-
XDG_SESSION_DESKTOP=ubuntu-xorg
XDG_SESSION_TYPE=x11
XDG_CURRENT_DESKTOP=ubuntu:GNOME
XDG_SESSION_CLASS=user
XDG_RUNTIME_DIR=/run/user/1000
XDG_DATA_DIRS=/usr/share/ubuntu-xorg:/usr/share/gnome:/home/matt/.local/share/flatpak/exports/share:/var/lib/flatpak/exports/share:/usr/local/share/:/usr/share/:/var/lib/snapd/desktop

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

exec
/bin/bash -lc "ls -la /home/matt/.svm 2>/dev/null; find /home/matt/.svm -maxdepth 3 -type f 2>/dev/null | sed -n '1,40p'; forge test --offline -vv 2>&1" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 exited 1 in 0ms:
Error: can't install missing solc 0.8.24 in offline mode

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

codex
The contract tests are currently blocked only by the sandbox preventing Foundry from installing its pinned compiler under the user cache. I’m using a temporary compiler binary instead, leaving the repository clean.
exec
/bin/bash -lc "curl -fsSL https://binaries.soliditylang.org/linux-amd64/list.json -o /tmp/toolshed-solc-list.json && rg -o 'solc-linux-amd64-v0\\.8\\.24\\+commit\\.[a-f0-9]+' /tmp/toolshed-solc-list.json | head -1" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 succeeded in 0ms:
solc-linux-amd64-v0.8.24+commit.e11b9ed9

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

exec
/bin/bash -lc "curl -fsSL 'https://binaries.soliditylang.org/linux-amd64/solc-linux-amd64-v0.8.24+commit.e11b9ed9' -o /tmp/toolshed-solc-0.8.24 && chmod +x /tmp/toolshed-solc-0.8.24 && forge test --use /tmp/toolshed-solc-0.8.24 -vv" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 exited 1 in 239ms:
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 6.48ms
Error: Compiler run failed:
Error (7364): Different number of components on the left hand side (6) than on the right hand side (7).
  --> test/Toolshed.t.sol:90:9:
   |
90 |         (, , , , , bool available) = shed.tools(toolId);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Error (9574): Type uint96 is not implicitly convertible to expected type bool.
  --> test/Toolshed.t.sol:90:9:
   |
90 |         (, , , , , bool available) = shed.tools(toolId);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..00bad8ca14ec3ea22a717d908a14f5403f7767dc
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..888768d673d710450294c4162a15f56cba4aab4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..888768d673d710450294c4162a15f56cba4aab4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

exec
/bin/bash -lc "forge test --use /tmp/toolshed-solc-0.8.24 -vv && forge fmt --check && git diff --check && find . -maxdepth 3 -type f -not -path './out/*' -not -path './cache/*' | sort" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 exited 1 in 211ms:
Solc 0.8.24 finished in 261.88ms
Compiler run successful!

Ran 3 tests for test/Toolshed.t.sol:ToolshedTest
[PASS] testLateFeeRoundsUpAndIsCapped() (gas: 329201)
[PASS] testOnTimeReturnRefundsDeposit() (gas: 296118)
[PASS] testRejectedRequestRefundsAndUnlocksTool() (gas: 273898)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 3.81ms (2.50ms CPU time)

Ran 1 test suite in 10.47ms (3.81ms CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
Diff in src/Toolshed.sol:
6   6    | /// @title Toolshed
7   7    | /// @notice USDC escrow and reputation for a member-run tool library.
8   8    | contract Toolshed {
9        |-    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
    9    |+    enum LoanStatus {
    10   |+        None,
    11   |+        Requested,
    12   |+        Active,
    13   |+        Completed,
    14   |+        Rejected,
    15   |+        Cancelled,
    16   |+        Defaulted
    17   |+    }
10  18   | 
11  19   |     struct Tool {
12  20   |         address owner;
--------------------------------------------------------------------------------27  35   |         LoanStatus status;
28  36   |     }
29  37   | 
30       |-    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
    38   |+    struct Reputation {
    39   |+        uint32 completedLoans;
    40   |+        uint32 lateReturns;
    41   |+    }
31  42   | 
32  43   |     IERC20 public immutable usdc;
33  44   |     uint256 public toolCount;
--------------------------------------------------------------------------------42  53   |     event ToolUpdated(uint256 indexed toolId);
43  54   |     event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
44  55   |     event LoanApproved(uint256 indexed loanId, uint40 dueAt);
45       |-    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
    56   |+    event LoanClosed(
    57   |+        uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late
    58   |+    );
46  59   | 
47  60   |     error Unauthorized();
48  61   |     error InvalidInput();

Diff in test/Toolshed.t.sol:
13  13   |     mapping(address => uint256) public balanceOf;
14  14   |     mapping(address => mapping(address => uint256)) public allowance;
15  15   | 
16       |-    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    16   |+    function mint(address to, uint256 amount) external {
    17   |+        balanceOf[to] += amount;
    18   |+    }
    19   |+
17  20   |     function approve(address spender, uint256 amount) external returns (bool) {
18  21   |         allowance[msg.sender][spender] = amount;
19  22   |         return true;
20  23   |     }
    24   |+
21  25   |     function transfer(address to, uint256 amount) external returns (bool) {
22  26   |         balanceOf[msg.sender] -= amount;
23  27   |         balanceOf[to] += amount;
24  28   |         return true;
25  29   |     }
    30   |+
26  31   |     function transferFrom(address from, address to, uint256 amount) external returns (bool) {
27  32   |         allowance[from][msg.sender] -= amount;
28  33   |         balanceOf[from] -= amount;
--------------------------------------------------------------------------------67  72   |         uint256 loanId = shed.requestLoan(toolId, 1);
68  73   |         vm.prank(OWNER);
69  74   |         shed.approveLoan(loanId);
70       |-        (, , , uint40 dueAt, , ) = shed.loans(loanId);
    75   |+        (,,, uint40 dueAt,,) = shed.loans(loanId);
71  76   |         vm.warp(uint256(dueAt) + 1 days + 1);
72  77   |         vm.prank(OWNER);
73  78   |         shed.confirmReturn(loanId);
--------------------------------------------------------------------------------87  92   |         vm.prank(OWNER);
88  93   |         shed.rejectLoan(loanId);
89  94   |         _eq(token.balanceOf(BORROWER), 1_000e6);
90       |-        (, , , , , , bool available) = shed.tools(toolId);
    95   |+        (,,,,,, bool available) = shed.tools(toolId);
91  96   |         require(available, "tool should be available");
92  97   |     }
93  98   | 

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..888768d673d710450294c4162a15f56cba4aab4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge test --use /tmp/toolshed-solc-0.8.24 -q && forge fmt --check && git diff --check' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 succeeded in 219ms:
Solc 0.8.24 finished in 259.49ms

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..25bf656a91fdd48d70fd8079b4238c7e4c81678c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Contract terms are snapshotted economically only by the escrowed deposit; owners should not edit a tool during an active loan. A production revision should snapshot every loan term and add explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..64716a756cb10199b5da63cf2c5ced4dabc7692f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus { None, Requested, Active, Completed, Rejected, Cancelled, Defaulted }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
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
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(toolId, msg.sender, uint40(block.timestamp), 0, durationDays, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, tool.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, tool.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * tool.dailyLateFee;
+        if (ownerPayment > tool.deposit) ownerPayment = tool.deposit;
+        uint256 refund = tool.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || tool.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(tool.deposit) + tool.dailyLateFee - 1) / tool.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, tool.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, tool.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..888768d673d710450294c4162a15f56cba4aab4c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,102 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (, , , uint40 dueAt, , ) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (, , , , , , bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

codex
Verification exposed an important escrow invariant in review: editable tool terms must not affect an existing loan. I’m snapshotting deposit and late-fee terms into each request so one listing update cannot underfund or redirect another borrower’s escrow.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c41ddb2e6171013a401a5519aba8ed9f6494342b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Deposit and late-fee terms are snapshotted on each request, so later listing edits cannot change an existing escrow. A production revision still needs explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b5b24140f43bbf6a4e5c78cdef4422980cf43310
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,225 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Completed,
+        Rejected,
+        Cancelled,
+        Defaulted
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint32 completedLoans;
+        uint32 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(
+        uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late
+    );
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            tool.deposit,
+            tool.dailyLateFee,
+            LoanStatus.Requested
+        );
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * loan.dailyLateFee;
+        if (ownerPayment > loan.deposit) ownerPayment = loan.deposit;
+        uint256 refund = loan.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || loan.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(loan.deposit) + loan.dailyLateFee - 1) / loan.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, loan.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8de377d77d6c36641bee49ca4e68b57b057c4635
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,107 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
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
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (,,, uint40 dueAt,,,,) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (,,,,,, bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c41ddb2e6171013a401a5519aba8ed9f6494342b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Deposit and late-fee terms are snapshotted on each request, so later listing edits cannot change an existing escrow. A production revision still needs explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b5b24140f43bbf6a4e5c78cdef4422980cf43310
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,225 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Completed,
+        Rejected,
+        Cancelled,
+        Defaulted
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint32 completedLoans;
+        uint32 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(
+        uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late
+    );
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            tool.deposit,
+            tool.dailyLateFee,
+            LoanStatus.Requested
+        );
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * loan.dailyLateFee;
+        if (ownerPayment > loan.deposit) ownerPayment = loan.deposit;
+        uint256 refund = loan.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || loan.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(loan.deposit) + loan.dailyLateFee - 1) / loan.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, loan.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8de377d77d6c36641bee49ca4e68b57b057c4635
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,107 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
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
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (,,, uint40 dueAt,,,,) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (,,,,,, bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

exec
/bin/bash -lc 'forge fmt && forge test --use /tmp/toolshed-solc-0.8.24 -vv && forge fmt --check && git diff --check && git status --short' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace
 succeeded in 236ms:
Solc 0.8.24 finished in 263.87ms
Compiler run successful!

Ran 3 tests for test/Toolshed.t.sol:ToolshedTest
[PASS] testLateFeeRoundsUpAndIsCapped() (gas: 330018)
[PASS] testOnTimeReturnRefundsDeposit() (gas: 296592)
[PASS] testRejectedRequestRefundsAndUnlocksTool() (gas: 274437)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 708.90µs (788.42µs CPU time)

Ran 1 test suite in 6.26ms (708.90µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
?? ../../
?? ../../../ship-quiz-001/
?? ../../../ship-quiz-002/
?? ../../../ship-quiz-003/
?? ../../../ship-quiz-004/

diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c41ddb2e6171013a401a5519aba8ed9f6494342b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Deposit and late-fee terms are snapshotted on each request, so later listing edits cannot change an existing escrow. A production revision still needs explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b5b24140f43bbf6a4e5c78cdef4422980cf43310
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,225 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Completed,
+        Rejected,
+        Cancelled,
+        Defaulted
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint32 completedLoans;
+        uint32 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(
+        uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late
+    );
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            tool.deposit,
+            tool.dailyLateFee,
+            LoanStatus.Requested
+        );
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * loan.dailyLateFee;
+        if (ownerPayment > loan.deposit) ownerPayment = loan.deposit;
+        uint256 refund = loan.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || loan.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(loan.deposit) + loan.dailyLateFee - 1) / loan.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, loan.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8de377d77d6c36641bee49ca4e68b57b057c4635
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,107 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
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
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (,,, uint40 dueAt,,,,) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (,,,,,, bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

codex
Shipped Toolshed v1:

- [USDC escrow contract](</home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol>)
- Tool listings, approvals, cancellations, returns, defaults
- Snapshotted loan terms and capped daily late fees
- Borrower reputation and applicant sorting helper
- Foundry deployment script
- [Architecture/setup/deployment README](</home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md>)
- Tests: 3 passed, 0 failed
- Formatting and diff checks passed
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c41ddb2e6171013a401a5519aba8ed9f6494342b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md
@@ -0,0 +1,48 @@
+# Toolshed
+
+Toolshed v1 is a small EVM contract for a neighborhood tool-lending group. Owners publish tool metadata, borrowers escrow USDC while requesting a loan, owners approve and later confirm physical returns, and the contract splits the escrow into a late fee and refund. Completed-loan reputation is public so a client can rank applicants reliably.
+
+## Architecture
+
+- `src/Toolshed.sol` is the state machine and USDC escrow. Tool photos are URLs (use IPFS, Arweave, or another durable host); image bytes do not belong on-chain.
+- `app/reputation.js` is the browse/applicant sorting policy. It sorts by on-time percentage, completed-loan count, then request time. A production UI should index `ToolListed`, `LoanRequested`, and `LoanClosed` events and hydrate current contract state.
+- `test/Toolshed.t.sol` exercises refund, rejection, late-fee rounding, and reputation behavior without external dependencies.
+- `script/Deploy.s.sol` deploys against an existing USDC contract.
+
+Loan lifecycle: `Requested -> Active -> Completed`. A borrower can cancel a pending request; an owner can reject it. Both paths refund all escrow. On return, each started late day costs `dailyLateFee`, capped at the deposit. After enough late days to consume the deposit, the owner can mark the loan defaulted. Funds move only after state changes and transfers are reentrancy-guarded.
+
+This is intentionally association-scale: enumeration/search/sorting happen in an event indexer, not expensive on-chain arrays. Reputation belongs to the borrower (the person whose reliability an owner evaluates). New members display as unrated; the included sorter does not penalize them, while proven members win the experience tie-break.
+
+## Run locally
+
+Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation) with Solidity 0.8.24.
+
+```sh
+forge build
+forge test -vv
+```
+
+The repository has no runtime package dependencies. `lib/` and `out/` are generated/ignored locations; all authored code is in `src/`, `test/`, `script/`, and `app/`.
+
+## Deploy
+
+Choose the USDC address for the target chain. For example, load a funded deployer key and an RPC endpoint into your shell, then run:
+
+```sh
+export USDC_ADDRESS=0xYourChainUsdcAddress
+export PRIVATE_KEY=0xYourDeployerPrivateKey
+export RPC_URL=https://your-rpc.example
+forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
+```
+
+Verify the emitted deployment address and configure the client/indexer with that address, the chain ID, and `USDC_ADDRESS`. Before listing a tool, choose deposit and daily-fee amounts in USDC base units (six decimals; `100e6` means 100 USDC). Before requesting, the borrower must call USDC `approve(toolshedAddress, deposit)`.
+
+For local end-to-end development, start Anvil (`anvil`), deploy any 6-decimal ERC-20 test token, set its address as `USDC_ADDRESS`, then deploy Toolshed with the command above using an Anvil key and `http://127.0.0.1:8545`.
+
+## Production checklist and v1 boundaries
+
+- Pin the intended chain and canonical USDC address; test on its testnet first.
+- Put deployment behind the association's multisig and verify source on the explorer.
+- Run an event indexer for browse/search and serve tool images from durable storage.
+- The owner is the physical-return oracle. v1 has no arbitration for a dishonest/unavailable owner, damage claims, member allowlist, or emergency admin recovery. Those require association governance and a dispute policy before holding meaningful deposits.
+- Deposit and late-fee terms are snapshotted on each request, so later listing edits cannot change an existing escrow. A production revision still needs explicit dispute/time-out handling before audit.
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
new file mode 100644
index 0000000000000000000000000000000000000000..e5bdedaff3761b0f2dcc07957598c09b450240a1
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/app/reputation.js
@@ -0,0 +1,14 @@
+/** Sort loan applicants for an owner: proven reliability first, then experience. */
+export function sortApplicants(applicants) {
+  return [...applicants].sort((a, b) => {
+    const aScore = a.completedLoans === 0 ? 10_000 : ((a.completedLoans - a.lateReturns) * 10_000) / a.completedLoans;
+    const bScore = b.completedLoans === 0 ? 10_000 : ((b.completedLoans - b.lateReturns) * 10_000) / b.completedLoans;
+    return bScore - aScore || b.completedLoans - a.completedLoans || a.requestedAt - b.requestedAt;
+  });
+}
+
+export function formatReputation({ completedLoans, lateReturns }) {
+  if (completedLoans === 0) return "New member — no completed loans";
+  const onTime = completedLoans - lateReturns;
+  return `${onTime}/${completedLoans} on time`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..8b3a2f7ae1003a24557299e4d7a06a33e316cb25
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/foundry.toml
@@ -0,0 +1,10 @@
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..65e79ce5a5abc3d302c93fb7759a73ad3876f20b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
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
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d527e9159756180cfba319b20219c462506ad07b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/IERC20.sol
@@ -0,0 +1,8 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..b5b24140f43bbf6a4e5c78cdef4422980cf43310
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol
@@ -0,0 +1,225 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./IERC20.sol";
+
+/// @title Toolshed
+/// @notice USDC escrow and reputation for a member-run tool library.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Completed,
+        Rejected,
+        Cancelled,
+        Defaulted
+    }
+
+    struct Tool {
+        address owner;
+        string name;
+        string photoURI;
+        string conditionNotes;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint40 requestedAt;
+        uint40 dueAt;
+        uint16 durationDays;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint32 completedLoans;
+        uint32 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    uint256 private locked = 1;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint16 durationDays);
+    event LoanApproved(uint256 indexed loanId, uint40 dueAt);
+    event LoanClosed(
+        uint256 indexed loanId, LoanStatus status, uint256 ownerPayment, uint256 borrowerRefund, bool late
+    );
+
+    error Unauthorized();
+    error InvalidInput();
+    error InvalidState();
+    error TransferFailed();
+    error Reentrancy();
+
+    modifier nonReentrant() {
+        if (locked != 1) revert Reentrancy();
+        locked = 2;
+        _;
+        locked = 1;
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
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee
+    ) external returns (uint256 toolId) {
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        toolId = ++toolCount;
+        tools[toolId] = Tool(msg.sender, name, photoURI, conditionNotes, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, name);
+    }
+
+    function updateTool(
+        uint256 toolId,
+        string calldata name,
+        string calldata photoURI,
+        string calldata conditionNotes,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        bool available
+    ) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(name).length == 0 || bytes(photoURI).length == 0 || deposit == 0 || dailyLateFee > deposit) {
+            revert InvalidInput();
+        }
+        tool.name = name;
+        tool.photoURI = photoURI;
+        tool.conditionNotes = conditionNotes;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId);
+    }
+
+    function requestLoan(uint256 toolId, uint16 durationDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender) revert InvalidState();
+        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
+
+        tool.available = false;
+        loanId = ++loanCount;
+        loans[loanId] = Loan(
+            toolId,
+            msg.sender,
+            uint40(block.timestamp),
+            0,
+            durationDays,
+            tool.deposit,
+            tool.dailyLateFee,
+            LoanStatus.Requested
+        );
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, durationDays);
+    }
+
+    function approveLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint40(block.timestamp + uint256(loan.durationDays) * 1 days);
+        emit LoanApproved(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Rejected, 0, loan.deposit, false);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidState();
+        loan.status = LoanStatus.Cancelled;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Cancelled, 0, loan.deposit, false);
+    }
+
+    /// @notice Owner calls after physically receiving and inspecting the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidState();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerPayment = lateDays * loan.dailyLateFee;
+        if (ownerPayment > loan.deposit) ownerPayment = loan.deposit;
+        uint256 refund = loan.deposit - ownerPayment;
+
+        loan.status = LoanStatus.Completed;
+        tool.available = true;
+        Reputation storage stats = reputation[loan.borrower];
+        stats.completedLoans++;
+        if (late) stats.lateReturns++;
+
+        if (ownerPayment != 0) _transfer(tool.owner, ownerPayment);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanClosed(loanId, LoanStatus.Completed, ownerPayment, refund, late);
+    }
+
+    /// @notice Lets an owner close a loan once late fees consume the full deposit.
+    function claimDefault(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active || loan.dailyLateFee == 0) revert InvalidState();
+        uint256 daysToConsume = (uint256(loan.deposit) + loan.dailyLateFee - 1) / loan.dailyLateFee;
+        if (block.timestamp <= uint256(loan.dueAt) + daysToConsume * 1 days) revert InvalidState();
+        loan.status = LoanStatus.Defaulted;
+        reputation[loan.borrower].completedLoans++;
+        reputation[loan.borrower].lateReturns++;
+        _transfer(tool.owner, loan.deposit);
+        emit LoanClosed(loanId, LoanStatus.Defaulted, loan.deposit, 0, true);
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        Reputation memory stats = reputation[member];
+        if (stats.completedLoans == 0) return 10_000;
+        return uint256(stats.completedLoans - stats.lateReturns) * 10_000 / stats.completedLoans;
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8de377d77d6c36641bee49ca4e68b57b057c4635
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/test/Toolshed.t.sol
@@ -0,0 +1,107 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {Toolshed} from "../src/Toolshed.sol";
+import {IERC20} from "../src/IERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract MockUSDC is IERC20 {
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
+        allowance[from][msg.sender] -= amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract ToolshedTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    Toolshed private shed;
+
+    function setUp() public {
+        token = new MockUSDC();
+        shed = new Toolshed(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(shed), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 3);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 0);
+    }
+
+    function testLateFeeRoundsUpAndIsCapped() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 1);
+        vm.prank(OWNER);
+        shed.approveLoan(loanId);
+        (,,, uint40 dueAt,,,,) = shed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        shed.confirmReturn(loanId);
+
+        _eq(token.balanceOf(OWNER), 20e6);
+        _eq(token.balanceOf(BORROWER), 980e6);
+        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
+        _eq(completed, 1);
+        _eq(late, 1);
+        _eq(shed.reliabilityBps(BORROWER), 0);
+    }
+
+    function testRejectedRequestRefundsAndUnlocksTool() public {
+        uint256 toolId = _list();
+        vm.prank(BORROWER);
+        uint256 loanId = shed.requestLoan(toolId, 2);
+        vm.prank(OWNER);
+        shed.rejectLoan(loanId);
+        _eq(token.balanceOf(BORROWER), 1_000e6);
+        (,,,,,, bool available) = shed.tools(toolId);
+        require(available, "tool should be available");
+    }
+
+    function _list() private returns (uint256) {
+        vm.prank(OWNER);
+        return shed.listTool("Drill", "ipfs://photo", "Good; worn chuck", 100e6, 10e6);
+    }
+
+    function _eq(uint256 actual, uint256 expected) private pure {
+        require(actual == expected, "not equal");
+    }
+}

tokens used
68,710
Shipped Toolshed v1:

- [USDC escrow contract](</home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/src/Toolshed.sol>)
- Tool listings, approvals, cancellations, returns, defaults
- Snapshotted loan terms and capped daily late fees
- Borrower reputation and applicant sorting helper
- Foundry deployment script
- [Architecture/setup/deployment README](</home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T202819Z-codex-no-skill-1/workspace/README.md>)
- Tests: 3 passed, 0 failed
- Formatting and diff checks passed
