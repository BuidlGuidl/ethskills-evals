OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048de-499e-72a2-9255-d0eb2b6c9d44
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

2026-08-28T14:55:22.768379Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048de-499e-72a2-9255-d0eb2b6c9d44.tmp-1787928922530651428: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the existing project structure and instructions first, then I’ll implement the smallest complete lending flow and verify it locally. I’ll keep all authored code and documentation in normal source paths, with generated output excluded.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,120p' && printf '\\nFILES\\n' && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,200p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
 succeeded in 5ms:
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && git status --short && git log --oneline -5 2>/dev/null" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
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
69063e0 workspace seed

codex
The workspace is intentionally empty, so I’m treating this as a greenfield MVP. I’m going with a Solidity escrow contract plus a lightweight React/Vite client: on-chain listings, USDC deposits, requests, returns, late-fee settlement, and borrower reliability ranking, without introducing a backend that a 300-member association does not need yet.
exec
/bin/bash -lc 'node --version; npm --version; forge --version 2>/dev/null || true; solc --version 2>/dev/null || true' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
 succeeded in 214ms:
10.9.7
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Linux.g++

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/.gitignore
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/contracts/MockUSDC.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/contracts/Toolshed.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/foundry.toml
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/package.json
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}

diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}

codex
The core escrow now has the full state machine, including two safeguards that matter in practice: late fees use the borrower’s recorded return time (not the owner’s confirmation time), and a borrower can finalize after a three-day owner response window so funds cannot be held indefinitely. I’m wiring the member-facing UI and contract tests around those rules now.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/.env.example
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/index.html
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/src/contracts.js
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/src/main.jsx
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/vite.config.js
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..636f381c53eb1a66c6bb85549ddd830e8e192e10
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,97 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans']].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..636f381c53eb1a66c6bb85549ddd830e8e192e10
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,97 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans']].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/script/Deploy.s.sol
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/src/styles.css
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/test/Toolshed.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..636f381c53eb1a66c6bb85549ddd830e8e192e10
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,97 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans']].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..170961d114686f500ac83bc3f3884e8de429b57a
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,60 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..636f381c53eb1a66c6bb85549ddd830e8e192e10
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,97 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans']].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..170961d114686f500ac83bc3f3884e8de429b57a
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,60 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

exec
/bin/bash -lc 'forge test -vv' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
exec
/bin/bash -lc 'npm install' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
 succeeded in 547ms:
Compiling 3 files with Solc 0.8.20
Solc 0.8.20 finished in 487.68ms
Compiler run successful!
2026-08-28T14:59:11.031155Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/Toolshed.t.sol:ToolshedTest
[PASS] testBorrowerCanFinalizeAfterOwnerTimeout() (gas: 239363)
[PASS] testLateFeeRoundsUpAndPaysOwner() (gas: 269670)
[PASS] testOnTimeLoanReturnsFullDepositAndBuildsReputation() (gas: 255405)
[PASS] testRejectedRequestRefundsDeposit() (gas: 205161)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 965.95µs (1.12ms CPU time)

Ran 1 test suite in 7.93ms (965.95µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
2026-08-28T14:59:11.039934Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

2026-08-28T14:59:12.191962Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1685ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/dd546cbb
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/@vitejs%2fplugin-react: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/dd546cbb'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..636f381c53eb1a66c6bb85549ddd830e8e192e10
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,97 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans']].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..170961d114686f500ac83bc3f3884e8de429b57a
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,60 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

codex
Contract verification is green: all four lifecycle tests pass, covering on-time returns, rounded-up daily late fees, owner rejection refunds, and the borrower timeout escape hatch. The frontend dependency install hit the environment’s read-only global npm cache, so I’m redirecting only npm’s cache to `/tmp` and continuing the build check.
exec
/bin/bash -lc 'npm install --cache /tmp/toolshed-npm-cache && npm run build' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
 succeeded in 8459ms:

added 30 packages, and audited 31 packages in 8s

11 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

> toolshed@0.1.0 build
> vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 163 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.46 kB │ gzip:  0.31 kB
dist/assets/index-DXLOsOYY.css    6.38 kB │ gzip:  2.19 kB
dist/assets/index-C6ALMJkM.js   288.70 kB │ gzip: 89.23 kB

✓ built in 165ms

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..636f381c53eb1a66c6bb85549ddd830e8e192e10
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,97 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans']].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..170961d114686f500ac83bc3f3884e8de429b57a
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,60 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/src/main.jsx
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..fd4fbedf59c03cc543dd37cc039bf9c88e54c1e4
--- /dev/null
+++ b/README.md
@@ -0,0 +1,121 @@
+# Toolshed
+
+Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.
+
+The app includes:
+
+- an admin-managed member allowlist;
+- tool listings with a photo URL, description, condition, deposit, and daily late fee;
+- a request/accept/return lifecycle with USDC held by the contract;
+- late fees rounded up per started late day and capped at the deposit;
+- completed-loan and late-return reputation;
+- an owner request inbox ranked by lowest late-return rate, then most completed loans;
+- a three-day fallback allowing a borrower to settle a return if an owner does not respond.
+
+## Architecture
+
+`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.
+
+`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.
+
+The main lifecycle is:
+
+1. An allowlisted member lists a tool.
+2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
+3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
+4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
+5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.
+
+For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.
+
+## Run locally
+
+Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.
+
+Install and test:
+
+```bash
+npm install
+npm test
+```
+
+In terminal one, start a local chain:
+
+```bash
+anvil
+```
+
+In terminal two, deploy the development contracts with one of Anvil's printed private keys:
+
+```bash
+export PRIVATE_KEY=<anvil-private-key>
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):
+
+```bash
+cp .env.example .env
+# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
+npm run dev
+```
+
+Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.
+
+For local deposits, mint mock USDC and then add the mock token address to the wallet:
+
+```bash
+cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
+  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
+```
+
+`1000000000` is 1,000 mock USDC because USDC has six decimals.
+
+## Deploy
+
+Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.
+
+Deploy `Toolshed` with the production USDC address:
+
+```bash
+export RPC_URL=<network-rpc-url>
+export PRIVATE_KEY=<deployer-private-key>
+export USDC_ADDRESS=<official-usdc-address>
+
+forge create contracts/Toolshed.sol:Toolshed \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS"
+```
+
+Set the returned contract address and the same USDC address in the frontend host's environment:
+
+```bash
+VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
+VITE_USDC_ADDRESS=<official-usdc-address>
+VITE_CHAIN_ID=<network-chain-id>
+npm run build
+```
+
+Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.
+
+## Contract tests
+
+Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.
+
+## Production notes
+
+This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:
+
+- move admin authority to an association multisig (the current admin cannot be changed);
+- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
+- pin photo assets and add content moderation/privacy rules;
+- add event indexing if full-history reads become slow;
+- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
+- use only the canonical, six-decimal USDC token on the selected network.
+
+Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..bd8d6480d9d08721c41d14f30da3f441dc1fe81f
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..170961d114686f500ac83bc3f3884e8de429b57a
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,60 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..fd4fbedf59c03cc543dd37cc039bf9c88e54c1e4
--- /dev/null
+++ b/README.md
@@ -0,0 +1,121 @@
+# Toolshed
+
+Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.
+
+The app includes:
+
+- an admin-managed member allowlist;
+- tool listings with a photo URL, description, condition, deposit, and daily late fee;
+- a request/accept/return lifecycle with USDC held by the contract;
+- late fees rounded up per started late day and capped at the deposit;
+- completed-loan and late-return reputation;
+- an owner request inbox ranked by lowest late-return rate, then most completed loans;
+- a three-day fallback allowing a borrower to settle a return if an owner does not respond.
+
+## Architecture
+
+`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.
+
+`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.
+
+The main lifecycle is:
+
+1. An allowlisted member lists a tool.
+2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
+3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
+4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
+5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.
+
+For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.
+
+## Run locally
+
+Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.
+
+Install and test:
+
+```bash
+npm install
+npm test
+```
+
+In terminal one, start a local chain:
+
+```bash
+anvil
+```
+
+In terminal two, deploy the development contracts with one of Anvil's printed private keys:
+
+```bash
+export PRIVATE_KEY=<anvil-private-key>
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):
+
+```bash
+cp .env.example .env
+# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
+npm run dev
+```
+
+Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.
+
+For local deposits, mint mock USDC and then add the mock token address to the wallet:
+
+```bash
+cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
+  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
+```
+
+`1000000000` is 1,000 mock USDC because USDC has six decimals.
+
+## Deploy
+
+Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.
+
+Deploy `Toolshed` with the production USDC address:
+
+```bash
+export RPC_URL=<network-rpc-url>
+export PRIVATE_KEY=<deployer-private-key>
+export USDC_ADDRESS=<official-usdc-address>
+
+forge create contracts/Toolshed.sol:Toolshed \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS"
+```
+
+Set the returned contract address and the same USDC address in the frontend host's environment:
+
+```bash
+VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
+VITE_USDC_ADDRESS=<official-usdc-address>
+VITE_CHAIN_ID=<network-chain-id>
+npm run build
+```
+
+Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.
+
+## Contract tests
+
+Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.
+
+## Production notes
+
+This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:
+
+- move admin authority to an association multisig (the current admin cannot be changed);
+- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
+- pin photo assets and add content moderation/privacy rules;
+- add event indexing if full-history reads become slow;
+- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
+- use only the canonical, six-decimal USDC token on the selected network.
+
+Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..bd8d6480d9d08721c41d14f30da3f441dc1fe81f
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..170961d114686f500ac83bc3f3884e8de429b57a
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,60 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/README.md
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/test/Toolshed.t.sol
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..67a1b99407d17be34e8edd992466a5177e16a17b
--- /dev/null
+++ b/README.md
@@ -0,0 +1,121 @@
+# Toolshed
+
+Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.
+
+The app includes:
+
+- an admin-managed member allowlist;
+- tool listings with a photo URL, description, condition, deposit, and daily late fee;
+- a request/accept/return lifecycle with USDC held by the contract;
+- late fees rounded up per started late day and capped at the deposit;
+- completed-loan and late-return reputation;
+- an owner request inbox ranked by lowest late-return rate, then most completed loans;
+- a three-day fallback allowing a borrower to settle a return if an owner does not respond.
+
+## Architecture
+
+`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.
+
+`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.
+
+The main lifecycle is:
+
+1. An allowlisted member lists a tool.
+2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
+3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
+4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
+5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.
+
+For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.
+
+## Run locally
+
+Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.
+
+Install and test:
+
+```bash
+npm install
+npm test
+```
+
+In terminal one, start a local chain:
+
+```bash
+anvil
+```
+
+In terminal two, deploy the development contracts with one of Anvil's printed private keys:
+
+```bash
+export PRIVATE_KEY=<anvil-private-key>
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):
+
+```bash
+cp .env.example .env
+# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
+npm run dev
+```
+
+Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.
+
+For local deposits, mint mock USDC and then add the mock token address to the wallet:
+
+```bash
+cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
+  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
+```
+
+Replace `$VITE_USDC_ADDRESS` with the address from `.env` (or export it in the shell first). `1000000000` is 1,000 mock USDC because USDC has six decimals.
+
+## Deploy
+
+Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.
+
+Deploy `Toolshed` with the production USDC address:
+
+```bash
+export RPC_URL=<network-rpc-url>
+export PRIVATE_KEY=<deployer-private-key>
+export USDC_ADDRESS=<official-usdc-address>
+
+forge create contracts/Toolshed.sol:Toolshed \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS"
+```
+
+Set the returned contract address and the same USDC address in the frontend host's environment:
+
+```bash
+VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
+VITE_USDC_ADDRESS=<official-usdc-address>
+VITE_CHAIN_ID=<network-chain-id>
+npm run build
+```
+
+Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.
+
+## Contract tests
+
+Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.
+
+## Production notes
+
+This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:
+
+- move admin authority to an association multisig (the current admin cannot be changed);
+- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
+- pin photo assets and add content moderation/privacy rules;
+- add event indexing if full-history reads become slow;
+- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
+- use only the canonical, six-decimal USDC token on the selected network.
+
+Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..bd8d6480d9d08721c41d14f30da3f441dc1fe81f
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a4a628c0dd447474600d3d7e1a55c4e7bdc0fbe9
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,70 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 40 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 100e6, "fee capped at deposit");
+        require(usdc.balanceOf(borrower) == 400e6, "no overcharge");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

exec
/bin/bash -lc 'npm test && git status --short && git diff --stat' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
 succeeded in 1505ms:

> toolshed@0.1.0 test
> npm run contracts:test && npm run build


> toolshed@0.1.0 contracts:test
> forge test -vv

Compiling 3 files with Solc 0.8.20
Solc 0.8.20 finished in 490.44ms
Compiler run successful!
2026-08-28T15:00:39.624981Z  WARN evm::traces::external: etherscan config not found

Ran 5 tests for test/Toolshed.t.sol:ToolshedTest
[PASS] testBorrowerCanFinalizeAfterOwnerTimeout() (gas: 239363)
[PASS] testLateFeeCannotExceedDeposit() (gas: 266197)
[PASS] testLateFeeRoundsUpAndPaysOwner() (gas: 269670)
[PASS] testOnTimeLoanReturnsFullDepositAndBuildsReputation() (gas: 255427)
[PASS] testRejectedRequestRefundsDeposit() (gas: 205161)
Suite result: ok. 5 passed; 0 failed; 0 skipped; finished in 1.08ms (1.61ms CPU time)

Ran 1 test suite in 44.56ms (1.08ms CPU time): 5 tests passed, 0 failed, 0 skipped (5 total tests)
2026-08-28T15:00:39.671049Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

> toolshed@0.1.0 build
> vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 163 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.46 kB │ gzip:  0.31 kB
dist/assets/index-DXLOsOYY.css    6.38 kB │ gzip:  2.19 kB
dist/assets/index-BmRTuUby.js   289.57 kB │ gzip: 89.39 kB

✓ built in 388ms
?? .env.example
?? .gitignore
?? README.md
?? contracts/
?? foundry.toml
?? index.html
?? package-lock.json
?? package.json
?? script/
?? src/
?? test/
?? vite.config.js

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..67a1b99407d17be34e8edd992466a5177e16a17b
--- /dev/null
+++ b/README.md
@@ -0,0 +1,121 @@
+# Toolshed
+
+Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.
+
+The app includes:
+
+- an admin-managed member allowlist;
+- tool listings with a photo URL, description, condition, deposit, and daily late fee;
+- a request/accept/return lifecycle with USDC held by the contract;
+- late fees rounded up per started late day and capped at the deposit;
+- completed-loan and late-return reputation;
+- an owner request inbox ranked by lowest late-return rate, then most completed loans;
+- a three-day fallback allowing a borrower to settle a return if an owner does not respond.
+
+## Architecture
+
+`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.
+
+`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.
+
+The main lifecycle is:
+
+1. An allowlisted member lists a tool.
+2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
+3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
+4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
+5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.
+
+For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.
+
+## Run locally
+
+Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.
+
+Install and test:
+
+```bash
+npm install
+npm test
+```
+
+In terminal one, start a local chain:
+
+```bash
+anvil
+```
+
+In terminal two, deploy the development contracts with one of Anvil's printed private keys:
+
+```bash
+export PRIVATE_KEY=<anvil-private-key>
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):
+
+```bash
+cp .env.example .env
+# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
+npm run dev
+```
+
+Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.
+
+For local deposits, mint mock USDC and then add the mock token address to the wallet:
+
+```bash
+cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
+  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
+```
+
+Replace `$VITE_USDC_ADDRESS` with the address from `.env` (or export it in the shell first). `1000000000` is 1,000 mock USDC because USDC has six decimals.
+
+## Deploy
+
+Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.
+
+Deploy `Toolshed` with the production USDC address:
+
+```bash
+export RPC_URL=<network-rpc-url>
+export PRIVATE_KEY=<deployer-private-key>
+export USDC_ADDRESS=<official-usdc-address>
+
+forge create contracts/Toolshed.sol:Toolshed \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS"
+```
+
+Set the returned contract address and the same USDC address in the frontend host's environment:
+
+```bash
+VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
+VITE_USDC_ADDRESS=<official-usdc-address>
+VITE_CHAIN_ID=<network-chain-id>
+npm run build
+```
+
+Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.
+
+## Contract tests
+
+Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.
+
+## Production notes
+
+This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:
+
+- move admin authority to an association multisig (the current admin cannot be changed);
+- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
+- pin photo assets and add content moderation/privacy rules;
+- add event indexing if full-history reads become slow;
+- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
+- use only the canonical, six-decimal USDC token on the selected network.
+
+Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..bd8d6480d9d08721c41d14f30da3f441dc1fe81f
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a4a628c0dd447474600d3d7e1a55c4e7bdc0fbe9
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,70 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 40 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 100e6, "fee capped at deposit");
+        require(usdc.balanceOf(borrower) == 400e6, "no overcharge");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

codex
The complete verification pass is now clean: five contract tests pass and the production frontend bundle builds successfully. I also added the membership admin screen and explicit deployment guidance for using canonical USDC rather than the development token; I’m doing one final source-format and repository hygiene check before handing it over.
exec
/bin/bash -lc "forge fmt --check && git status --short --ignored | sed -n '1,160p' && rg -n \"TODO|FIXME|console\\.log\" contracts src test script README.md || true" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
 succeeded in 38ms:
Diff in contracts/Toolshed.sol:
11  11   |     uint256 public constant DAY = 1 days;
12  12   |     uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
13  13   | 
14       |-    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
    14   |+    enum LoanStatus {
    15   |+        None,
    16   |+        Requested,
    17   |+        Active,
    18   |+        ReturnMarked,
    19   |+        Complete,
    20   |+        Rejected,
    21   |+        Cancelled
    22   |+    }
15  23   | 
16  24   |     struct Tool {
17  25   |         uint256 id;
--------------------------------------------------------------------------------36  44   |         LoanStatus status;
37  45   |     }
38  46   | 
39       |-    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
    47   |+    struct Reputation {
    48   |+        uint32 completedLoans;
    49   |+        uint32 lateReturns;
    50   |+    }
40  51   | 
41  52   |     address public immutable admin;
42  53   |     IERC20 public immutable usdc;
--------------------------------------------------------------------------------58  69   |     event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
59  70   |     event LoanClosed(uint256 indexed loanId, LoanStatus status);
60  71   | 
61       |-    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
62       |-    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
63       |-    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
    72   |+    modifier onlyAdmin() {
    73   |+        require(msg.sender == admin, "admin only");
    74   |+        _;
    75   |+    }
    76   |+    modifier onlyMember() {
    77   |+        require(members[msg.sender], "members only");
    78   |+        _;
    79   |+    }
    80   |+    modifier nonReentrant() {
    81   |+        require(_locked == 1, "reentrant");
    82   |+        _locked = 2;
    83   |+        _;
    84   |+        _locked = 1;
    85   |+    }
64  86   | 
65  87   |     constructor(address usdcAddress) {
66  88   |         require(usdcAddress != address(0), "zero USDC");
--------------------------------------------------------------------------------91  113  |         emit ToolListed(id, msg.sender, name);
92  114  |     }
93  115  | 
94       |-    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
    116  |+    function updateTool(
    117  |+        uint256 id,
    118  |+        string calldata photoURI,
    119  |+        string calldata condition,
    120  |+        uint256 deposit,
    121  |+        uint256 dailyLateFee,
    122  |+        bool active
    123  |+    ) external {
95  124  |         Tool storage tool = tools[id];
96  125  |         require(tool.owner == msg.sender, "owner only");
97  126  |         require(tool.available, "loan pending");

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
4   4    | import "../contracts/Toolshed.sol";
5   5    | import "../contracts/MockUSDC.sol";
6   6    | 
7        |-interface Vm { function prank(address) external; function warp(uint256) external; }
    7    |+interface Vm {
    8    |+    function prank(address) external;
    9    |+    function warp(uint256) external;
    10   |+}
8   11   | 
9   12   | contract ToolshedTest {
10  13   |     Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
11       |-    Toolshed shed; MockUSDC usdc;
12       |-    address owner = address(0xA11CE); address borrower = address(0xB0B);
    14   |+    Toolshed shed;
    15   |+    MockUSDC usdc;
    16   |+    address owner = address(0xA11CE);
    17   |+    address borrower = address(0xB0B);
13  18   | 
14  19   |     function setUp() public {
15       |-        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
16       |-        shed.setMember(owner, true); shed.setMember(borrower, true);
    20   |+        usdc = new MockUSDC();
    21   |+        shed = new Toolshed(address(usdc));
    22   |+        shed.setMember(owner, true);
    23   |+        shed.setMember(borrower, true);
17  24   |         usdc.mint(borrower, 500e6);
18       |-        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
19       |-        vm.prank(borrower); usdc.approve(address(shed), 500e6);
    25   |+        vm.prank(owner);
    26   |+        shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
    27   |+        vm.prank(borrower);
    28   |+        usdc.approve(address(shed), 500e6);
20  29   |     }
21  30   | 
22  31   |     function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
23       |-        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
24       |-        vm.prank(owner); shed.acceptLoan(loan);
    32   |+        vm.prank(borrower);
    33   |+        uint256 loan = shed.requestLoan(1, 3);
    34   |+        vm.prank(owner);
    35   |+        shed.acceptLoan(loan);
25  36   |         vm.warp(block.timestamp + 2 days);
26       |-        vm.prank(borrower); shed.markReturned(loan);
27       |-        vm.prank(owner); shed.confirmReturned(loan);
    37   |+        vm.prank(borrower);
    38   |+        shed.markReturned(loan);
    39   |+        vm.prank(owner);
    40   |+        shed.confirmReturned(loan);
28  41   |         require(usdc.balanceOf(borrower) == 500e6, "full refund");
29  42   |         (uint32 completed, uint32 late) = shed.reputation(borrower);
30  43   |         require(completed == 1 && late == 0, "reputation");
31       |-        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
    44   |+        (,,,,,,, bool available,) = shed.tools(1);
    45   |+        require(available, "available again");
32  46   |     }
33  47   | 
34  48   |     function testLateFeeRoundsUpAndPaysOwner() public {
35       |-        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
36       |-        vm.prank(owner); shed.acceptLoan(loan);
    49   |+        vm.prank(borrower);
    50   |+        uint256 loan = shed.requestLoan(1, 2);
    51   |+        vm.prank(owner);
    52   |+        shed.acceptLoan(loan);
37  53   |         vm.warp(block.timestamp + 3 days + 1);
38       |-        vm.prank(borrower); shed.markReturned(loan);
39       |-        vm.prank(owner); shed.confirmReturned(loan);
    54   |+        vm.prank(borrower);
    55   |+        shed.markReturned(loan);
    56   |+        vm.prank(owner);
    57   |+        shed.confirmReturned(loan);
40  58   |         require(usdc.balanceOf(owner) == 10e6, "two late days paid");
41  59   |         require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
42  60   |         (uint32 completed, uint32 late) = shed.reputation(borrower);
--------------------------------------------------------------------------------44  62   |     }
45  63   | 
46  64   |     function testRejectedRequestRefundsDeposit() public {
47       |-        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
48       |-        vm.prank(owner); shed.rejectLoan(loan);
    65   |+        vm.prank(borrower);
    66   |+        uint256 loan = shed.requestLoan(1, 2);
    67   |+        vm.prank(owner);
    68   |+        shed.rejectLoan(loan);
49  69   |         require(usdc.balanceOf(borrower) == 500e6, "refunded");
50  70   |     }
51  71   | 
52  72   |     function testBorrowerCanFinalizeAfterOwnerTimeout() public {
53       |-        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
54       |-        vm.prank(owner); shed.acceptLoan(loan);
55       |-        vm.prank(borrower); shed.markReturned(loan);
    73   |+        vm.prank(borrower);
    74   |+        uint256 loan = shed.requestLoan(1, 1);
    75   |+        vm.prank(owner);
    76   |+        shed.acceptLoan(loan);
    77   |+        vm.prank(borrower);
    78   |+        shed.markReturned(loan);
56  79   |         vm.warp(block.timestamp + 3 days);
57       |-        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
    80   |+        vm.prank(borrower);
    81   |+        shed.finalizeUnconfirmedReturn(loan);
58  82   |         require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
59  83   |     }
60  84   | 
61  85   |     function testLateFeeCannotExceedDeposit() public {
62       |-        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
63       |-        vm.prank(owner); shed.acceptLoan(loan);
    86   |+        vm.prank(borrower);
    87   |+        uint256 loan = shed.requestLoan(1, 1);
    88   |+        vm.prank(owner);
    89   |+        shed.acceptLoan(loan);
64  90   |         vm.warp(block.timestamp + 40 days);
65       |-        vm.prank(borrower); shed.markReturned(loan);
66       |-        vm.prank(owner); shed.confirmReturned(loan);
    91   |+        vm.prank(borrower);
    92   |+        shed.markReturned(loan);
    93   |+        vm.prank(owner);
    94   |+        shed.confirmReturned(loan);
67  95   |         require(usdc.balanceOf(owner) == 100e6, "fee capped at deposit");
68  96   |         require(usdc.balanceOf(borrower) == 400e6, "no overcharge");
69  97   |     }

Diff in script/Deploy.s.sol:
4   4    | import "../contracts/Toolshed.sol";
5   5    | import "../contracts/MockUSDC.sol";
6   6    | 
7        |-interface Vm { function startBroadcast() external; function stopBroadcast() external; }
    7    |+interface Vm {
    8    |+    function startBroadcast() external;
    9    |+    function stopBroadcast() external;
    10   |+}
8   11   | 
9   12   | contract Deploy {
10  13   |     Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    14   |+
11  15   |     function run() external returns (Toolshed shed, MockUSDC token) {
12  16   |         vm.startBroadcast();
13  17   |         token = new MockUSDC();

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..67a1b99407d17be34e8edd992466a5177e16a17b
--- /dev/null
+++ b/README.md
@@ -0,0 +1,121 @@
+# Toolshed
+
+Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.
+
+The app includes:
+
+- an admin-managed member allowlist;
+- tool listings with a photo URL, description, condition, deposit, and daily late fee;
+- a request/accept/return lifecycle with USDC held by the contract;
+- late fees rounded up per started late day and capped at the deposit;
+- completed-loan and late-return reputation;
+- an owner request inbox ranked by lowest late-return rate, then most completed loans;
+- a three-day fallback allowing a borrower to settle a return if an owner does not respond.
+
+## Architecture
+
+`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.
+
+`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.
+
+The main lifecycle is:
+
+1. An allowlisted member lists a tool.
+2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
+3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
+4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
+5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.
+
+For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.
+
+## Run locally
+
+Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.
+
+Install and test:
+
+```bash
+npm install
+npm test
+```
+
+In terminal one, start a local chain:
+
+```bash
+anvil
+```
+
+In terminal two, deploy the development contracts with one of Anvil's printed private keys:
+
+```bash
+export PRIVATE_KEY=<anvil-private-key>
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):
+
+```bash
+cp .env.example .env
+# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
+npm run dev
+```
+
+Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.
+
+For local deposits, mint mock USDC and then add the mock token address to the wallet:
+
+```bash
+cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
+  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
+```
+
+Replace `$VITE_USDC_ADDRESS` with the address from `.env` (or export it in the shell first). `1000000000` is 1,000 mock USDC because USDC has six decimals.
+
+## Deploy
+
+Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.
+
+Deploy `Toolshed` with the production USDC address:
+
+```bash
+export RPC_URL=<network-rpc-url>
+export PRIVATE_KEY=<deployer-private-key>
+export USDC_ADDRESS=<official-usdc-address>
+
+forge create contracts/Toolshed.sol:Toolshed \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS"
+```
+
+Set the returned contract address and the same USDC address in the frontend host's environment:
+
+```bash
+VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
+VITE_USDC_ADDRESS=<official-usdc-address>
+VITE_CHAIN_ID=<network-chain-id>
+npm run build
+```
+
+Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.
+
+## Contract tests
+
+Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.
+
+## Production notes
+
+This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:
+
+- move admin authority to an association multisig (the current admin cannot be changed);
+- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
+- pin photo assets and add content moderation/privacy rules;
+- add event indexing if full-history reads become slow;
+- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
+- use only the canonical, six-decimal USDC token on the selected network.
+
+Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..bd8d6480d9d08721c41d14f30da3f441dc1fe81f
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a4a628c0dd447474600d3d7e1a55c4e7bdc0fbe9
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,70 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 40 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 100e6, "fee capped at deposit");
+        require(usdc.balanceOf(borrower) == 400e6, "no overcharge");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

exec
/bin/bash -lc "forge fmt && forge fmt --check && forge test -q && npm run build >/tmp/toolshed-build.log && tail -n 8 /tmp/toolshed-build.log && git status --short --ignored | sed -n '1,160p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace
 succeeded in 1445ms:
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/contracts/Toolshed.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/script/Deploy.s.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/contracts/MockUSDC.sol
Formatted /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/test/Toolshed.t.sol
Compiling 3 files with Solc 0.8.20
Solc 0.8.20 finished in 488.22ms
2026-08-28T15:00:57.289118Z  WARN evm::traces::external: etherscan config not found
2026-08-28T15:00:57.300924Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
✓ 163 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.46 kB │ gzip:  0.31 kB
dist/assets/index-DXLOsOYY.css    6.38 kB │ gzip:  2.19 kB
dist/assets/index-BmRTuUby.js   289.57 kB │ gzip: 89.39 kB

✓ built in 584ms
?? .env.example
?? .gitignore
?? README.md
?? contracts/
?? foundry.toml
?? index.html
?? package-lock.json
?? package.json
?? script/
?? src/
?? test/
?? vite.config.js
!! cache/
!! dist/
!! node_modules/
!! out/

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..67a1b99407d17be34e8edd992466a5177e16a17b
--- /dev/null
+++ b/README.md
@@ -0,0 +1,121 @@
+# Toolshed
+
+Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.
+
+The app includes:
+
+- an admin-managed member allowlist;
+- tool listings with a photo URL, description, condition, deposit, and daily late fee;
+- a request/accept/return lifecycle with USDC held by the contract;
+- late fees rounded up per started late day and capped at the deposit;
+- completed-loan and late-return reputation;
+- an owner request inbox ranked by lowest late-return rate, then most completed loans;
+- a three-day fallback allowing a borrower to settle a return if an owner does not respond.
+
+## Architecture
+
+`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.
+
+`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.
+
+The main lifecycle is:
+
+1. An allowlisted member lists a tool.
+2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
+3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
+4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
+5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.
+
+For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.
+
+## Run locally
+
+Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.
+
+Install and test:
+
+```bash
+npm install
+npm test
+```
+
+In terminal one, start a local chain:
+
+```bash
+anvil
+```
+
+In terminal two, deploy the development contracts with one of Anvil's printed private keys:
+
+```bash
+export PRIVATE_KEY=<anvil-private-key>
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):
+
+```bash
+cp .env.example .env
+# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
+npm run dev
+```
+
+Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.
+
+For local deposits, mint mock USDC and then add the mock token address to the wallet:
+
+```bash
+cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
+  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
+```
+
+Replace `$VITE_USDC_ADDRESS` with the address from `.env` (or export it in the shell first). `1000000000` is 1,000 mock USDC because USDC has six decimals.
+
+## Deploy
+
+Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.
+
+Deploy `Toolshed` with the production USDC address:
+
+```bash
+export RPC_URL=<network-rpc-url>
+export PRIVATE_KEY=<deployer-private-key>
+export USDC_ADDRESS=<official-usdc-address>
+
+forge create contracts/Toolshed.sol:Toolshed \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS"
+```
+
+Set the returned contract address and the same USDC address in the frontend host's environment:
+
+```bash
+VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
+VITE_USDC_ADDRESS=<official-usdc-address>
+VITE_CHAIN_ID=<network-chain-id>
+npm run build
+```
+
+Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.
+
+## Contract tests
+
+Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.
+
+## Production notes
+
+This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:
+
+- move admin authority to an association multisig (the current admin cannot be changed);
+- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
+- pin photo assets and add content moderation/privacy rules;
+- add event indexing if full-history reads become slow;
+- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
+- use only the canonical, six-decimal USDC token on the selected network.
+
+Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..bd8d6480d9d08721c41d14f30da3f441dc1fe81f
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a4a628c0dd447474600d3d7e1a55c4e7bdc0fbe9
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,70 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 40 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 100e6, "fee capped at deposit");
+        require(usdc.balanceOf(borrower) == 400e6, "no overcharge");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

codex
Shipped the first Toolshed MVP.

Included:

- React/Vite member interface
- Solidity USDC escrow contract
- Member allowlist administration
- Tool listings with photos and condition notes
- Borrow, accept, cancel, reject, return, and settlement flows
- Daily late fees capped by the deposit
- Borrower reputation and reliability-ranked requests
- Three-day fallback for unconfirmed returns
- Local Mock USDC and deployment script
- Architecture, setup, and deployment documentation in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/README.md)

Verification:

- 5 Solidity tests passing
- Solidity formatting check passing
- Production frontend build passing
- 0 npm audit vulnerabilities

Run locally with:

```bash
npm install
npm test
```

Then follow the local-chain instructions in the README.
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..5b4a159ffca289d5d408925a5ded6c1dd9440908
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,4 @@
+VITE_TOOLSHED_ADDRESS=0xYourToolshedContract
+VITE_USDC_ADDRESS=0xYourUsdcContract
+VITE_CHAIN_ID=31337
+
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..fa74125539f1454d3a7ccaacda36db2fbc60b59d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,8 @@
+node_modules/
+cache/
+broadcast/
+dist/
+out/
+.env
+*.local
+
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..67a1b99407d17be34e8edd992466a5177e16a17b
--- /dev/null
+++ b/README.md
@@ -0,0 +1,121 @@
+# Toolshed
+
+Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.
+
+The app includes:
+
+- an admin-managed member allowlist;
+- tool listings with a photo URL, description, condition, deposit, and daily late fee;
+- a request/accept/return lifecycle with USDC held by the contract;
+- late fees rounded up per started late day and capped at the deposit;
+- completed-loan and late-return reputation;
+- an owner request inbox ranked by lowest late-return rate, then most completed loans;
+- a three-day fallback allowing a borrower to settle a return if an owner does not respond.
+
+## Architecture
+
+`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.
+
+`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.
+
+The main lifecycle is:
+
+1. An allowlisted member lists a tool.
+2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
+3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
+4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
+5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.
+
+For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.
+
+## Run locally
+
+Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.
+
+Install and test:
+
+```bash
+npm install
+npm test
+```
+
+In terminal one, start a local chain:
+
+```bash
+anvil
+```
+
+In terminal two, deploy the development contracts with one of Anvil's printed private keys:
+
+```bash
+export PRIVATE_KEY=<anvil-private-key>
+forge script script/Deploy.s.sol:Deploy \
+  --rpc-url http://127.0.0.1:8545 \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast
+```
+
+Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):
+
+```bash
+cp .env.example .env
+# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
+npm run dev
+```
+
+Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.
+
+For local deposits, mint mock USDC and then add the mock token address to the wallet:
+
+```bash
+cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
+  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
+```
+
+Replace `$VITE_USDC_ADDRESS` with the address from `.env` (or export it in the shell first). `1000000000` is 1,000 mock USDC because USDC has six decimals.
+
+## Deploy
+
+Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.
+
+Deploy `Toolshed` with the production USDC address:
+
+```bash
+export RPC_URL=<network-rpc-url>
+export PRIVATE_KEY=<deployer-private-key>
+export USDC_ADDRESS=<official-usdc-address>
+
+forge create contracts/Toolshed.sol:Toolshed \
+  --rpc-url "$RPC_URL" \
+  --private-key "$PRIVATE_KEY" \
+  --broadcast \
+  --constructor-args "$USDC_ADDRESS"
+```
+
+Set the returned contract address and the same USDC address in the frontend host's environment:
+
+```bash
+VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
+VITE_USDC_ADDRESS=<official-usdc-address>
+VITE_CHAIN_ID=<network-chain-id>
+npm run build
+```
+
+Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.
+
+## Contract tests
+
+Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.
+
+## Production notes
+
+This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:
+
+- move admin authority to an association multisig (the current admin cannot be changed);
+- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
+- pin photo assets and add content moderation/privacy rules;
+- add event indexing if full-history reads become slow;
+- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
+- use only the canonical, six-decimal USDC token on the selected network.
+
+Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
diff --git a/contracts/MockUSDC.sol b/contracts/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..aa55c539032f8baa13b1d703eec1b4b3099922c8
--- /dev/null
+++ b/contracts/MockUSDC.sol
@@ -0,0 +1,26 @@
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
diff --git a/contracts/Toolshed.sol b/contracts/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f482d87f03355324778a7d505f807593084e942b
--- /dev/null
+++ b/contracts/Toolshed.sol
@@ -0,0 +1,201 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @title Toolshed - member-to-member tool lending with USDC escrow
+contract Toolshed {
+    uint256 public constant DAY = 1 days;
+    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;
+
+    enum LoanStatus { None, Requested, Active, ReturnMarked, Complete, Rejected, Cancelled }
+
+    struct Tool {
+        uint256 id;
+        address owner;
+        string name;
+        string photoURI;
+        string condition;
+        uint256 deposit;
+        uint256 dailyLateFee;
+        bool available;
+        bool active;
+    }
+
+    struct Loan {
+        uint256 id;
+        uint256 toolId;
+        address borrower;
+        uint32 durationDays;
+        uint64 startedAt;
+        uint64 dueAt;
+        uint64 returnMarkedAt;
+        LoanStatus status;
+    }
+
+    struct Reputation { uint32 completedLoans; uint32 lateReturns; }
+
+    address public immutable admin;
+    IERC20 public immutable usdc;
+    uint256 public toolCount;
+    uint256 public loanCount;
+    mapping(address => bool) public members;
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+    mapping(uint256 => uint256[]) private _toolLoans;
+    uint256 private _locked = 1;
+
+    event MemberSet(address indexed member, bool enabled);
+    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
+    event ToolUpdated(uint256 indexed toolId);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
+    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
+    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+    event LoanClosed(uint256 indexed loanId, LoanStatus status);
+
+    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
+    modifier onlyMember() { require(members[msg.sender], "members only"); _; }
+    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
+
+    constructor(address usdcAddress) {
+        require(usdcAddress != address(0), "zero USDC");
+        admin = msg.sender;
+        usdc = IERC20(usdcAddress);
+        members[msg.sender] = true;
+        emit MemberSet(msg.sender, true);
+    }
+
+    function setMember(address member, bool enabled) external onlyAdmin {
+        require(member != address(0), "zero member");
+        members[member] = enabled;
+        emit MemberSet(member, enabled);
+    }
+
+    function listTool(
+        string calldata name,
+        string calldata photoURI,
+        string calldata condition,
+        uint256 deposit,
+        uint256 dailyLateFee
+    ) external onlyMember returns (uint256 id) {
+        require(bytes(name).length > 0, "name required");
+        require(deposit > 0, "deposit required");
+        require(dailyLateFee <= deposit, "fee exceeds deposit");
+        id = ++toolCount;
+        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
+        emit ToolListed(id, msg.sender, name);
+    }
+
+    function updateTool(uint256 id, string calldata photoURI, string calldata condition, uint256 deposit, uint256 dailyLateFee, bool active) external {
+        Tool storage tool = tools[id];
+        require(tool.owner == msg.sender, "owner only");
+        require(tool.available, "loan pending");
+        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
+        tool.photoURI = photoURI;
+        tool.condition = condition;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.active = active;
+        tool.available = active;
+        emit ToolUpdated(id);
+    }
+
+    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
+        Tool storage tool = tools[toolId];
+        require(tool.active && tool.available, "not available");
+        require(tool.owner != msg.sender, "cannot borrow own tool");
+        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
+        tool.available = false;
+        id = ++loanCount;
+        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
+        _toolLoans[toolId].push(id);
+        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
+        emit LoanRequested(id, toolId, msg.sender);
+    }
+
+    function acceptLoan(uint256 id) external {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Active;
+        loan.startedAt = uint64(block.timestamp);
+        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
+        emit LoanStarted(id, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(tool.owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Rejected;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Rejected);
+    }
+
+    function cancelRequest(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Requested, "not requested");
+        loan.status = LoanStatus.Cancelled;
+        tool.available = tool.active;
+        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
+        emit LoanClosed(id, LoanStatus.Cancelled);
+    }
+
+    function markReturned(uint256 id) external {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.Active, "not active");
+        loan.status = LoanStatus.ReturnMarked;
+        loan.returnMarkedAt = uint64(block.timestamp);
+        emit ReturnMarked(id, loan.returnMarkedAt);
+    }
+
+    function confirmReturned(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(tools[loan.toolId].owner == msg.sender, "owner only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        _settle(id);
+    }
+
+    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
+        Loan storage loan = loans[id];
+        require(loan.borrower == msg.sender, "borrower only");
+        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
+        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
+        _settle(id);
+    }
+
+    function _settle(uint256 id) private {
+        Loan storage loan = loans[id];
+        Tool storage tool = tools[loan.toolId];
+        uint256 lateDays;
+        if (loan.returnMarkedAt > loan.dueAt) {
+            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
+        }
+        uint256 ownerFee = lateDays * tool.dailyLateFee;
+        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
+        uint256 refund = tool.deposit - ownerFee;
+        loan.status = LoanStatus.Complete;
+        tool.available = tool.active;
+        Reputation storage rep = reputation[loan.borrower];
+        rep.completedLoans++;
+        if (lateDays > 0) rep.lateReturns++;
+        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
+        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
+        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
+    }
+
+    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
+        return _toolLoans[toolId];
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
index 0000000000000000000000000000000000000000..2560502f10128495e7b8e288168f27b99d041e41
--- /dev/null
+++ b/index.html
@@ -0,0 +1,10 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#173f35" />
+    <title>Toolshed — neighborhood lending</title>
+  </head>
+  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
+</html>
diff --git a/package.json b/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..53d7ad3c7626188e1b48cbbcfbe1afe461a57a83
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview",
+    "contracts:build": "forge build",
+    "contracts:test": "forge test -vv",
+    "test": "npm run contracts:test && npm run build"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "latest",
+    "ethers": "^6.15.0",
+    "vite": "latest",
+    "react": "latest",
+    "react-dom": "latest"
+  },
+  "devDependencies": {}
+}
diff --git a/script/Deploy.s.sol b/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4fe9115999a4e74cb57f3fd63b79128714488089
--- /dev/null
+++ b/script/Deploy.s.sol
@@ -0,0 +1,17 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function startBroadcast() external; function stopBroadcast() external; }
+
+contract Deploy {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    function run() external returns (Toolshed shed, MockUSDC token) {
+        vm.startBroadcast();
+        token = new MockUSDC();
+        shed = new Toolshed(address(token));
+        vm.stopBroadcast();
+    }
+}
diff --git a/src/contracts.js b/src/contracts.js
new file mode 100644
index 0000000000000000000000000000000000000000..dcc194baa24295bf1af60482bfcbe4b1419ac5fb
--- /dev/null
+++ b/src/contracts.js
@@ -0,0 +1,25 @@
+export const toolshedAbi = [
+  "function admin() view returns (address)",
+  "function members(address) view returns (bool)",
+  "function toolCount() view returns (uint256)",
+  "function loanCount() view returns (uint256)",
+  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
+  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
+  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
+  "function setMember(address member,bool enabled)",
+  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
+  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
+  "function acceptLoan(uint256 id)",
+  "function rejectLoan(uint256 id)",
+  "function cancelRequest(uint256 id)",
+  "function markReturned(uint256 id)",
+  "function confirmReturned(uint256 id)",
+  "function finalizeUnconfirmedReturn(uint256 id)",
+];
+
+export const usdcAbi = [
+  "function approve(address spender,uint256 amount) returns (bool)",
+  "function balanceOf(address) view returns (uint256)",
+];
+
+export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000000000000000000000000000000000000..bd8d6480d9d08721c41d14f30da3f441dc1fe81f
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,99 @@
+import React, { useEffect, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
+import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
+import "./styles.css";
+
+const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
+const USDC = import.meta.env.VITE_USDC_ADDRESS;
+const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
+const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
+const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";
+
+function App() {
+  const [provider, setProvider] = useState();
+  const [account, setAccount] = useState("");
+  const [contract, setContract] = useState();
+  const [tools, setTools] = useState([]);
+  const [loans, setLoans] = useState([]);
+  const [reps, setReps] = useState({});
+  const [tab, setTab] = useState("browse");
+  const [notice, setNotice] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [isMember, setIsMember] = useState(false);
+  const [isAdmin, setIsAdmin] = useState(false);
+
+  async function connect() {
+    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
+    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
+    const p = new BrowserProvider(window.ethereum);
+    const signer = await p.getSigner();
+    const address = await signer.getAddress();
+    const c = new Contract(SHED, toolshedAbi, signer);
+    setProvider(p); setAccount(address); setContract(c);
+    setIsMember(await c.members(address));
+    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
+  }
+
+  async function load() {
+    if (!contract) return;
+    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
+    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
+    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
+    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
+    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
+    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
+  }
+  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);
+
+  async function transact(label, fn) {
+    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
+    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
+    finally { setBusy(false); }
+  }
+
+  async function request(tool, days) {
+    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
+    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
+  }
+
+  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
+  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
+  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
+  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
+    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
+    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
+    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
+    return as - bs || Number(br[0]) - Number(ar[0]);
+  }), [ownerLoans, reps]);
+
+  if (!account) return <Landing connect={connect} notice={notice} />;
+  return <div className="app">
+    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
+      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
+    </nav><div className="wallet"><i />{short(account)}</div></header>
+    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
+    <main>
+      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
+        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
+        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
+        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
+        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
+      </>}
+    </main>
+  </div>;
+}
+
+function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }
+
+function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }
+
+function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }
+
+function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }
+
+function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
+function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
+function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }
+
+createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..4660c0e234b062f6c3bd9d20c5f13b83cc290d59
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,2 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,700;1,700&display=swap');
+:root{font-family:'DM Sans',sans-serif;color:#193b32;background:#f8f5ed;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}.app{min-height:100vh}header{height:76px;padding:0 max(5vw,24px);display:flex;align-items:center;border-bottom:1px solid #dcd8ca;background:#fffdf7;position:sticky;top:0;z-index:10}.brand{border:0;background:none;font-family:Fraunces;font-size:24px;font-weight:700;color:#173f35}.brand span{display:inline-grid;place-items:center;background:#e1ae44;color:#173f35;width:36px;height:36px;border-radius:50%;margin-right:8px}nav{display:flex;gap:30px;margin:auto}nav button{border:0;background:none;color:#64766f;padding:27px 2px 23px}nav .active{color:#173f35;border-bottom:3px solid #dd9e27;font-weight:700}.wallet{background:#edf1eb;padding:9px 13px;border-radius:30px;font-size:13px}.wallet i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a9b68;margin-right:7px}main{max-width:1180px;margin:0 auto;padding:54px 24px 80px}.page-title{margin-bottom:34px}.page-title.row{display:flex;justify-content:space-between;align-items:center}.eyebrow{color:#b47617;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:9px}h1,h2{font-family:Fraunces,serif;margin:0;line-height:1.05}h2{font-size:43px}h3{margin:0 0 6px}.page-title p{color:#718079;margin:10px 0 0}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:25px}.tool-card{background:#fff;border:1px solid #dedbcf;border-radius:8px;overflow:hidden;box-shadow:0 3px 12px #244e4010}.photo{height:210px;background:#d9e2d8;position:relative;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo>span{font-size:64px}.photo b{position:absolute;top:14px;left:14px;font-size:11px;padding:6px 10px;border-radius:20px}.available{background:#e0f3e7;color:#217148}.unavailable{background:#eee9de;color:#6d675c}.card-body{padding:20px}.card-body>p,.list-row p,.loan-row p{font-size:13px;color:#73817c;margin:0}.owner{font-size:12px;margin:15px 0;color:#7c8782}.terms{border-top:1px solid #e6e2d8;padding-top:14px;display:flex;gap:35px}.terms span{font-weight:700}.terms small,.loan-row small,.push small{display:block;font-size:9px;letter-spacing:1px;color:#849089;margin-bottom:3px}.borrow{display:flex;gap:8px;margin-top:15px}.borrow input{width:58px}.borrow button,.loan-row button,.membership button{flex:1;background:#173f35;color:white;border:0;border-radius:4px;padding:10px;font-weight:700}.primary{border:0;border-radius:4px;background:#e4a533;color:#173f35;padding:15px 22px;font-weight:700}.primary span{margin-left:25px}.compact{padding:11px 17px}.notice{position:fixed;right:20px;top:90px;z-index:20;background:#173f35;color:white;border:0;border-radius:5px;padding:13px 18px;max-width:420px}.panel{background:#fff;border:1px solid #dedbcf;border-radius:7px;padding:20px;margin-bottom:32px}.form{display:grid;grid-template-columns:1fr 1fr;gap:18px}.form label{font-size:12px;font-weight:700}.form .wide{grid-column:1/-1}.form input,.form textarea,.membership input{display:block;width:100%;margin-top:6px;border:1px solid #cbc9c0;border-radius:4px;padding:11px;background:#fffdf9}.form textarea{height:72px;resize:vertical}.list-row{display:flex;align-items:center;gap:18px;padding:17px 0;border-bottom:1px solid #dfddd5}.thumb{width:65px;height:65px;background:#dde5dc;border-radius:5px;display:grid;place-items:center;font-size:24px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:cover}.push{margin-left:auto;text-align:right}.push>*{display:block}.section-label{margin:25px 0 12px}.loan-row{display:grid;grid-template-columns:1fr 130px 220px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #e3e0d6}.loan-row:last-child,.list-row:last-child{border:0}.status{font-size:12px;padding:6px 9px;border-radius:20px;background:#edeae1;text-align:center}.s1{background:#fff0ce;color:#8b6217}.s2{background:#dcece3;color:#286549}.s4{background:#e2eee6;color:#26704c}.actions{display:flex;gap:7px}.actions .ghost{background:white;color:#173f35;border:1px solid #aeb8b2}.empty{text-align:center;color:#75847d;padding:40px}.empty span{font-size:30px}.membership{max-width:560px;margin:60px auto;text-align:center}.membership p{color:#6f7d77}.membership button{margin-top:12px}.landing{height:100vh;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:#173f35;color:#fff;overflow:hidden}.landing-copy{padding:14vh 4vw 5vh max(7vw,30px);position:relative;z-index:2}.landing h1{font-size:clamp(55px,6.5vw,96px);letter-spacing:-3px}.landing h1 em{color:#e3ad45}.landing-copy>p{font-size:18px;line-height:1.7;color:#ccd8d2;max-width:520px;margin:30px 0}.landing .primary{font-size:16px}.landing small{display:block;margin-top:28px;color:#8eaaa0}.landing .error{color:#ffcda9;font-size:14px;margin:16px 0}.hero-art{position:relative;background:#dce6d6;overflow:hidden}.sun{position:absolute;width:260px;height:260px;border-radius:50%;background:#e8b24d;right:-50px;top:-40px}.ground{position:absolute;bottom:-20%;left:-15%;width:140%;height:55%;background:#9bad87;border-radius:50% 50% 0 0}.shed{position:absolute;z-index:2;left:17%;bottom:20%;width:65%;height:45%;background:#c96f46;box-shadow:15px 18px 0 #173f3530}.roof{position:absolute;left:-12%;top:-35%;width:124%;height:40%;background:#254b3f;clip-path:polygon(50% 0,100% 100%,0 100%)}.door{position:absolute;left:30%;bottom:0;width:40%;height:75%;background:#eed9ac;color:#173f35;display:grid;place-items:center;text-align:center;font-family:Fraunces;font-size:28px;border:8px solid #a95738}.door b{font-size:17px;margin-top:-55px}@media(max-width:850px){.tool-grid{grid-template-columns:repeat(2,1fr)}.landing{grid-template-columns:1fr}.hero-art{display:none}.loan-row{grid-template-columns:1fr 110px}.actions{grid-column:1/-1}nav{gap:10px}}@media(max-width:580px){header{padding:0 12px}.wallet{display:none}nav{margin-left:auto}.brand{font-size:0}.brand span{font-size:20px}.tool-grid{grid-template-columns:1fr}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}h2{font-size:34px}.page-title.row{align-items:flex-end}.landing-copy{padding-top:12vh}.landing h1{font-size:52px}.loan-row{grid-template-columns:1fr}.status{width:max-content}.actions{grid-column:auto}}
diff --git a/test/Toolshed.t.sol b/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a4a628c0dd447474600d3d7e1a55c4e7bdc0fbe9
--- /dev/null
+++ b/test/Toolshed.t.sol
@@ -0,0 +1,70 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+import "../contracts/Toolshed.sol";
+import "../contracts/MockUSDC.sol";
+
+interface Vm { function prank(address) external; function warp(uint256) external; }
+
+contract ToolshedTest {
+    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    Toolshed shed; MockUSDC usdc;
+    address owner = address(0xA11CE); address borrower = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC(); shed = new Toolshed(address(usdc));
+        shed.setMember(owner, true); shed.setMember(borrower, true);
+        usdc.mint(borrower, 500e6);
+        vm.prank(owner); shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
+        vm.prank(borrower); usdc.approve(address(shed), 500e6);
+    }
+
+    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 3);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 2 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "full refund");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 0, "reputation");
+        (,,,,,,,bool available,) = shed.tools(1); require(available, "available again");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 3 days + 1);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
+        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
+        (uint32 completed, uint32 late) = shed.reputation(borrower);
+        require(completed == 1 && late == 1, "late recorded");
+    }
+
+    function testRejectedRequestRefundsDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 2);
+        vm.prank(owner); shed.rejectLoan(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "refunded");
+    }
+
+    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.warp(block.timestamp + 3 days);
+        vm.prank(borrower); shed.finalizeUnconfirmedReturn(loan);
+        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
+    }
+
+    function testLateFeeCannotExceedDeposit() public {
+        vm.prank(borrower); uint256 loan = shed.requestLoan(1, 1);
+        vm.prank(owner); shed.acceptLoan(loan);
+        vm.warp(block.timestamp + 40 days);
+        vm.prank(borrower); shed.markReturned(loan);
+        vm.prank(owner); shed.confirmReturned(loan);
+        require(usdc.balanceOf(owner) == 100e6, "fee capped at deposit");
+        require(usdc.balanceOf(borrower) == 400e6, "no overcharge");
+    }
+}
diff --git a/vite.config.js b/vite.config.js
new file mode 100644
index 0000000000000000000000000000000000000000..9175e67f5b4c2695525e062a92de1b380791195c
--- /dev/null
+++ b/vite.config.js
@@ -0,0 +1,4 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({ plugins: [react()] });

tokens used
51,409
Shipped the first Toolshed MVP.

Included:

- React/Vite member interface
- Solidity USDC escrow contract
- Member allowlist administration
- Tool listings with photos and condition notes
- Borrow, accept, cancel, reject, return, and settlement flows
- Daily late fees capped by the deposit
- Borrower reputation and reliability-ranked requests
- Three-day fallback for unconfirmed returns
- Local Mock USDC and deployment script
- Architecture, setup, and deployment documentation in [README.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-goal-001/2026-08-28T145522Z-codex-no-skill-2/workspace/README.md)

Verification:

- 5 Solidity tests passing
- Solidity formatting check passing
- Production frontend build passing
- 0 npm audit vulnerabilities

Run locally with:

```bash
npm install
npm test
```

Then follow the local-chain instructions in the README.
